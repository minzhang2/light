import { prisma } from "@/lib/prisma";
import type { ManagedKeyListItem } from "@/features/managed-keys/types";
import type {
  ChatCompletionResult,
  ChatKeyOption,
  ChatMessageInput,
} from "@/features/chat/types";

function joinBaseUrl(baseUrl: string, path: string) {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL(path.replace(/^\//, ""), normalizedBase);
}

function dedupeModels(model: string | null, availableModels: string[]) {
  return [...new Set([model, ...availableModels].filter((value): value is string => Boolean(value)))];
}

function parseStringArray(value: string | null) {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as string[];
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function normalizeChatMessages(messages: ChatMessageInput[]) {
  return messages
    .filter((item) => item.role === "user" || item.role === "assistant")
    .map((item) => ({
      role: item.role,
      content: item.content.trim(),
    }))
    .filter((item) => item.content.length > 0)
    .slice(-20);
}

function extractErrorMessage(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  if ("error" in payload && payload.error && typeof payload.error === "object") {
    const error = payload.error as { message?: string };
    return error.message ?? null;
  }

  if ("message" in payload && typeof payload.message === "string") {
    return payload.message;
  }

  return null;
}

function extractAnthropicText(payload: unknown) {
  if (!payload || typeof payload !== "object" || !("content" in payload)) {
    return "";
  }

  const content = (payload as { content?: Array<{ type?: string; text?: string }> }).content;

  if (!Array.isArray(content)) {
    return "";
  }

  return content
    .filter((item) => item?.type === "text" && typeof item.text === "string")
    .map((item) => item.text)
    .join("\n")
    .trim();
}

function extractOpenAiText(payload: unknown) {
  if (!payload || typeof payload !== "object" || !("choices" in payload)) {
    return "";
  }

  const choices = (payload as {
    choices?: Array<{
      message?: {
        content?:
          | string
          | Array<{ type?: string; text?: string | { value?: string } }>;
      };
    }>;
  }).choices;

  const content = choices?.[0]?.message?.content;

  if (typeof content === "string") {
    return content.trim();
  }

  if (!Array.isArray(content)) {
    return "";
  }

  return content
    .map((item) => {
      if (!item || item.type !== "text") {
        return "";
      }

      if (typeof item.text === "string") {
        return item.text;
      }

      return item.text?.value ?? "";
    })
    .join("\n")
    .trim();
}

export function toChatKeyOption(key: ManagedKeyListItem): ChatKeyOption | null {
  if (key.lastTestStatus !== "success") {
    return null;
  }

  const models = dedupeModels(key.model, key.availableModels);
  const defaultModel = models[0];

  if (!defaultModel) {
    return null;
  }

  return {
    id: key.id,
    name: key.name,
    group: key.group,
    protocol: key.protocol,
    models,
    defaultModel,
  };
}

export async function createChatCompletion(input: {
  keyId: string;
  model: string;
  messages: ChatMessageInput[];
}): Promise<ChatCompletionResult> {
  const key = await prisma.managedKey.findUnique({
    where: { id: input.keyId },
    select: {
      id: true,
      name: true,
      protocol: true,
      baseUrl: true,
      secret: true,
      model: true,
      availableModels: true,
      lastTestStatus: true,
    },
  });

  if (!key) {
    throw new Error("未找到对应的 key。");
  }

  if (key.lastTestStatus !== "success") {
    throw new Error("当前 key 尚未通过可用性测试。");
  }

  const messages = normalizeChatMessages(input.messages);

  if (messages.length === 0) {
    throw new Error("至少需要一条有效消息。");
  }

  const allowedModels = dedupeModels(
    key.model,
    parseStringArray(key.availableModels),
  );

  if (!allowedModels.includes(input.model)) {
    throw new Error("当前模型不属于所选 key 的可用模型。");
  }

  if (key.protocol === "anthropic") {
    const response = await fetch(joinBaseUrl(key.baseUrl, "/v1/messages"), {
      method: "POST",
      headers: {
        "anthropic-version": "2023-06-01",
        authorization: `Bearer ${key.secret}`,
        "content-type": "application/json",
        "x-api-key": key.secret,
      },
      body: JSON.stringify({
        model: input.model,
        max_tokens: 2048,
        messages,
      }),
      signal: AbortSignal.timeout(30000),
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(
        extractErrorMessage(payload) ?? `聊天请求失败（HTTP ${response.status}）`,
      );
    }

    const content = extractAnthropicText(payload);

    if (!content) {
      throw new Error("模型返回为空。");
    }

    return {
      content,
      model: input.model,
      keyName: key.name,
    };
  }

  const response = await fetch(joinBaseUrl(key.baseUrl, "/chat/completions"), {
    method: "POST",
    headers: {
      authorization: `Bearer ${key.secret}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: input.model,
      messages,
    }),
    signal: AbortSignal.timeout(30000),
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      extractErrorMessage(payload) ?? `聊天请求失败（HTTP ${response.status}）`,
    );
  }

  const content = extractOpenAiText(payload);

  if (!content) {
    throw new Error("模型返回为空。");
  }

  return {
    content,
    model: input.model,
    keyName: key.name,
  };
}
