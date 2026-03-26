import bcrypt from "bcryptjs";

import { prisma } from "@/lib/prisma";
import { normalizeEmail } from "@/lib/auth/email-otp";

export const MIN_PASSWORD_LENGTH = 8;

export function validatePasswordInput(password: string, confirmPassword: string) {
  const normalizedPassword = password.trim();
  const normalizedConfirmPassword = confirmPassword.trim();

  if (normalizedPassword.length < MIN_PASSWORD_LENGTH) {
    return `密码至少需要 ${MIN_PASSWORD_LENGTH} 位。`;
  }

  if (normalizedPassword !== normalizedConfirmPassword) {
    return "两次密码输入不一致。";
  }

  return null;
}

export async function setUserPasswordByEmail(email: string, password: string) {
  const normalizedEmail = normalizeEmail(email);
  const passwordHash = await bcrypt.hash(password.trim(), 12);

  return prisma.user.update({
    where: { email: normalizedEmail },
    data: {
      passwordHash,
      emailVerified: new Date(),
    },
  });
}

export async function setUserPasswordById(userId: string, password: string) {
  const passwordHash = await bcrypt.hash(password.trim(), 12);

  return prisma.user.update({
    where: { id: userId },
    data: {
      passwordHash,
      emailVerified: new Date(),
    },
  });
}
