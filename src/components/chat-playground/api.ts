import type { ChatMessageInput } from "@/features/chat/types";

export async function createSession(data: {
  title: string;
  keyId: string | null;
  model: string;
}) {
  const res = await fetch("/api/chat/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    return null;
  }

  const newSession = (await res.json().catch(() => null)) as { id?: string } | null;
  return newSession?.id ?? null;
}

export async function sendChatMessage(data: {
  keyId: string;
  model: string;
  messages: ChatMessageInput[];
  sessionId: string | null;
  files?: File[];
  signal?: AbortSignal;
}) {
  const formData = new FormData();
  formData.set("keyId", data.keyId);
  formData.set("model", data.model);
  formData.set("messages", JSON.stringify(data.messages));

  if (data.sessionId) {
    formData.set("sessionId", data.sessionId);
  }

  if (data.files) {
    for (const file of data.files) {
      formData.append("attachments", file, file.name);
    }
  }

  const response = await fetch("/api/chat", {
    method: "POST",
    body: formData,
    signal: data.signal,
  });

  const payload = (await response.json().catch(() => null)) as
    | {
        message?: string;
        result?: {
          content: string;
          keyName: string;
          model: string;
        };
      }
    | null;

  if (!response.ok || !payload?.result) {
    throw new Error(payload?.message ?? "聊天请求失败。");
  }

  return payload.result;
}

export async function updateSessionMessages(
  sessionId: string,
  messages: ChatMessageInput[],
) {
  const response = await fetch(`/api/chat/sessions/${sessionId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(payload?.message ?? "更新消息失败。");
  }
}

export async function deleteMessage(
  sessionId: string,
  messageId: string,
) {
  const response = await fetch(`/api/chat/sessions/${sessionId}/messages/${messageId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(payload?.message ?? "删除消息失败。");
  }
}
