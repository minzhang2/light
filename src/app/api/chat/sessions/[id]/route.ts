import { NextResponse } from "next/server";

import {
  deleteChatSession,
  getChatSession,
  renameChatSession,
  replaceChatMessages,
} from "@/features/chat/service";
import { getApiErrorMessage } from "@/lib/api-error";
import { getSessionOrNull } from "@/lib/auth/require-session";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSessionOrNull();

  if (!session?.user) {
    return NextResponse.json({ message: "请先登录。" }, { status: 401 });
  }

  const { id } = await params;
  try {
    const chatSession = await getChatSession(id, session.user.id);

    if (!chatSession) {
      return NextResponse.json({ message: "会话不存在。" }, { status: 404 });
    }

    return NextResponse.json(chatSession);
  } catch (error) {
    const message = getApiErrorMessage(error, "获取会话详情失败，请稍后重试。");
    return NextResponse.json({ message }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSessionOrNull();

  if (!session?.user) {
    return NextResponse.json({ message: "请先登录。" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as
    | { title?: unknown; messages?: unknown }
    | null;

  const { id } = await params;
  try {
    if (typeof body?.title === "string" && body.title.trim()) {
      await renameChatSession(id, session.user.id, body.title.trim());
      return NextResponse.json({ ok: true });
    }

    if (Array.isArray(body?.messages)) {
      const messages = body.messages
        .filter((item): item is { role: "user" | "assistant"; content: string } => {
          if (!item || typeof item !== "object") {
            return false;
          }

          const value = item as { role?: unknown; content?: unknown };
          return (
            (value.role === "user" || value.role === "assistant") &&
            typeof value.content === "string"
          );
        })
        .map((item) => ({ role: item.role, content: item.content.trim() }))
        .filter((item) => item.content.length > 0);

      await replaceChatMessages(id, session.user.id, messages);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ message: "参数不完整。" }, { status: 400 });
  } catch (error) {
    const message = getApiErrorMessage(error, "更新会话失败，请稍后重试。");
    return NextResponse.json({ message }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSessionOrNull();

  if (!session?.user) {
    return NextResponse.json({ message: "请先登录。" }, { status: 401 });
  }

  const { id } = await params;
  try {
    await deleteChatSession(id, session.user.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = getApiErrorMessage(error, "删除会话失败，请稍后重试。");
    return NextResponse.json({ message }, { status: 500 });
  }
}
