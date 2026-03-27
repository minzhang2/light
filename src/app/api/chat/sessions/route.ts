import { NextResponse } from "next/server";

import {
  createChatSession,
  listChatSessions,
} from "@/features/chat/service";
import { getApiErrorMessage } from "@/lib/api-error";
import { getSessionOrNull } from "@/lib/auth/require-session";

export async function GET() {
  const session = await getSessionOrNull();

  if (!session?.user) {
    return NextResponse.json({ message: "请先登录。" }, { status: 401 });
  }

  try {
    const sessions = await listChatSessions(session.user.id);
    return NextResponse.json(sessions);
  } catch (error) {
    const message = getApiErrorMessage(error, "获取会话列表失败，请稍后重试。");
    return NextResponse.json({ message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getSessionOrNull();

  if (!session?.user) {
    return NextResponse.json({ message: "请先登录。" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    title?: unknown;
    keyId?: unknown;
    model?: unknown;
  } | null;

  if (!body || typeof body.title !== "string") {
    return NextResponse.json({ message: "参数不完整。" }, { status: 400 });
  }

  try {
    const newSession = await createChatSession({
      title: body.title,
      keyId: typeof body.keyId === "string" ? body.keyId : null,
      model: typeof body.model === "string" ? body.model : null,
      userId: session.user.id,
    });

    return NextResponse.json(newSession, { status: 201 });
  } catch (error) {
    const message = getApiErrorMessage(error, "创建会话失败，请稍后重试。");
    return NextResponse.json({ message }, { status: 500 });
  }
}
