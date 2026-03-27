import { NextResponse } from "next/server";

import { normalizeEmail } from "@/lib/auth/email-otp";
import { consumeEmailOtp } from "@/lib/auth/otp";
import {
  setUserPasswordById,
  validatePasswordInput,
} from "@/lib/auth/password";
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
    typeof body.code !== "string" ||
    typeof body.password !== "string" ||
    typeof body.confirmPassword !== "string"
  ) {
    return NextResponse.json({ message: "参数不完整。" }, { status: 400 });
  }

  if (
    typeof body.email === "string" &&
    normalizeEmail(body.email) !== normalizeEmail(sessionEmail)
  ) {
    return NextResponse.json(
      { message: "只能修改当前登录账户的密码。" },
      { status: 400 },
    );
  }

  const passwordMessage = validatePasswordInput(
    body.password,
    body.confirmPassword,
  );
  if (passwordMessage) {
    return NextResponse.json({ message: passwordMessage }, { status: 400 });
  }

  try {
    const validCode = await consumeEmailOtp(
      sessionEmail,
      body.code,
      "password-change",
    );
    if (!validCode) {
      return NextResponse.json(
        { message: "验证码无效或已过期。" },
        { status: 400 },
      );
    }

    await setUserPasswordById(session.user.id, body.password);

    return NextResponse.json({ message: "密码已更新。" });
  } catch (error) {
    console.error("[account] failed to change password", error);
    const message = getApiErrorMessage(error, "修改密码失败，请稍后重试。");
    return NextResponse.json({ message }, { status: 500 });
  }
}
