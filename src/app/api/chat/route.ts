import { NextResponse } from "next/server";

import {
  appendChatMessages,
  buildStoredChatUserMessage,
  createChatCompletion,
} from "@/features/chat/service";
import type { ChatAttachmentInput, ChatMessageInput } from "@/features/chat/types";
import { getSessionOrNull } from "@/lib/auth/require-session";

const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;
const MAX_TOTAL_ATTACHMENT_SIZE = 20 * 1024 * 1024;

function filterMessages(input: unknown) {
  if (!Array.isArray(input)) {
    return [];
  }

  return input.filter((item): item is ChatMessageInput => {
    if (!item || typeof item !== "object") {
      return false;
    }

    const value = item as { role?: unknown; content?: unknown };
    return (
      (value.role === "user" || value.role === "assistant") &&
      typeof value.content === "string"
    );
  });
}

async function parseAttachments(files: File[]) {
  const attachments: ChatAttachmentInput[] = [];
  let totalSize = 0;

  for (const file of files) {
    if (!file.size) {
      continue;
    }

    if (file.size > MAX_ATTACHMENT_SIZE) {
      throw new Error(`文件过大：${file.name}，请控制在 10MB 以内。`);
    }

    totalSize += file.size;
    if (totalSize > MAX_TOTAL_ATTACHMENT_SIZE) {
      throw new Error("附件总体积过大，请控制在 20MB 以内。");
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    attachments.push({
      name: file.name,
      mimeType: file.type || "application/octet-stream",
      data: buffer.toString("base64"),
      size: file.size,
    });
  }

  return attachments;
}

export async function POST(request: Request) {
  const session = await getSessionOrNull();

  if (!session?.user) {
    return NextResponse.json({ message: "请先登录。" }, { status: 401 });
  }

  const contentType = request.headers.get("content-type") ?? "";
  let keyId: string | null = null;
  let model: string | null = null;
  let sessionId: string | null = null;
  let messages: ChatMessageInput[] = [];
  let attachments: ChatAttachmentInput[] = [];

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const rawMessages = formData.get("messages");
    const rawKeyId = formData.get("keyId");
    const rawModel = formData.get("model");
    const rawSessionId = formData.get("sessionId");

    keyId = typeof rawKeyId === "string" ? rawKeyId : null;
    model = typeof rawModel === "string" ? rawModel : null;
    sessionId = typeof rawSessionId === "string" && rawSessionId ? rawSessionId : null;

    let parsedMessages: unknown = null;
    if (typeof rawMessages === "string") {
      try {
        parsedMessages = JSON.parse(rawMessages) as unknown;
      } catch {
        parsedMessages = null;
      }
    }
    messages = filterMessages(parsedMessages);
    attachments = await parseAttachments(
      formData.getAll("attachments").filter((item): item is File => item instanceof File),
    );
  } else {
    const body = (await request.json().catch(() => null)) as
      | {
          keyId?: unknown;
          model?: unknown;
          messages?: unknown;
          sessionId?: unknown;
        }
      | null;

    keyId = body && typeof body.keyId === "string" ? body.keyId : null;
    model = body && typeof body.model === "string" ? body.model : null;
    sessionId = body && typeof body.sessionId === "string" ? body.sessionId : null;
    messages = filterMessages(body?.messages);
  }

  if (!keyId || !model || messages.length === 0) {
    return NextResponse.json({ message: "参数不完整。" }, { status: 400 });
  }

  try {
    const lastUserMsg = messages[messages.length - 1];

    if (sessionId && lastUserMsg) {
      await appendChatMessages(sessionId, [
        {
          role: lastUserMsg.role,
          content: buildStoredChatUserMessage(lastUserMsg.content, attachments),
        },
      ]);
    }

    const result = await createChatCompletion({
      keyId,
      model,
      messages,
      attachments,
      signal: request.signal,
    });

    if (sessionId) {
      await appendChatMessages(sessionId, [{ role: "assistant", content: result.content }]);
    }

    return NextResponse.json({ message: result.content, result });
  } catch (error) {
    if (request.signal.aborted) {
      return new Response(null, { status: 499 });
    }

    const message =
      error instanceof Error ? error.message : "聊天请求失败，请稍后再试。";

    return NextResponse.json({ message }, { status: 400 });
  }
}
