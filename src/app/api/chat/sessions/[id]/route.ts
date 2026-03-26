import { NextResponse } from "next/server";

import {
  deleteChatSession,
  getChatSession,
  renameChatSession,
} from "@/features/chat/service";
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
  const chatSession = await getChatSession(id, session.user.id);

  if (!chatSession) {
    return NextResponse.json({ message: "会话不存在。" }, { status: 404 });
  }

  return NextResponse.json(chatSession);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSessionOrNull();

  if (!session?.user) {
    return NextResponse.json({ message: "请先登录。" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { title?: unknown } | null;

  if (!body || typeof body.title !== "string" || !body.title.trim()) {
    return NextResponse.json({ message: "参数不完整。" }, { status: 400 });
  }

  const { id } = await params;
  await renameChatSession(id, session.user.id, body.title.trim());
  return NextResponse.json({ ok: true });
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
  await deleteChatSession(id, session.user.id);
  return NextResponse.json({ ok: true });
}
