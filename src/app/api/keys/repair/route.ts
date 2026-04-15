import { NextResponse } from "next/server";
import { getSessionOrNull } from "@/lib/auth/require-session";
import { listManagedKeys } from "@/features/managed-keys/service";

function extractChinesePositions(key: string): Array<{ index: number; char: string }> {
  const positions: Array<{ index: number; char: string }> = [];
  for (let i = 0; i < key.length; i++) {
    const char = key[i];
    // 检测中文字符或非标准 API key 字符（API key 通常只包含 a-z, A-Z, 0-9, -, _）
    if (!/[a-zA-Z0-9\-_]/.test(char)) {
      positions.push({ index: i, char });
    }
  }
  return positions;
}

async function getAvailableAIKey(keyId?: string) {
  if (keyId) {
    const keys = await listManagedKeys();
    const selectedKey = keys.find((key) => key.id === keyId);

    if (selectedKey && selectedKey.isTestable && selectedKey.protocol === "anthropic") {
      return selectedKey;
    }
  }

  const keys = await listManagedKeys();

  const availableKey = keys.find(
    (key) =>
      key.isTestable &&
      key.lastTestStatus === "success" &&
      key.protocol === "anthropic" &&
      key.baseUrl &&
      key.secret,
  );

  return availableKey;
}

async function repairKeyWithAI(
  corruptedKey: string,
  chineseText: string,
  targetLength: number,
  baseUrl: string,
  protocol: "anthropic" | "openai",
  keyId?: string,
  model?: string,
  customPrompt?: string,
  previousCandidates?: string[],
  maxCandidates?: number,
): Promise<{
  success: boolean;
  repairedKey?: string;
  attempts: number;
  error?: string;
  candidates?: string[];
  validCandidates?: string[];
  testResults?: Array<{ candidate: string; status: "testing" | "success" | "failed" }>;
}> {
  const currentLength = corruptedKey.length;
  const chineseLength = chineseText.length;
  const missingLength = targetLength - currentLength + chineseLength;

  if (missingLength <= 0) {
    return {
      success: false,
      attempts: 0,
      candidates: [],
      validCandidates: [],
      testResults: [],
      error: `计算错误：当前长度 ${currentLength}，中文字符 ${chineseLength} 个，目标长度 ${targetLength}，计算出的替换长度为 ${missingLength}。`
    };
  }

  const defaultPrompt = `你是一个 API key 修复专家。用户的 API key 在传输过程中部分字符被替换成了异常字符。

原始损坏的 key: ${corruptedKey}
其中的异常字符部分: "${chineseText}"（${chineseLength} 个异常字符）
key 的正确总长度应该是: ${targetLength} 个字符
当前 key 长度: ${currentLength} 个字符
异常字符部分"${chineseText}"需要替换成: ${missingLength} 个正常字符

计算逻辑：${targetLength} - ${currentLength} + ${chineseLength} = ${missingLength}

请分析异常字符"${chineseText}"的含义或可能的原因，推断它最可能对应的 ${missingLength} 个正常字符是什么。

推断规则:
1. 如果是中文，根据中文含义推断对应的英文（如"人工智能" → "AI"、"ai"、"Ai"）
2. 如果是特殊符号（如 %、&、#），考虑可能是哪些字母或数字被误替换
3. 考虑键盘布局相近的字符（如 % 可能是 5、^、& 等）
4. 考虑可能的大小写组合
5. 考虑可能的缩写形式
6. 考虑可能的谐音表达（如"谢谢" = "3Q"）
7. 可以包含数字（如 3Q、2B、4U 等）
8. API key 通常只包含字母（a-z, A-Z）、数字（0-9）、连字符（-）和下划线（_）`;

  const basePrompt = customPrompt || defaultPrompt;

  const excludeSection = previousCandidates && previousCandidates.length > 0
    ? `\n\n以下候选已经尝试过且失败，请不要再生成这些：\n${previousCandidates.join(", ")}`
    : "";

  const finalPrompt = `${basePrompt}${excludeSection}

---

关键要求（必须遵守）：
1. 输出的字符数必须正好是 ${missingLength} 个
2. 只输出推断的字符组合，每行一个
3. 不要有任何解释、说明或其他文字
4. 给出 ${maxCandidates || 50} 个候选，按可能性从高到低排序
5. 不要有编号、符号或格式标记`;

  const prompt = finalPrompt;

  try {
    const aiKey = await getAvailableAIKey(keyId);

    if (!aiKey) {
      return {
        success: false,
        attempts: 0,
        candidates: [],
        error: keyId
          ? "指定的 key 不可用或不是 Claude key，请选择其他 key。"
          : "未找到可用的 Claude key，请先添加并测试一个可用的 key。"
      };
    }

    const selectedModel = model || aiKey.model || "claude-sonnet-4-6";

    const aiResponse = await fetch(new URL("/v1/messages", aiKey.baseUrl), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": aiKey.secret,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: selectedModel,
        max_tokens: 4096,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text().catch(() => "");
      return {
        success: false,
        attempts: 0,
        candidates: [],
        error: `AI 推断失败: ${aiResponse.status} ${errorText}`
      };
    }

    const aiResult = (await aiResponse.json()) as {
      content: Array<{ type: string; text: string }>;
    };

    const aiText = aiResult.content[0]?.text || "";

    const candidates = aiText
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length === missingLength && /^[a-zA-Z0-9]+$/.test(line));

    if (candidates.length === 0) {
      return {
        success: false,
        attempts: 0,
        candidates: [],
        validCandidates: [],
        error: `AI 未能生成有效的候选（需要 ${missingLength} 个字符）。AI 输出: ${aiText.slice(0, 200)}`
      };
    }

    let attempt = 0;
    const validCandidates: string[] = [];
    const testedCandidates = new Set<string>();
    const testResults: Array<{ candidate: string; status: "testing" | "success" | "failed" }> = [];

    for (const candidate of candidates) {
      if (testedCandidates.has(candidate)) {
        continue;
      }

      testedCandidates.add(candidate);
      attempt++;

      const repairedKey = corruptedKey.replace(chineseText, candidate);

      if (repairedKey.length !== targetLength) {
        testResults.push({ candidate, status: "failed" });
        continue;
      }

      const isValid = await testKeyValidity(repairedKey, baseUrl, protocol);

      if (isValid) {
        validCandidates.push(candidate);
        testResults.push({ candidate, status: "success" });

        // 找到可用的就立即返回
        return {
          success: true,
          repairedKey: corruptedKey.replace(chineseText, validCandidates[0]),
          attempts: attempt,
          candidates,
          validCandidates,
          testResults,
        };
      } else {
        testResults.push({ candidate, status: "failed" });
      }
    }

    return {
      success: false,
      attempts: attempt,
      candidates,
      validCandidates: [],
      testResults,
      error: `测试了 ${attempt} 个 AI 生成的候选，但均未通过验证。`
    };
  } catch (error) {
    return {
      success: false,
      attempts: 0,
      candidates: [],
      error: error instanceof Error ? error.message : "未知错误"
    };
  }
}

async function testKeyValidity(
  key: string,
  baseUrl: string,
  protocol: "anthropic" | "openai",
): Promise<boolean> {
  try {
    if (protocol === "anthropic") {
      const response = await fetch(new URL("/v1/models", baseUrl), {
        method: "GET",
        headers: {
          "anthropic-version": "2023-06-01",
          authorization: `Bearer ${key}`,
          "x-api-key": key,
        },
        signal: AbortSignal.timeout(10000),
      });
      return response.ok;
    } else {
      const response = await fetch(new URL("/models", baseUrl), {
        method: "GET",
        headers: {
          authorization: `Bearer ${key}`,
        },
        signal: AbortSignal.timeout(10000),
      });
      return response.ok;
    }
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  const session = await getSessionOrNull();

  if (!session?.user) {
    return NextResponse.json({ message: "请先登录。" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      corruptedKey: string;
      baseUrl?: string;
      protocol?: "anthropic" | "openai";
      keyId?: string;
      model?: string;
      customPrompt?: string;
      previousCandidates?: string[];
      maxCandidates?: number;
    };

    const { corruptedKey, baseUrl = "https://new.timefiles.online", protocol = "anthropic", keyId, model, customPrompt, previousCandidates, maxCandidates = 50 } = body;

    if (!corruptedKey || corruptedKey.length < 10) {
      return NextResponse.json(
        { message: "请提供有效的损坏 key。" },
        { status: 400 },
      );
    }

    const chinesePositions = extractChinesePositions(corruptedKey);

    if (chinesePositions.length === 0) {
      return NextResponse.json(
        { message: "未检测到异常字符，key 可能未损坏。API key 通常只包含字母、数字、连字符和下划线。" },
        { status: 400 },
      );
    }

    const chineseText = chinesePositions.map((p) => p.char).join("");
    const targetLength = 51;

    const result = await repairKeyWithAI(
      corruptedKey,
      chineseText,
      targetLength,
      baseUrl,
      protocol,
      keyId,
      model,
      customPrompt,
      previousCandidates,
      maxCandidates,
    );

    if (result.success && result.repairedKey) {
      return NextResponse.json({
        success: true,
        repairedKey: result.repairedKey,
        attempts: result.attempts,
        candidates: result.candidates,
        validCandidates: result.validCandidates,
        testResults: result.testResults,
        message: `成功修复 key！AI 生成了 ${result.candidates?.length || 0} 个候选，测试了 ${result.attempts} 个，找到可用的 key。`,
      });
    }

    return NextResponse.json({
      success: false,
      attempts: result.attempts,
      candidates: result.candidates,
      validCandidates: result.validCandidates,
      testResults: result.testResults,
      message: result.error || `AI 推断了 ${result.candidates?.length || 0} 个候选，测试了 ${result.attempts} 个，但均未通过验证。`,
    });
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "修复失败,请稍后再试。",
      },
      { status: 500 },
    );
  }
}
