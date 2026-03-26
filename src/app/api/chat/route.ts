import { NextResponse } from "next/server";

import { createChatCompletion } from "@/features/chat/service";
import type { ChatMessageInput } from "@/features/chat/types";
import { getSessionOrNull } from "@/lib/auth/require-session";

export async function POST(request: Request) {
  const session = await getSessionOrNull();

  if (!session?.user) {
    return NextResponse.json({ message: "请先登录。" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as
    | {
        keyId?: unknown;
        model?: unknown;
        messages?: unknown;
      }
    | null;

  if (
    !body ||
    typeof body.keyId !== "string" ||
    typeof body.model !== "string" ||
    !Array.isArray(body.messages)
  ) {
    return NextResponse.json({ message: "参数不完整。" }, { status: 400 });
  }

  const messages = body.messages
    .filter((item): item is ChatMessageInput => {
      if (!item || typeof item !== "object") {
        return false;
      }

      const value = item as { role?: unknown; content?: unknown };
      return (
        (value.role === "user" || value.role === "assistant") &&
        typeof value.content === "string"
      );
    });

  try {
    const result = await createChatCompletion({
      keyId: body.keyId,
      model: body.model,
      messages,
    });

    return NextResponse.json({ message: result.content, result });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "聊天请求失败，请稍后再试。";

    return NextResponse.json({ message }, { status: 400 });
  }
}
