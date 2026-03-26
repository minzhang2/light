import { NextResponse } from "next/server";

import { normalizeEmail } from "@/lib/auth/email-otp";
import { consumeEmailOtp } from "@/lib/auth/otp";
import {
  setUserPasswordByEmail,
  validatePasswordInput,
} from "@/lib/auth/password";
import { prisma } from "@/lib/prisma";

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | {
        email?: unknown;
        code?: unknown;
        password?: unknown;
        confirmPassword?: unknown;
      }
    | null;

  if (
    !body ||
    typeof body.email !== "string" ||
    typeof body.code !== "string" ||
    typeof body.password !== "string" ||
    typeof body.confirmPassword !== "string"
  ) {
    return NextResponse.json({ message: "参数不完整。" }, { status: 400 });
  }

  const email = normalizeEmail(body.email);
  if (!isValidEmail(email)) {
    return NextResponse.json({ message: "邮箱格式不正确。" }, { status: 400 });
  }

  const passwordMessage = validatePasswordInput(
    body.password,
    body.confirmPassword,
  );
  if (passwordMessage) {
    return NextResponse.json({ message: passwordMessage }, { status: 400 });
  }

  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (!existingUser) {
    return NextResponse.json({ message: "该邮箱未注册。" }, { status: 404 });
  }

  const validCode = await consumeEmailOtp(email, body.code, "password-reset");
  if (!validCode) {
    return NextResponse.json(
      { message: "验证码无效或已过期。" },
      { status: 400 },
    );
  }

  await setUserPasswordByEmail(email, body.password);

  return NextResponse.json({ message: "密码已更新，请使用新密码登录。" });
}
