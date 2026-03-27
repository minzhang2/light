import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getApiErrorMessage } from "@/lib/api-error";
import { getSessionOrNull } from "@/lib/auth/require-session";

export async function GET() {
  const session = await getSessionOrNull();
  if (!session?.user) {
    return NextResponse.json({ message: "请先登录。" }, { status: 401 });
  }

  try {
    const mailboxes = await prisma.tempMailbox.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ mailboxes });
  } catch (error) {
    const message = getApiErrorMessage(error, "获取邮箱列表失败，请稍后重试。");
    return NextResponse.json({ message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getSessionOrNull();
  if (!session?.user) {
    return NextResponse.json({ message: "请先登录。" }, { status: 401 });
  }

  try {
    const body = (await req.json().catch(() => null)) as
      | { id?: unknown; email?: unknown }
      | null;

    if (
      !body ||
      typeof body.id !== "number" ||
      !Number.isFinite(body.id) ||
      typeof body.email !== "string"
    ) {
      return NextResponse.json({ message: "参数不完整。" }, { status: 400 });
    }

    const id = Math.trunc(body.id);
    const email = body.email.trim();

    const mailbox = await prisma.tempMailbox.upsert({
      where: { id },
      create: {
        id,
        email,
        userId: session.user.id,
      },
      update: {
        email,
      },
    });
    return NextResponse.json({ mailbox });
  } catch (error) {
    console.error("[mailboxes POST]", error);
    const message = getApiErrorMessage(error, "保存邮箱失败，请稍后重试。");
    return NextResponse.json({ message }, { status: 500 });
  }
}
