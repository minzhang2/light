import { NextRequest, NextResponse } from "next/server";

import { getApiErrorMessage } from "@/lib/api-error";
import { getSessionOrNull } from "@/lib/auth/require-session";
import { prisma } from "@/lib/prisma";

function normalizeTitle(value: string | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized.slice(0, 120) : "未命名笔记";
}

export async function GET() {
  const session = await getSessionOrNull();
  if (!session?.user) {
    return NextResponse.json({ message: "请先登录。" }, { status: 401 });
  }

  try {
    const documents = await prisma.noteDocument.findMany({
      where: { userId: session.user.id },
      orderBy: [{ isPinned: "desc" }, { updatedAt: "desc" }],
    });

    return NextResponse.json({ documents });
  } catch (error) {
    const message = getApiErrorMessage(error, "获取笔记失败。");
    return NextResponse.json({ message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getSessionOrNull();
  if (!session?.user) {
    return NextResponse.json({ message: "请先登录。" }, { status: 401 });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as {
      title?: string;
      content?: string;
    };

    const document = await prisma.noteDocument.create({
      data: {
        userId: session.user.id,
        title: normalizeTitle(body.title),
        content: typeof body.content === "string" ? body.content : "",
      },
    });

    return NextResponse.json({ document }, { status: 201 });
  } catch (error) {
    const message = getApiErrorMessage(error, "创建笔记失败。");
    return NextResponse.json({ message }, { status: 500 });
  }
}
