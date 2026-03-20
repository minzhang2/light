import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | {
        name?: unknown;
        email?: unknown;
        password?: unknown;
        confirmPassword?: unknown;
      }
    | null;

  if (
    !body ||
    typeof body.email !== "string" ||
    typeof body.password !== "string" ||
    typeof body.confirmPassword !== "string"
  ) {
    return NextResponse.json({ message: "参数不完整。" }, { status: 400 });
  }

  const email = body.email.trim().toLowerCase();
  const password = body.password.trim();
  const confirmPassword = body.confirmPassword.trim();
  const name = typeof body.name === "string" ? body.name.trim() : "";

  if (!isValidEmail(email)) {
    return NextResponse.json({ message: "邮箱格式不正确。" }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json(
      { message: "密码至少需要 8 位。" },
      { status: 400 },
    );
  }

  if (password !== confirmPassword) {
    return NextResponse.json({ message: "两次密码输入不一致。" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  const passwordHash = await bcrypt.hash(password, 12);

  if (existing) {
    if (existing.passwordHash) {
      return NextResponse.json({ message: "该邮箱已注册。" }, { status: 409 });
    }

    await prisma.user.update({
      where: { id: existing.id },
      data: {
        name: name || existing.name,
        passwordHash,
      },
    });

    return NextResponse.json({ message: "账号已激活，可直接登录。" });
  }

  await prisma.user.create({
    data: {
      email,
      name: name || email.split("@")[0],
      passwordHash,
    },
  });

  return NextResponse.json({ message: "注册成功。" }, { status: 201 });
}
