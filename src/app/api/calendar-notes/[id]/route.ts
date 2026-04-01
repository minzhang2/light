import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getApiErrorMessage } from "@/lib/api-error";
import { getSessionOrNull } from "@/lib/auth/require-session";
import { sendCalendarReminderEmail } from "@/lib/calendar-reminder-email";
// @ts-expect-error -- lunar-javascript has no type declarations
import { Solar } from "lunar-javascript";

const LUNAR_MONTH_NAMES = [
  "", "正月", "二月", "三月", "四月", "五月", "六月",
  "七月", "八月", "九月", "十月", "冬月", "腊月",
];

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
    const note = await prisma.calendarNote.findFirst({
      where: { id, userId: session.user.id },
    });
    if (!note) {
      return NextResponse.json({ message: "备注不存在。" }, { status: 404 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { email: true },
    });
    const toEmail = note.reminderEmail || user?.email;
    if (!toEmail) {
      return NextResponse.json({ message: "没有可用的收件邮箱。" }, { status: 400 });
    }

    const solar = Solar.fromYmd(note.solarDate.slice(0, 4) as unknown as number, note.solarDate.slice(5, 7) as unknown as number, note.solarDate.slice(8, 10) as unknown as number);
    const lunar = solar.getLunar();
    const lunarMonth = lunar.getMonth() as number;
    const lunarDateStr = `农历${LUNAR_MONTH_NAMES[lunarMonth] ?? `${lunarMonth}月`}${lunar.getDayInChinese()}（测试）`;

    await sendCalendarReminderEmail(toEmail, note.note, lunarDateStr);

    return NextResponse.json({ ok: true, sentTo: toEmail });
  } catch (error) {
    const message = getApiErrorMessage(error, "发送测试提醒失败。");
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
      note?: string;
      color?: string;
      reminderEnabled?: boolean;
      reminderEmail?: string;
    };

    const existing = await prisma.calendarNote.findFirst({
      where: { id, userId: session.user.id },
    });
    if (!existing) {
      return NextResponse.json({ message: "备注不存在。" }, { status: 404 });
    }

    const data: Record<string, unknown> = {};
    if (body.note !== undefined) data.note = body.note.trim();
    if (body.color !== undefined) data.color = body.color;
    if (body.reminderEnabled !== undefined)
      data.reminderEnabled = body.reminderEnabled;
    if (body.reminderEmail !== undefined)
      data.reminderEmail = body.reminderEmail?.trim() || null;

    const note = await prisma.calendarNote.update({
      where: { id },
      data,
    });

    return NextResponse.json({ note });
  } catch (error) {
    const message = getApiErrorMessage(error, "更新备注失败。");
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

    const existing = await prisma.calendarNote.findFirst({
      where: { id, userId: session.user.id },
    });
    if (!existing) {
      return NextResponse.json({ message: "备注不存在。" }, { status: 404 });
    }

    await prisma.calendarNote.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = getApiErrorMessage(error, "删除备注失败。");
    return NextResponse.json({ message }, { status: 500 });
  }
}
