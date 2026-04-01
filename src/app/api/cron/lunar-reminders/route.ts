import { NextRequest, NextResponse } from "next/server";
// @ts-expect-error -- lunar-javascript has no type declarations
import { Solar } from "lunar-javascript";

import { prisma } from "@/lib/prisma";
import { sendCalendarReminderEmail } from "@/lib/calendar-reminder-email";

const LUNAR_MONTH_NAMES = [
  "",
  "正月",
  "二月",
  "三月",
  "四月",
  "五月",
  "六月",
  "七月",
  "八月",
  "九月",
  "十月",
  "冬月",
  "腊月",
];

export async function GET(req: NextRequest) {
  const secret = req.headers.get("authorization");
  const expected = process.env.CRON_SECRET
    ? `Bearer ${process.env.CRON_SECRET}`
    : null;

  if (expected && secret !== expected) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const today = new Date();
    const solar = Solar.fromDate(today);
    const lunar = solar.getLunar();
    const lunarMonth = lunar.getMonth() as number;
    const lunarDay = lunar.getDay() as number;
    const currentYear = today.getFullYear();

    const notes = await prisma.calendarNote.findMany({
      where: {
        reminderEnabled: true,
        lunarMonth,
        lunarDay,
        OR: [
          { lastReminderYear: null },
          { lastReminderYear: { not: currentYear } },
        ],
      },
    });

    let sent = 0;
    const lunarDateStr = `农历${LUNAR_MONTH_NAMES[lunarMonth] ?? `${lunarMonth}月`}${lunar.getDayInChinese()}`;

    for (const note of notes) {
      const user = await prisma.user.findUnique({
        where: { id: note.userId },
        select: { email: true },
      });
      const toEmail = note.reminderEmail || user?.email;
      if (!toEmail) continue;

      try {
        await sendCalendarReminderEmail(toEmail, note.note, lunarDateStr);
        await prisma.calendarNote.update({
          where: { id: note.id },
          data: { lastReminderYear: currentYear },
        });
        sent++;
      } catch (error) {
        console.error(
          `[lunar-reminders] failed to send to ${toEmail}:`,
          error,
        );
      }
    }

    return NextResponse.json({
      ok: true,
      lunarDate: `${lunarMonth}-${lunarDay}`,
      matched: notes.length,
      sent,
    });
  } catch (error) {
    console.error("[lunar-reminders] cron error:", error);
    return NextResponse.json(
      { message: "Internal error" },
      { status: 500 },
    );
  }
}
