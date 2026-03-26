import { NextResponse } from "next/server";

import { getEmailOtpCopy, normalizeEmail } from "@/lib/auth/email-otp";
import { OtpRateLimitError, issueEmailOtp } from "@/lib/auth/otp";
import { prisma } from "@/lib/prisma";

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { email?: unknown }
    | null;

  if (!body || typeof body.email !== "string") {
    return NextResponse.json({ message: "邮箱格式不正确。" }, { status: 400 });
  }

  const email = normalizeEmail(body.email);
  if (!isValidEmail(email)) {
    return NextResponse.json({ message: "邮箱格式不正确。" }, { status: 400 });
  }

  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (!existingUser) {
    return NextResponse.json({ message: "该邮箱未注册。" }, { status: 404 });
  }

  try {
    const result = await issueEmailOtp(email, "password-reset");
    const copy = getEmailOtpCopy("password-reset");

    return NextResponse.json({
      message:
        result.delivery === "smtp" ? copy.successMessage : copy.fallbackMessage,
      ...(process.env.NODE_ENV !== "production" && result.previewCode
        ? { devCode: result.previewCode }
        : {}),
    });
  } catch (error) {
    if (error instanceof OtpRateLimitError) {
      return NextResponse.json({ message: error.message }, { status: 429 });
    }

    console.error("[auth] failed to send password reset code", error);
    return NextResponse.json(
      { message: "发送验证码失败，请稍后重试。" },
      { status: 500 },
    );
  }
}
