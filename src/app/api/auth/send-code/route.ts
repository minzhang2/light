import { NextResponse } from "next/server";

import { issueLoginCode, OtpRateLimitError } from "@/lib/auth/otp";

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

  const email = body.email.trim().toLowerCase();
  if (!isValidEmail(email)) {
    return NextResponse.json({ message: "邮箱格式不正确。" }, { status: 400 });
  }

  try {
    const result = await issueLoginCode(email);

    return NextResponse.json({
      message:
        result.delivery === "smtp"
          ? "验证码已发送，请检查邮箱。"
          : "SMTP 未配置，验证码已输出到服务端日志。",
      ...(process.env.NODE_ENV !== "production" && result.previewCode
        ? { devCode: result.previewCode }
        : {}),
    });
  } catch (error) {
    if (error instanceof OtpRateLimitError) {
      return NextResponse.json({ message: error.message }, { status: 429 });
    }

    console.error("[auth] failed to send login code", error);
    return NextResponse.json(
      { message: "发送验证码失败，请稍后重试。" },
      { status: 500 },
    );
  }
}
