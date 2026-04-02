import { prisma } from "@/lib/prisma";
import type { ManagedKeyListItem } from "@/features/managed-keys/types";
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
