import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import { getApiErrorMessage } from "@/lib/api-error";
import { getSessionOrNull } from "@/lib/auth/require-session";
import { prisma } from "@/lib/prisma";

function createShareToken() {
  return randomBytes(18).toString("base64url");
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSessionOrNull();
  if (!session?.user) {
    return NextResponse.json({ message: "请先登录。" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const existing = await prisma.noteDocument.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!existing) {
      return NextResponse.json({ message: "笔记不存在。" }, { status: 404 });
    }

    const shareToken = existing.shareToken ?? createShareToken();
    const document = await prisma.noteDocument.update({
      where: { id },
      data: {
        isShared: true,
        shareToken,
        sharedAt: existing.sharedAt ?? new Date(),
      },
    });

    return NextResponse.json({ document });
  } catch (error) {
    const message = getApiErrorMessage(error, "开启分享失败。");
    return NextResponse.json({ message }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSessionOrNull();
  if (!session?.user) {
    return NextResponse.json({ message: "请先登录。" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const existing = await prisma.noteDocument.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!existing) {
      return NextResponse.json({ message: "笔记不存在。" }, { status: 404 });
    }

    const document = await prisma.noteDocument.update({
      where: { id },
      data: {
        isShared: false,
        sharedAt: null,
      },
    });

    return NextResponse.json({ document });
  } catch (error) {
    const message = getApiErrorMessage(error, "关闭分享失败。");
    return NextResponse.json({ message }, { status: 500 });
  }
}
