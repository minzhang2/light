import bcrypt from "bcryptjs";
import { randomInt } from "node:crypto";

import { prisma } from "@/lib/prisma";
import { sendLoginCodeEmail } from "@/lib/auth/email";
import {
  normalizeEmail,
  type EmailOtpPurpose,
} from "@/lib/auth/email-otp";

const CODE_EXPIRES_MS = 30 * 60 * 1000;
const SEND_INTERVAL_MS = 60 * 1000;

export class OtpRateLimitError extends Error {
  constructor() {
    super("请勿频繁发送验证码，请稍后再试。");
  }
}

export async function issueEmailOtp(
  email: string,
  purpose: EmailOtpPurpose,
) {
  const normalizedEmail = normalizeEmail(email);
  const latestCode = await prisma.emailOtp.findFirst({
    where: { email: normalizedEmail, purpose },
    orderBy: { createdAt: "desc" },
  });

  const now = Date.now();
  const shouldReuseActiveCode = purpose === "login";
  if (
    shouldReuseActiveCode &&
    latestCode &&
    latestCode.expiresAt.getTime() > now
  ) {
    return {
      expiresAt: latestCode.expiresAt,
      delivery: "log" as const,
      reused: true,
    };
  }

  if (latestCode && now - latestCode.createdAt.getTime() < SEND_INTERVAL_MS) {
    throw new OtpRateLimitError();
  }

  const code = String(randomInt(100_000, 1_000_000));
  const codeHash = await bcrypt.hash(code, 10);
  const expiresAt = new Date(now + CODE_EXPIRES_MS);

  await prisma.emailOtp.deleteMany({
    where: { email: normalizedEmail, purpose },
  });
  await prisma.emailOtp.create({
    data: {
      email: normalizedEmail,
      purpose,
      codeHash,
      expiresAt,
    },
  });

  const delivery = await sendLoginCodeEmail(normalizedEmail, code, purpose);

  return {
    expiresAt,
    ...delivery,
    reused: false,
  };
}

export async function consumeEmailOtp(
  email: string,
  code: string,
  purpose: EmailOtpPurpose,
) {
  const normalizedEmail = normalizeEmail(email);
  const normalizedCode = code.trim();

  const latestCode = await prisma.emailOtp.findFirst({
    where: { email: normalizedEmail, purpose },
    orderBy: { createdAt: "desc" },
  });

  if (!latestCode) {
    return false;
  }

  if (latestCode.expiresAt.getTime() < Date.now()) {
    await prisma.emailOtp.deleteMany({
      where: { email: normalizedEmail, purpose },
    });
    return false;
  }

  const isValid = await bcrypt.compare(normalizedCode, latestCode.codeHash);
  if (!isValid) {
    return false;
  }

  await prisma.emailOtp.deleteMany({
    where: { email: normalizedEmail, purpose },
  });
  return true;
}

export function issueLoginCode(email: string) {
  return issueEmailOtp(email, "login");
}

export function consumeLoginCode(email: string, code: string) {
  return consumeEmailOtp(email, code, "login");
}
