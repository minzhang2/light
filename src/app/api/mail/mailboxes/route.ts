import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getApiErrorMessage } from "@/lib/api-error";
import { getSessionOrNull } from "@/lib/auth/require-session";
import { getMailAccountByIndex, getMailAccounts } from "@/lib/mail-accounts";

const OPEN_UPSTREAM = "https://zjkdongao.cn/open/v1";

export async function GET(req: NextRequest) {
  const session = await getSessionOrNull();
  if (!session?.user) {
    return NextResponse.json({ message: "请先登录。" }, { status: 401 });
  }

  try {
    const accountIndexParam = req.nextUrl.searchParams.get("accountIndex");
    const accountIndex = accountIndexParam !== null ? Number(accountIndexParam) : null;
    const account = accountIndex !== null ? getMailAccountByIndex(accountIndex) : null;
    const accountKey = account?.key ?? null;
    const allAccounts = getMailAccounts();
    const rawMailboxes = await prisma.tempMailbox.findMany({
      where: { userId: session.user.id, accountKey },
      orderBy: { createdAt: "desc" },
    });
    const mailboxes = rawMailboxes.map(({ accountKey: _key, ...m }) => ({
      ...m,
      index: _key ? allAccounts.findIndex((a) => a.key === _key) : null,
    }));

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
      | { id?: unknown; email?: unknown; accountIndex?: unknown }
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
    const accountIndex = typeof body.accountIndex === "number" ? body.accountIndex : null;
    const account = accountIndex !== null ? getMailAccountByIndex(accountIndex) : null;
    const accountKey = account?.key ?? null;

    const mailbox = await prisma.tempMailbox.upsert({
      where: { id },
      create: {
        id,
        email,
        userId: session.user.id,
        accountKey,
      },
      update: {
        email,
        accountKey,
      },
    });
    return NextResponse.json({ mailbox });
  } catch (error) {
    console.error("[mailboxes POST]", error);
    const message = getApiErrorMessage(error, "保存邮箱失败，请稍后重试。");
    return NextResponse.json({ message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getSessionOrNull();
  if (!session?.user) {
    return NextResponse.json({ message: "请先登录。" }, { status: 401 });
  }

  try {
    const idParam = req.nextUrl.searchParams.get("id");
    const id = Number(idParam);
    console.log("[mailboxes DELETE] params", { idParam, id, userId: session.user.id });
    if (!Number.isFinite(id)) {
      return NextResponse.json({ message: "参数不完整。" }, { status: 400 });
    }

    const mailbox = await prisma.tempMailbox.findFirst({
      where: { id: Math.trunc(id), userId: session.user.id },
    });
    if (!mailbox) {
      return NextResponse.json({ message: "邮箱不存在或无权删除。" }, { status: 404 });
    }

    // Call upstream to delete the mailbox
    const upstreamUrl = `${OPEN_UPSTREAM}/mailboxes/${mailbox.id}`;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (mailbox.accountKey) headers["Authorization"] = `Bearer ${mailbox.accountKey}`;
    console.log("[mailboxes DELETE] upstream request", { upstreamUrl });
    const upstreamRes = await fetch(upstreamUrl, { method: "DELETE", headers });
    const upstreamBody = await upstreamRes.text();
    console.log("[mailboxes DELETE] upstream response", { status: upstreamRes.status, body: upstreamBody });

    await prisma.tempMailbox.delete({ where: { id: mailbox.id } });
    console.log("[mailboxes DELETE] local deleted", { id: mailbox.id });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[mailboxes DELETE]", error);
    const message = getApiErrorMessage(error, "删除邮箱失败，请稍后重试。");
    return NextResponse.json({ message }, { status: 500 });
  }
}
