import type { ManagedKey } from "@prisma/client";
import type { ManagedKeyListItem, ManagedKeyTestResult, ManagedKeyProtocol } from "@/features/managed-keys/types";
import { joinBaseUrl } from "./utils";
import {
  discoverAnthropicModels,
  discoverOpenAiModels,
  buildModelsToTest,
  parseProviderResponse,
  extractProviderContent,
  buildEmptyProviderResponseMessage,
  buildProviderRequestErrorMessage,
  buildAttemptSummary,
  calculateAverageLatency,
  summarizeTagAvailability,
  buildCombinedTestMessage,
  pickDiscoveredModel,
  extractErrorMessage,
} from "./discovery";

const TEST_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export function shouldSkipTest(key: ManagedKey): boolean {
  if (!key.lastTestAt || key.lastTestStatus !== "success") {
    return false;
  }
  const lastTest = key.lastTestAt.getTime();
  return Date.now() - lastTest < TEST_CACHE_DURATION;
}

export async function testAnthropicKey(
  key: ManagedKeyListItem,
  globalPreferredModels: string[],
  exhaustiveModelTesting: boolean,
): Promise<ManagedKeyTestResult> {
  const discovered = await discoverAnthropicModels(key);
  const modelsToTest = buildModelsToTest(
    key,
    discovered.ids,
    globalPreferredModels,
    exhaustiveModelTesting,
  );

  if (!discovered.response.ok) {
    return {
      ok: false,
      message:
        extractErrorMessage(discovered.body) ??
        `模型列表请求失败（HTTP ${discovered.response.status}）`,
      statusCode: discovered.response.status,
      testedAt: new Date().toISOString(),
      discoveredModel: null,
      discoveredModels: discovered.ids,
      attemptedModels: [],
    };
  }

  if (modelsToTest.length === 0) {
    return {
      ok: true,
      message:
        discovered.ids.length > 0
          ? globalPreferredModels.length > 0
            ? "模型列表访问成功，但未命中全局优先模型；已完成可用模型扫描。"
            : "模型列表访问成功，但尚未配置全局优先模型；已完成可用模型扫描。"
          : "模型列表访问成功，但没有识别出可测试模型。",
      statusCode: discovered.response.status,
      testedAt: new Date().toISOString(),
      discoveredModel: null,
      discoveredModels: discovered.ids,
      attemptedModels: [],
    };
  }

  const attempts: ManagedKeyTestResult["attemptedModels"] = [];
  let lastFailureMessage: string | null = null;
  let lastStatusCode: number | null = discovered.response.status;
  let successfulModel: string | null = null;
  let successfulPreferredModel: string | null = null;

  for (const candidate of modelsToTest) {
    const startTime = Date.now();
    const response = await fetch(joinBaseUrl(key.baseUrl, "/v1/messages"), {
      method: "POST",
      headers: {
        "anthropic-version": "2023-06-01",
        authorization: `Bearer ${key.secret}`,
        "content-type": "application/json",
        "x-api-key": key.secret,
      },
      body: JSON.stringify({
        model: candidate.model,
        max_tokens: 12,
        messages: [{ role: "user", content: "ping" }],
      }),
      signal: AbortSignal.timeout(20000),
    });

    const latency = Date.now() - startTime;
    const providerResponse = await parseProviderResponse(response);
    const content = extractProviderContent(providerResponse, "anthropic");

    if (response.ok && content) {
      attempts.push({
        model: candidate.model,
        ok: true,
        statusCode: response.status,
        message: "测试成功",
        source: candidate.source,
        latency,
      });
      successfulModel ??= candidate.model;
      if (candidate.source === "preferred") {
        successfulPreferredModel ??= candidate.model;
      }
      continue;
    }

    lastFailureMessage = response.ok
      ? buildEmptyProviderResponseMessage(providerResponse, "anthropic")
      : buildProviderRequestErrorMessage(
          providerResponse,
          `消息测试失败（HTTP ${response.status}）`,
        );
    lastStatusCode = response.status;
    attempts.push({
      model: candidate.model,
      ok: false,
      statusCode: response.status,
      message: lastFailureMessage,
      source: candidate.source,
      latency,
    });
  }

  const passedPreferredModels = attempts
    .filter((attempt) => attempt.ok && attempt.source === "preferred")
    .map((attempt) => attempt.model);

  if (successfulModel) {
    const primaryModel = successfulPreferredModel ?? successfulModel;
    const successLabel =
      passedPreferredModels.length > 0
        ? `Claude 可用（全局优先模型通过：${passedPreferredModels.join("、")}）`
        : `Claude 可用（测试模型：${primaryModel}）`;
    const attemptSummary = buildAttemptSummary(attempts);
    const avgLatency = calculateAverageLatency(attempts);
    const latencyInfo = avgLatency ? ` 平均延迟：${avgLatency}ms` : "";

    return {
      ok: true,
      message: attemptSummary ? `${successLabel}${latencyInfo}\n覆盖测试：${attemptSummary}` : `${successLabel}${latencyInfo}`,
      statusCode: 200,
      testedAt: new Date().toISOString(),
      discoveredModel: primaryModel,
      discoveredModels: discovered.ids,
      attemptedModels: attempts,
      averageLatency: avgLatency,
    };
  }

  return {
    ok: false,
    message: lastFailureMessage ?? "消息测试失败，请稍后再试。",
    statusCode: lastStatusCode,
    testedAt: new Date().toISOString(),
    discoveredModel: null,
    discoveredModels: discovered.ids,
    attemptedModels: attempts,
  };
}

export async function testOpenAiKey(
  key: ManagedKeyListItem,
  globalPreferredModels: string[],
  exhaustiveModelTesting: boolean,
): Promise<ManagedKeyTestResult> {
  const discovered = await discoverOpenAiModels(key);
  const modelsToTest = buildModelsToTest(
    key,
    discovered.ids,
    globalPreferredModels,
    exhaustiveModelTesting,
  );

  if (!discovered.response.ok) {
    return {
      ok: false,
      message:
        extractErrorMessage(discovered.body) ??
        `模型列表请求失败（HTTP ${discovered.response.status}）`,
      statusCode: discovered.response.status,
      testedAt: new Date().toISOString(),
      discoveredModel: null,
      discoveredModels: discovered.ids,
      attemptedModels: [],
    };
  }

  if (modelsToTest.length === 0) {
    return {
      ok: true,
      message:
        discovered.ids.length > 0
          ? globalPreferredModels.length > 0
            ? "模型列表访问成功，但未命中全局优先模型；已完成可用模型扫描。"
            : "模型列表访问成功，但尚未配置全局优先模型；已完成可用模型扫描。"
          : "模型列表访问成功，但没有识别出可测试模型。",
      statusCode: discovered.response.status,
      testedAt: new Date().toISOString(),
      discoveredModel: null,
      discoveredModels: discovered.ids,
      attemptedModels: [],
    };
  }

  const attempts: ManagedKeyTestResult["attemptedModels"] = [];
  let lastFailureMessage: string | null = null;
  let lastStatusCode: number | null = discovered.response.status;
  let successfulModel: string | null = null;
  let successfulPreferredModel: string | null = null;

  for (const candidate of modelsToTest) {
    const startTime = Date.now();
    const response = await fetch(joinBaseUrl(key.baseUrl, "/chat/completions"), {
      method: "POST",
      headers: {
        authorization: `Bearer ${key.secret}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: candidate.model,
        max_tokens: 12,
        messages: [{ role: "user", content: "ping" }],
      }),
      signal: AbortSignal.timeout(20000),
    });

    const latency = Date.now() - startTime;
    const providerResponse = await parseProviderResponse(response);

    // Treat HTML responses as errors (likely error pages or redirects)
    const isHtmlResponse = providerResponse.contentType?.includes("text/html");
    const content = isHtmlResponse ? "" : extractProviderContent(providerResponse, "openai");

    if (response.ok && content && !isHtmlResponse) {
      attempts.push({
        model: candidate.model,
        ok: true,
        statusCode: response.status,
        message: "测试成功",
        source: candidate.source,
        latency,
      });
      successfulModel ??= candidate.model;
      if (candidate.source === "preferred") {
        successfulPreferredModel ??= candidate.model;
      }
      continue;
    }

    lastFailureMessage = response.ok
      ? buildEmptyProviderResponseMessage(providerResponse, "openai")
      : buildProviderRequestErrorMessage(
          providerResponse,
          `消息测试失败（HTTP ${response.status}）`,
        );
    lastStatusCode = response.status;
    attempts.push({
      model: candidate.model,
      ok: false,
      statusCode: response.status,
      message: lastFailureMessage,
      source: candidate.source,
      latency,
    });
  }

  const passedPreferredModels = attempts
    .filter((attempt) => attempt.ok && attempt.source === "preferred")
    .map((attempt) => attempt.model);

  if (successfulModel) {
    const primaryModel = successfulPreferredModel ?? successfulModel;
    const successLabel =
      passedPreferredModels.length > 0
        ? `Codex 可用（全局优先模型通过：${passedPreferredModels.join("、")}）`
        : `Codex 可用（测试模型：${primaryModel}）`;
    const attemptSummary = buildAttemptSummary(attempts);
    const avgLatency = calculateAverageLatency(attempts);
    const latencyInfo = avgLatency ? ` 平均延迟：${avgLatency}ms` : "";

    return {
      ok: true,
      message: attemptSummary ? `${successLabel}${latencyInfo}\n覆盖测试：${attemptSummary}` : `${successLabel}${latencyInfo}`,
      statusCode: 200,
      testedAt: new Date().toISOString(),
      discoveredModel: primaryModel,
      discoveredModels: discovered.ids,
      attemptedModels: attempts,
      averageLatency: avgLatency,
    };
  }

  return {
    ok: false,
    message: lastFailureMessage ?? "消息测试失败，请稍后再试。",
    statusCode: lastStatusCode,
    testedAt: new Date().toISOString(),
    discoveredModel: null,
    discoveredModels: discovered.ids,
    attemptedModels: attempts,
  };
}

export function buildTestInputByProtocol(
  key: ManagedKeyListItem,
  protocol: ManagedKeyProtocol,
): ManagedKeyListItem {
  return {
    ...key,
    protocol,
    group: protocol === "openai" ? "codex" : "claude",
  };
}

export async function runProtocolTest(
  key: ManagedKeyListItem,
  protocol: ManagedKeyProtocol,
  globalPreferredModels: string[],
  exhaustiveModelTesting: boolean,
): Promise<ManagedKeyTestResult> {
  try {
    const candidate = buildTestInputByProtocol(key, protocol);
    return protocol === "anthropic"
      ? await testAnthropicKey(candidate, globalPreferredModels, exhaustiveModelTesting)
      : await testOpenAiKey(candidate, globalPreferredModels, exhaustiveModelTesting);
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "请求失败，请稍后再试。",
      statusCode: null,
      testedAt: new Date().toISOString(),
      discoveredModel: null,
      discoveredModels: [],
      attemptedModels: [],
    };
  }
}

export async function testManagedKeyWithCache(
  key: ManagedKey,
  toListItem: (key: ManagedKey) => ManagedKeyListItem,
  globalPreferredModels: string[],
  exhaustiveModelTesting: boolean,
): Promise<{ result: ManagedKeyTestResult; key: ManagedKeyListItem }> {
  // Check cache
  if (shouldSkipTest(key)) {
    const listItem = toListItem(key);
    return {
      result: {
        ok: key.lastTestStatus === "success",
        message: key.lastTestMessage ?? "使用缓存的测试结果",
        statusCode: key.lastTestStatus === "success" ? 200 : null,
        testedAt: key.lastTestAt?.toISOString() ?? new Date().toISOString(),
        discoveredModel: key.model,
        discoveredModels: JSON.parse(key.availableModels || "[]") as string[],
        attemptedModels: [],
        fromCache: true,
      } as ManagedKeyTestResult,
      key: listItem,
    };
  }

  const listItem = toListItem(key);
  const [anthropicResult, openAiResult] = await Promise.all([
    runProtocolTest(listItem, "anthropic", globalPreferredModels, exhaustiveModelTesting),
    runProtocolTest(listItem, "openai", globalPreferredModels, exhaustiveModelTesting),
  ]);

  const protocolResults = [anthropicResult, openAiResult];
  const claudeSummary = summarizeTagAvailability({
    tag: "claude",
    results: protocolResults,
  });
  const codexSummary = summarizeTagAvailability({
    tag: "codex",
    results: protocolResults,
  });

  const combinedMessage = buildCombinedTestMessage({
    claudeSummary,
    codexSummary,
    anthropicResult,
    openAiResult,
  });

  const discoveredModels = [...new Set([
    ...anthropicResult.discoveredModels,
    ...openAiResult.discoveredModels,
  ])];
  const overallOk = claudeSummary.ok || codexSummary.ok;
  const preferredDiscoveredModel =
    listItem.group === "claude"
      ? claudeSummary.discoveredModel ?? codexSummary.discoveredModel
      : codexSummary.discoveredModel ?? claudeSummary.discoveredModel;
  const discoveredModel =
    overallOk
      ? preferredDiscoveredModel ?? pickDiscoveredModel(discoveredModels, listItem.group)
      : null;

  const allAttempts = [
    ...anthropicResult.attemptedModels,
    ...openAiResult.attemptedModels,
  ];
  const avgLatency = calculateAverageLatency(allAttempts);

  const result: ManagedKeyTestResult = {
    ...anthropicResult,
    ok: overallOk,
    message: combinedMessage,
    statusCode: overallOk
      ? 200
      : anthropicResult.statusCode ?? openAiResult.statusCode,
    testedAt: new Date().toISOString(),
    discoveredModel,
    discoveredModels,
    averageLatency: avgLatency,
    fromCache: false,
  };

  return { result, key: listItem };
}
