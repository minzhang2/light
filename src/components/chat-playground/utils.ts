import type { ChatKeyOption, ChatMessageInput, ChatSessionDetail } from "@/features/chat/types";
import type { ChatMessage } from "./types";

export function getMessagesForRequest(messages: ChatMessageInput[]) {
  return messages.map((item) => ({
    role: item.role,
    content: item.content,
  }));
}

export function formatAttachmentNames(files: File[]) {
  return files.map((file) => file.name).join("、");
}

export function buildUserMessagePreview(content: string, files: File[]) {
  const trimmed = content.trim();

  if (files.length === 0) {
    return trimmed;
  }

  const summary = files.map((file) => `- ${file.name}`).join("\n");

  if (!trimmed) {
    return `[本次临时附件]\n${summary}`;
  }

  return `${trimmed}\n\n[本次临时附件]\n${summary}`;
}

export function parseMessageContent(content: string) {
  const marker = "[本次临时附件]";
  const markerIndex = content.indexOf(marker);

  if (markerIndex === -1) {
    return {
      text: content,
      attachments: [] as string[],
    };
  }

  const text = content.slice(0, markerIndex).trim();
  const attachmentLines = content
    .slice(markerIndex + marker.length)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^-\s*/, "").trim())
    .map((line) => line.replace(/\s+\([^)\/]+\/[^)]+\)\s*$/i, "").trim())
    .filter(Boolean);

  return {
    text,
    attachments: attachmentLines,
  };
}

export function inferAttachmentKind(label: string) {
  const normalized = label.toLowerCase();

  if (
    normalized.includes("(image/") ||
    /\.(png|jpe?g|gif|webp|bmp|svg|heic|heif|avif)(\s|$|\()/.test(normalized)
  ) {
    return "图片";
  }

  return "文件";
}

export function buildChatFormData(input: {
  keyId: string;
  model: string;
  messages: ChatMessageInput[];
  sessionId: string | null;
  files: File[];
}) {
  const formData = new FormData();
  formData.set("keyId", input.keyId);
  formData.set("model", input.model);
  formData.set("messages", JSON.stringify(getMessagesForRequest(input.messages)));

  if (input.sessionId) {
    formData.set("sessionId", input.sessionId);
  }

  for (const file of input.files) {
    formData.append("attachments", file, file.name);
  }

  return formData;
}

export function getRetryableUserMessageIds(messages: ChatMessage[]) {
  const ids: string[] = [];

  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index];
    if (message.role !== "user") {
      continue;
    }

    const nextMessage = messages[index + 1];
    if (!nextMessage || nextMessage.role !== "assistant") {
      ids.push(message.id);
    }
  }

  return ids;
}

export function makeMessageId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function findKey(keys: ChatKeyOption[], keyId: string | null) {
  if (!keyId) {
    return null;
  }

  return keys.find((item) => item.id === keyId) ?? null;
}

export function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

export function getInitialKeyId(keys: ChatKeyOption[], initialSession?: ChatSessionDetail | null) {
  return findKey(keys, initialSession?.keyId ?? null)?.id ?? keys[0]?.id ?? null;
}

export function getInitialModel(
  keys: ChatKeyOption[],
  keyId: string | null,
  initialSession?: ChatSessionDetail | null,
) {
  const key = findKey(keys, keyId);

  if (initialSession?.model && key?.models.includes(initialSession.model)) {
    return initialSession.model;
  }

  return key?.defaultModel ?? keys[0]?.defaultModel ?? "";
}
