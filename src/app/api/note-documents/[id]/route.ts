import { NextRequest, NextResponse } from "next/server";

import {
  isDefaultNoteDocumentTitle,
  markDefaultNoteDocumentInitialized,
} from "@/features/notes/service";
import { getApiErrorMessage } from "@/lib/api-error";
import { getSessionOrNull } from "@/lib/auth/require-session";
import { prisma } from "@/lib/prisma";

function normalizeTitle(value: string | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized.slice(0, 120) : "未命名笔记";
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSessionOrNull();
  if (!session?.user) {
    return NextResponse.json({ message: "请先登录。" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const document = await prisma.noteDocument.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!document) {
      return NextResponse.json({ message: "笔记不存在。" }, { status: 404 });
    }

    return NextResponse.json({ document });
  } catch (error) {
    const message = getApiErrorMessage(error, "获取笔记失败。");
    return NextResponse.json({ message }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSessionOrNull();
  if (!session?.user) {
    return NextResponse.json({ message: "请先登录。" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = (await req.json()) as {
      title?: string;
      content?: string;
      isPinned?: boolean;
    };

    const existing = await prisma.noteDocument.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!existing) {
      return NextResponse.json({ message: "笔记不存在。" }, { status: 404 });
    }

    const document = await prisma.noteDocument.update({
      where: { id },
      data: {
        title:
          body.title !== undefined
            ? normalizeTitle(body.title)
            : existing.title,
        content:
          typeof body.content === "string" ? body.content : existing.content,
        isPinned:
          typeof body.isPinned === "boolean"
            ? body.isPinned
            : existing.isPinned,
      },
    });

    return NextResponse.json({ document });
  } catch (error) {
    const message = getApiErrorMessage(error, "更新笔记失败。");
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

    if (isDefaultNoteDocumentTitle(existing.title)) {
      await markDefaultNoteDocumentInitialized(session.user.id);
    }

    await prisma.noteDocument.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = getApiErrorMessage(error, "删除笔记失败。");
    return NextResponse.json({ message }, { status: 500 });
  }
}
