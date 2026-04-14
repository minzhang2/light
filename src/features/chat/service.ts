import { prisma } from "@/lib/prisma";
import type { ManagedKeyListItem } from "@/features/managed-keys/types";
import {
  extractAnthropicText,
  extractOpenAiText,
  extractTextFromValue,
} from "@/lib/provider-response-parser";
import type {
  ChatAttachmentInput,
  ChatCompletionResult,
  ChatKeyOption,
  ChatMessageInput,
  ChatSessionDetail,
  ChatSessionListItem,
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

function isImageMimeType(mimeType: string) {
  return mimeType.startsWith("image/");
}

function isPdfMimeType(mimeType: string) {
  return mimeType === "application/pdf";
}

function isTextLikeAttachment(attachment: ChatAttachmentInput) {
  if (attachment.mimeType.startsWith("text/")) {
    return true;
  }

  return [
    "application/json",
    "application/ld+json",
    "application/xml",
    "application/javascript",
    "application/typescript",
    "application/x-javascript",
    "application/x-typescript",
    "application/yaml",
    "application/x-yaml",
  ].includes(attachment.mimeType);
}

function attachmentToDataUrl(attachment: ChatAttachmentInput) {
  return `data:${attachment.mimeType};base64,${attachment.data}`;
}

function decodeAttachmentText(attachment: ChatAttachmentInput) {
  return Buffer.from(attachment.data, "base64").toString("utf-8");
}

function formatAttachmentSummary(attachments: ChatAttachmentInput[]) {
  if (attachments.length === 0) {
    return "";
  }

  return attachments
    .map((attachment) => `- ${attachment.name} (${attachment.mimeType || "application/octet-stream"})`)
    .join("\n");
}

function buildStoredUserContent(content: string, attachments: ChatAttachmentInput[]) {
  const trimmedContent = content.trim();
  const attachmentSummary = formatAttachmentSummary(attachments);

  if (!attachmentSummary) {
    return trimmedContent;
  }

  if (!trimmedContent) {
    return `[本次临时附件]\n${attachmentSummary}`;
  }

  return `${trimmedContent}\n\n[本次临时附件]\n${attachmentSummary}`;
}

function buildAnthropicMessages(
  messages: ChatMessageInput[],
  attachments: ChatAttachmentInput[],
) {
  if (attachments.length === 0) {
    return messages;
  }

  const lastIndex = messages.length - 1;
  const lastMessage = messages[lastIndex];

  if (!lastMessage || lastMessage.role !== "user") {
    return messages;
  }

  const contentBlocks: Array<
    | { type: "text"; text: string }
    | {
        type: "image";
        source: {
          type: "base64";
          media_type: string;
          data: string;
        };
      }
    | {
        type: "document";
        source: {
          type: "base64";
          media_type: string;
          data: string;
        };
      }
  > = [];

  if (lastMessage.content.trim()) {
    contentBlocks.push({ type: "text", text: lastMessage.content.trim() });
  }

  for (const attachment of attachments) {
    if (isImageMimeType(attachment.mimeType)) {
      contentBlocks.push({
        type: "image",
        source: {
          type: "base64",
          media_type: attachment.mimeType,
          data: attachment.data,
        },
      });
      continue;
    }

    if (isPdfMimeType(attachment.mimeType)) {
      contentBlocks.push({
        type: "document",
        source: {
          type: "base64",
          media_type: attachment.mimeType,
          data: attachment.data,
        },
      });
      continue;
    }

    if (isTextLikeAttachment(attachment)) {
      contentBlocks.push({
        type: "text",
        text: `文件：${attachment.name}\n\n${decodeAttachmentText(attachment)}`,
      });
      continue;
    }

    throw new Error(`当前模型暂不支持文件类型：${attachment.name}`);
  }

  if (contentBlocks.length === 0) {
    return messages;
  }

  return messages.map((message, index) =>
    index === lastIndex
      ? {
          role: message.role,
          content: contentBlocks,
        }
      : message,
  );
}

function buildOpenAiMessages(
  messages: ChatMessageInput[],
  attachments: ChatAttachmentInput[],
) {
  if (attachments.length === 0) {
    return messages;
  }

  const lastIndex = messages.length - 1;
  const lastMessage = messages[lastIndex];

  if (!lastMessage || lastMessage.role !== "user") {
    return messages;
  }

  const contentParts: Array<
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string } }
    | { type: "file"; file: { filename: string; file_data: string } }
  > = [];

  if (lastMessage.content.trim()) {
    contentParts.push({ type: "text", text: lastMessage.content.trim() });
  }

  for (const attachment of attachments) {
    if (isImageMimeType(attachment.mimeType)) {
      contentParts.push({
        type: "image_url",
        image_url: {
          url: attachmentToDataUrl(attachment),
        },
      });
      continue;
    }

    contentParts.push({
      type: "file",
      file: {
        filename: attachment.name,
        file_data: attachmentToDataUrl(attachment),
      },
    });
  }

  if (contentParts.length === 0) {
    return messages;
  }

  return messages.map((message, index) =>
    index === lastIndex
      ? {
          role: message.role,
          content: contentParts,
        }
      : message,
  );
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

type ProviderResponseFormat = "json" | "event-stream" | "text" | "empty";

type ParsedProviderResponse = {
  payload: unknown;
  rawText: string;
  contentType: string | null;
  format: ProviderResponseFormat;
};

function formatProviderRawText(rawText: string, limit = 600) {
  const normalized = rawText.replace(/\s+/g, " ").trim();

  if (!normalized) {
    return "";
  }

  return normalized.length > limit
    ? `${normalized.slice(0, limit)}...`
    : normalized;
}

function appendProviderRawText(message: string, response: ParsedProviderResponse) {
  const snippet = formatProviderRawText(response.rawText);

  if (!snippet) {
    return message;
  }

  return `${message} 上游返回：${snippet}`;
}

async function parseProviderResponse(response: Response): Promise<ParsedProviderResponse> {
  const contentType = response.headers.get("content-type");
  const rawText = (await response.text().catch(() => "")).trim();

  if (!rawText) {
    return {
      payload: null,
      rawText: "",
      contentType,
      format: "empty",
    };
  }

  try {
    return {
      payload: JSON.parse(rawText) as unknown,
      rawText,
      contentType,
      format: "json",
    };
  } catch {
    if (contentType?.includes("text/event-stream") || /^data:/m.test(rawText)) {
      return {
        payload: null,
        rawText,
        contentType,
        format: "event-stream",
      };
    }

    return {
      payload: null,
      rawText,
      contentType,
      format: "text",
    };
  }
}

function extractTextFromEventStreamChunk(chunk: string, protocol: "anthropic" | "openai") {
  const trimmed = chunk.trim();

  if (!trimmed || trimmed === "[DONE]") {
    return "";
  }

  try {
    const payload = JSON.parse(trimmed) as unknown;
    return protocol === "anthropic"
      ? extractAnthropicText(payload)
      : extractOpenAiText(payload);
  } catch {
    return "";
  }
}

function extractTextFromEventStream(rawText: string, protocol: "anthropic" | "openai") {
  return rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("data:"))
    .map((line) => extractTextFromEventStreamChunk(line.slice("data:".length), protocol))
    .filter(Boolean)
    .join("")
    .trim();
}

function extractProviderContent(
  response: ParsedProviderResponse,
  protocol: "anthropic" | "openai",
) {
  if (response.format === "json") {
    return protocol === "anthropic"
      ? extractAnthropicText(response.payload)
      : extractOpenAiText(response.payload);
  }

  if (response.format === "event-stream") {
    return extractTextFromEventStream(response.rawText, protocol);
  }

  if (response.format === "text" && response.contentType?.startsWith("text/plain")) {
    return response.rawText;
  }

  return "";
}

function buildEmptyProviderResponseMessage(
  response: ParsedProviderResponse,
  protocol: "anthropic" | "openai",
) {
  const providerLabel = protocol === "anthropic" ? "Claude" : "Codex";

  if (response.format === "empty") {
    return appendProviderRawText(`${providerLabel} 接口返回了空响应体，请先重新测试 key。`, response);
  }

  if (response.format === "event-stream") {
    return appendProviderRawText(`${providerLabel} 接口返回了流式响应，但未解析出文本内容，请先重新测试 key。`, response);
  }

  if (response.format === "text") {
    const message = response.contentType?.startsWith("text/plain")
      ? `${providerLabel} 接口返回了纯文本响应，但内容为空，请先重新测试 key。`
      : `${providerLabel} 接口返回格式无法识别（${response.contentType ?? "unknown"}），请先重新测试 key。`;

    return appendProviderRawText(message, response);
  }

  return appendProviderRawText(
    `${providerLabel} 接口返回成功，但未解析出文本内容，请先重新测试 key。`,
    response,
  );
}

function buildProviderRequestErrorMessage(
  response: ParsedProviderResponse,
  status: number,
  fallback: string,
) {
  const baseMessage = extractErrorMessage(response.payload) ?? fallback;
  return appendProviderRawText(baseMessage, response);
}

function extractCommonPayloadText(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return "";
  }

  const record = payload as {
    content?: unknown;
    message?: unknown;
    output?: unknown;
    output_text?: unknown;
    completion?: unknown;
    candidates?: unknown;
  };

  return (
    extractTextFromValue(record.content) ||
    extractTextFromValue(record.message) ||
    extractTextFromValue(record.output) ||
    extractTextFromValue(record.output_text) ||
    extractTextFromValue(record.completion) ||
    extractTextFromValue(record.candidates)
  );
}

function normalizeProviderLabels(message: string) {
  const normalized = message
    .replaceAll("Anthropic", "Claude")
    .replaceAll("OpenAI", "Codex")
    .replaceAll("Claude 协议可用", "Claude 可用")
    .replaceAll("Codex 协议可用", "Codex 可用");

  return normalized
    .replace(/Claude\s*可用（测试模型：([^）]+)）/g, (_all, model: string) =>
      isClaudeModel(model)
        ? `Claude 可用（测试模型：${model}）`
        : `Codex 可用（测试模型：${model}）`,
    )
    .replace(/Codex\s*可用（测试模型：([^）]+)）/g, (_all, model: string) =>
      isClaudeModel(model)
        ? `Claude 可用（测试模型：${model}）`
        : `Codex 可用（测试模型：${model}）`,
    );
}

function getSupportedTags(message: string | null) {
  if (!message) {
    return {
      anthropic: false,
      openai: false,
    };
  }

  const normalizedMessage = normalizeProviderLabels(message);
  const hasClaude =
    /Claude\s*可用(?:（测试模型：|，测试模型：)/.test(normalizedMessage) ||
    /Claude\s*模型测试：(?!(?:未验证|无可测模型))/.test(normalizedMessage);
  const hasCodex =
    /Codex\s*可用(?:（测试模型：|，测试模型：)/.test(normalizedMessage) ||
    /Codex\s*模型测试：(?!(?:未验证|无可测模型))/.test(normalizedMessage);

  return {
    anthropic: hasClaude,
    openai: hasCodex,
  };
}

function isClaudeModel(model: string) {
  return /(claude|sonnet|opus|haiku)/i.test(model);
}

function pickRequestProtocol(input: {
  model: string;
  tags: { anthropic: boolean; openai: boolean };
}) {
  const { tags } = input;

  if (tags.anthropic && !tags.openai) {
    return "anthropic" as const;
  }

  if (tags.openai && !tags.anthropic) {
    return "openai" as const;
  }

  if (tags.anthropic && tags.openai) {
    return isClaudeModel(input.model) ? "anthropic" : "openai";
  }

  return null;
}

export function toChatKeyOption(key: ManagedKeyListItem): ChatKeyOption | null {
  if (!key.isTestable) {
    return null;
  }

  if (key.lastTestStatus !== "success") {
    return null;
  }

  const models = dedupeModels(key.model, key.availableModels);
  const defaultModel = models[0];

  if (!defaultModel) {
    return null;
  }

  const supportedTags = getSupportedTags(key.lastTestMessage);
  const supportsClaude = supportedTags.anthropic;
  const supportsCodex = supportedTags.openai;

  return {
    id: key.id,
    name: key.name,
    group: key.group,
    supportsClaude,
    supportsCodex,
    models,
    defaultModel,
  };
}

export async function createChatCompletion(input: {
  keyId: string;
  model: string;
  messages: ChatMessageInput[];
  attachments?: ChatAttachmentInput[];
  signal?: AbortSignal;
}): Promise<ChatCompletionResult> {
  const key = await prisma.managedKey.findUnique({
    where: { id: input.keyId },
    select: {
      id: true,
      name: true,
      isTestable: true,
      baseUrl: true,
      secret: true,
      model: true,
      availableModels: true,
      lastTestStatus: true,
      lastTestMessage: true,
    },
  });

  if (!key) {
    throw new Error("未找到对应的 key。");
  }

  if (key.lastTestStatus !== "success") {
    throw new Error("当前 key 尚未通过可用性测试。");
  }

  if (!key.isTestable) {
    throw new Error("当前 key 已禁用测试，不可用于聊天。");
  }

  const messages = normalizeChatMessages(input.messages);
  const attachments = input.attachments ?? [];

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

  const timeoutSignal = AbortSignal.timeout(30000);
  const requestSignal = input.signal
    ? AbortSignal.any([input.signal, timeoutSignal])
    : timeoutSignal;
  const supportedTags = getSupportedTags(key.lastTestMessage);
  const requestProtocol = pickRequestProtocol({
    model: input.model,
    tags: supportedTags,
  });

  if (!requestProtocol) {
    throw new Error("当前 key 未识别到可用标签，请先重新测试。");
  }

  if (requestProtocol === "anthropic") {
    const requestMessages = buildAnthropicMessages(messages, attachments);

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
        messages: requestMessages,
      }),
      signal: requestSignal,
    });

    const providerResponse = await parseProviderResponse(response);

    if (!response.ok) {
      throw new Error(
        buildProviderRequestErrorMessage(
          providerResponse,
          response.status,
          `聊天请求失败（HTTP ${response.status}）`,
        ),
      );
    }

    const content = extractProviderContent(providerResponse, "anthropic");

    if (!content) {
      throw new Error(buildEmptyProviderResponseMessage(providerResponse, "anthropic"));
    }

    return {
      content,
      model: input.model,
      keyName: key.name,
    };
  }

  const requestMessages = buildOpenAiMessages(messages, attachments);

  const response = await fetch(joinBaseUrl(key.baseUrl, "/chat/completions"), {
    method: "POST",
    headers: {
      authorization: `Bearer ${key.secret}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: input.model,
      messages: requestMessages,
    }),
    signal: requestSignal,
  });

  const providerResponse = await parseProviderResponse(response);

  if (!response.ok) {
    throw new Error(
      buildProviderRequestErrorMessage(
        providerResponse,
        response.status,
        `聊天请求失败（HTTP ${response.status}）`,
      ),
    );
  }

  const content = extractProviderContent(providerResponse, "openai");

  if (!content) {
    throw new Error(buildEmptyProviderResponseMessage(providerResponse, "openai"));
  }

  return {
    content,
    model: input.model,
    keyName: key.name,
  };
}

export function describeChatAttachmentsForStorage(attachments: ChatAttachmentInput[]) {
  return formatAttachmentSummary(attachments);
}

export function buildStoredChatUserMessage(
  content: string,
  attachments: ChatAttachmentInput[],
) {
  return buildStoredUserContent(content, attachments);
}

export async function listChatSessions(userId: string): Promise<ChatSessionListItem[]> {
  const sessions = await prisma.chatSession.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      keyId: true,
      model: true,
      updatedAt: true,
    },
  });

  return sessions.map((s) => ({
    id: s.id,
    title: s.title,
    keyId: s.keyId,
    model: s.model,
    updatedAt: s.updatedAt.toISOString(),
  }));
}

export async function getChatSession(id: string, userId: string): Promise<ChatSessionDetail | null> {
  const session = await prisma.chatSession.findUnique({
    where: { id, userId },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
        select: { id: true, role: true, content: true },
      },
    },
  });

  if (!session) {
    return null;
  }

  return {
    id: session.id,
    title: session.title,
    keyId: session.keyId,
    model: session.model,
    updatedAt: session.updatedAt.toISOString(),
    messages: session.messages.map((m) => ({
      id: m.id,
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  };
}

export async function createChatSession(input: {
  title: string;
  keyId: string | null;
  model: string | null;
  userId: string;
}): Promise<ChatSessionListItem> {
  const session = await prisma.chatSession.create({
    data: {
      title: input.title,
      keyId: input.keyId,
      model: input.model,
      userId: input.userId,
    },
  });

  return {
    id: session.id,
    title: session.title,
    keyId: session.keyId,
    model: session.model,
    updatedAt: session.updatedAt.toISOString(),
  };
}

export async function renameChatSession(id: string, userId: string, title: string): Promise<void> {
  await prisma.chatSession.update({ where: { id, userId }, data: { title } });
}

export async function deleteChatSession(id: string, userId: string): Promise<void> {
  await prisma.chatSession.delete({ where: { id, userId } });
}

export async function appendChatMessages(
  sessionId: string,
  messages: Array<{ role: "user" | "assistant"; content: string }>,
): Promise<void> {
  await prisma.$transaction([
    prisma.chatMessage.createMany({
      data: messages.map((m) => ({ sessionId, role: m.role, content: m.content })),
    }),
    prisma.chatSession.update({
      where: { id: sessionId },
      data: { updatedAt: new Date() },
    }),
  ]);
}

export async function replaceChatMessages(
  sessionId: string,
  userId: string,
  messages: Array<{ role: "user" | "assistant"; content: string }>,
): Promise<void> {
  await prisma.chatSession.findUniqueOrThrow({ where: { id: sessionId, userId }, select: { id: true } });

  await prisma.$transaction([
    prisma.chatMessage.deleteMany({ where: { sessionId } }),
    prisma.chatMessage.createMany({
      data: messages.map((message) => ({
        sessionId,
        role: message.role,
        content: message.content,
      })),
    }),
    prisma.chatSession.update({
      where: { id: sessionId, userId },
      data: { updatedAt: new Date() },
    }),
  ]);
}
