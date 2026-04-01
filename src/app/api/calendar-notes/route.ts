import { NextRequest, NextResponse } from "next/server";
// @ts-expect-error -- lunar-javascript has no type declarations
import { Solar } from "lunar-javascript";

import { prisma } from "@/lib/prisma";
import { getApiErrorMessage } from "@/lib/api-error";
import { getSessionOrNull } from "@/lib/auth/require-session";

export async function GET(req: NextRequest) {
  const session = await getSessionOrNull();
  if (!session?.user) {
    return NextResponse.json({ message: "请先登录。" }, { status: 401 });
  }

  try {
    const solarDate = req.nextUrl.searchParams.get("solarDate");
    const where: { userId: string; solarDate?: string } = {
      userId: session.user.id,
    };
    if (solarDate) where.solarDate = solarDate;

    const notes = await prisma.calendarNote.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ notes });
  } catch (error) {
    const message = getApiErrorMessage(error, "获取日历备注失败。");
    return NextResponse.json({ message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getSessionOrNull();
  if (!session?.user) {
    return NextResponse.json({ message: "请先登录。" }, { status: 401 });
  }

  try {
    const body = (await req.json()) as {
      solarDate?: string;
      note?: string;
      color?: string;
      reminderEnabled?: boolean;
      reminderEmail?: string;
    };

    if (!body.solarDate || !body.note?.trim()) {
      return NextResponse.json(
        { message: "日期和备注内容不能为空。" },
        { status: 400 },
      );
    }

    // Convert solar date to lunar
    const [y, m, d] = body.solarDate.split("-").map(Number);
    const solar = Solar.fromYmd(y, m, d);
    const lunar = solar.getLunar();

    const note = await prisma.calendarNote.create({
      data: {
        userId: session.user.id,
        solarDate: body.solarDate,
        lunarMonth: lunar.getMonth() as number,
        lunarDay: lunar.getDay() as number,
        isLeapMonth: (lunar.isLeap?.() ?? false) as boolean,
        note: body.note.trim(),
        color: body.color ?? "#f97316",
        reminderEnabled: body.reminderEnabled ?? false,
        reminderEmail: body.reminderEmail?.trim() || null,
      },
    });

    return NextResponse.json({ note });
  } catch (error) {
    const message = getApiErrorMessage(error, "添加日历备注失败。");
    return NextResponse.json({ message }, { status: 500 });
  }
}
