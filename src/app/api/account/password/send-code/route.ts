import { NextResponse } from "next/server";

import {
  getEmailOtpCopy,
  normalizeEmail,
} from "@/lib/auth/email-otp";
import { OtpRateLimitError, issueEmailOtp } from "@/lib/auth/otp";
import { getApiErrorMessage } from "@/lib/api-error";
import { getSessionOrNull } from "@/lib/auth/require-session";

export async function POST(request: Request) {
  const session = await getSessionOrNull();

  if (!session?.user) {
    return NextResponse.json({ message: "请先登录。" }, { status: 401 });
  }

  const sessionEmail = session.user.email;

  if (!sessionEmail) {
    return NextResponse.json(
      { message: "当前账户未绑定邮箱。" },
      { status: 400 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    email?: unknown;
  };

  if (
    typeof body.email === "string" &&
    normalizeEmail(body.email) !== normalizeEmail(sessionEmail)
  ) {
    return NextResponse.json(
      { message: "只能向当前登录邮箱发送验证码。" },
      { status: 400 },
    );
  }

  try {
    const result = await issueEmailOtp(sessionEmail, "password-change");
    const copy = getEmailOtpCopy("password-change");

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

    console.error("[account] failed to send password change code", error);
    const message = getApiErrorMessage(error, "发送验证码失败，请稍后重试。");
    return NextResponse.json(
      { message },
      { status: 500 },
    );
  }
}
