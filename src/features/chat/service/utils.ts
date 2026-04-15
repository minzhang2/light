import type { ChatAttachmentInput, ChatMessageInput } from "@/features/chat/types";

export function joinBaseUrl(baseUrl: string, path: string) {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL(path.replace(/^\//, ""), normalizedBase);
}

export function dedupeModels(model: string | null, availableModels: string[]) {
  return [...new Set([model, ...availableModels].filter((value): value is string => Boolean(value)))];
}

export function parseStringArray(value: string | null) {
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

export function normalizeChatMessages(messages: ChatMessageInput[]) {
  return messages
    .filter((item) => item.role === "user" || item.role === "assistant")
    .map((item) => ({
      role: item.role,
      content: item.content.trim(),
    }))
    .filter((item) => item.content.length > 0)
    .slice(-20);
}

export function isImageMimeType(mimeType: string) {
  return mimeType.startsWith("image/");
}

export function isPdfMimeType(mimeType: string) {
  return mimeType === "application/pdf";
}

export function isTextLikeAttachment(attachment: ChatAttachmentInput) {
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

export function attachmentToDataUrl(attachment: ChatAttachmentInput) {
  return `data:${attachment.mimeType};base64,${attachment.data}`;
}

export function decodeAttachmentText(attachment: ChatAttachmentInput) {
  return Buffer.from(attachment.data, "base64").toString("utf-8");
}

export function formatAttachmentSummary(attachments: ChatAttachmentInput[]) {
  if (attachments.length === 0) {
    return "";
  }

  return attachments
    .map((attachment) => `- ${attachment.name} (${attachment.mimeType || "application/octet-stream"})`)
    .join("\n");
}

export function buildStoredUserContent(content: string, attachments: ChatAttachmentInput[]) {
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
