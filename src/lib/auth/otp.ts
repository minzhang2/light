import bcrypt from "bcryptjs";
import { randomInt } from "node:crypto";

import { prisma } from "@/lib/prisma";
import { sendLoginCodeEmail } from "@/lib/auth/email";

const CODE_EXPIRES_MS = 10 * 60 * 1000;
const SEND_INTERVAL_MS = 60 * 1000;

export class OtpRateLimitError extends Error {
  constructor() {
    super("请勿频繁发送验证码，请稍后再试。");
  }
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function issueLoginCode(email: string) {
  const normalizedEmail = normalizeEmail(email);
  const latestCode = await prisma.emailOtp.findFirst({
    where: { email: normalizedEmail },
    orderBy: { createdAt: "desc" },
  });

  const now = Date.now();
  if (latestCode && now - latestCode.createdAt.getTime() < SEND_INTERVAL_MS) {
    throw new OtpRateLimitError();
  }

  const code = String(randomInt(100_000, 1_000_000));
  const codeHash = await bcrypt.hash(code, 10);
  const expiresAt = new Date(now + CODE_EXPIRES_MS);

  await prisma.emailOtp.deleteMany({ where: { email: normalizedEmail } });
  await prisma.emailOtp.create({
    data: {
      email: normalizedEmail,
      codeHash,
      expiresAt,
    },
  });

  const delivery = await sendLoginCodeEmail(normalizedEmail, code);

  return {
    expiresAt,
    ...delivery,
  };
}

export async function consumeLoginCode(email: string, code: string) {
  const normalizedEmail = normalizeEmail(email);
  const normalizedCode = code.trim();

  const latestCode = await prisma.emailOtp.findFirst({
    where: { email: normalizedEmail },
    orderBy: { createdAt: "desc" },
  });

  if (!latestCode) {
    return false;
  }

  if (latestCode.expiresAt.getTime() < Date.now()) {
    await prisma.emailOtp.deleteMany({ where: { email: normalizedEmail } });
    return false;
  }

  const isValid = await bcrypt.compare(normalizedCode, latestCode.codeHash);
  if (!isValid) {
    return false;
  }

  await prisma.emailOtp.deleteMany({ where: { email: normalizedEmail } });
  return true;
}
