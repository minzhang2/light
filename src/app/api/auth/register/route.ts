import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

import { normalizeInviteCode } from "@/features/invite-codes/service";
import { isInviteCodeRequiredForRegistration } from "@/lib/auth/registration";
import { prisma } from "@/lib/prisma";

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(request: Request) {
  const requireInviteCode = isInviteCodeRequiredForRegistration();
  const body = (await request.json().catch(() => null)) as
    | {
        name?: unknown;
        email?: unknown;
        inviteCode?: unknown;
        password?: unknown;
        confirmPassword?: unknown;
      }
    | null;

  if (
    !body ||
    typeof body.email !== "string" ||
    typeof body.password !== "string" ||
    typeof body.confirmPassword !== "string" ||
    (body.inviteCode !== undefined && typeof body.inviteCode !== "string")
  ) {
    return NextResponse.json({ message: "参数不完整。" }, { status: 400 });
  }

  const email = body.email.trim().toLowerCase();
  const inviteCode =
    typeof body.inviteCode === "string" ? normalizeInviteCode(body.inviteCode) : "";
  const password = body.password.trim();
  const confirmPassword = body.confirmPassword.trim();
  const name = typeof body.name === "string" ? body.name.trim() : "";

  if (!isValidEmail(email)) {
    return NextResponse.json({ message: "邮箱格式不正确。" }, { status: 400 });
  }

  if (requireInviteCode && !inviteCode) {
    return NextResponse.json({ message: "请输入邀请码。" }, { status: 400 });
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

  const passwordHash = await bcrypt.hash(password, 12);

  try {
    const result = await prisma.$transaction(async (tx) => {
      let inviteId: string | null = null;
      if (requireInviteCode) {
        const invite = await tx.inviteCode.findUnique({
          where: { normalizedCode: inviteCode },
        });

        if (!invite) {
          throw new Error("邀请码不存在。");
        }

        if (invite.usedAt) {
          throw new Error("邀请码已被使用。");
        }

        inviteId = invite.id;
      }

      const existing = await tx.user.findUnique({ where: { email } });

      if (existing?.passwordHash) {
        throw new Error("该邮箱已注册。");
      }

      if (existing) {
        await tx.user.update({
          where: { id: existing.id },
          data: {
            name: name || existing.name,
            passwordHash,
          },
        });
      } else {
        await tx.user.create({
          data: {
            email,
            name: name || email.split("@")[0],
            passwordHash,
          },
        });
      }

      if (inviteId) {
        await tx.inviteCode.update({
          where: { id: inviteId },
          data: {
            usedAt: new Date(),
            usedByEmail: email,
          },
        });
      }

      return {
        activated: Boolean(existing),
      };
    });

    return NextResponse.json(
      { message: result.activated ? "账号已激活，可直接登录。" : "注册成功。" },
      { status: result.activated ? 200 : 201 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "注册失败，请稍后再试。";

    return NextResponse.json({ message }, { status: 400 });
  }
}
