import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getSessionOrNull } from "@/lib/auth/require-session";

export async function GET() {
  const session = await getSessionOrNull();
  if (!session?.user) {
    return NextResponse.json({ message: "请先登录。" }, { status: 401 });
  }

  const mailboxes = await prisma.tempMailbox.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ mailboxes });
}

export async function POST(req: NextRequest) {
  const session = await getSessionOrNull();
  if (!session?.user) {
    return NextResponse.json({ message: "请先登录。" }, { status: 401 });
  }

  const body = await req.json();
  const id = Number(body.id);
  const email = String(body.email);
  const remaining_requests_today = parseInt(body.remaining_requests_today, 10) || 0;

  try {
    const mailbox = await prisma.tempMailbox.upsert({
      where: { id },
      create: {
        id,
        email,
        userId: session.user.id,
        remainingRequestsToday: remaining_requests_today ?? 0,
      },
      update: {
        email,
        remainingRequestsToday: remaining_requests_today ?? 0,
      },
    });
    return NextResponse.json({ mailbox });
  } catch (e) {
    console.error("[mailboxes POST]", e);
    return NextResponse.json({ message: String(e) }, { status: 500 });
  }
}
