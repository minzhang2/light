import { randomBytes } from "crypto";

import { prisma } from "@/lib/prisma";
import type {
  CreateInviteCodeInput,
  InviteCodeListItem,
} from "@/features/invite-codes/types";

const INVITE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

export function normalizeInviteCode(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function formatInviteCode(normalizedCode: string) {
  return normalizedCode.match(/.{1,4}/g)?.join("-") ?? normalizedCode;
}

function randomInviteChunk(size: number) {
  const bytes = randomBytes(size);
  let output = "";

  for (const byte of bytes) {
    output += INVITE_ALPHABET[byte % INVITE_ALPHABET.length];
  }

  return output;
}

function toListItem(code: {
  id: string;
  code: string;
  note: string | null;
  createdByEmail: string | null;
  usedByEmail: string | null;
  usedAt: Date | null;
  createdAt: Date;
}): InviteCodeListItem {
  return {
    id: code.id,
    code: code.code,
    note: code.note,
    createdByEmail: code.createdByEmail,
    usedByEmail: code.usedByEmail,
    usedAt: code.usedAt?.toISOString() ?? null,
    createdAt: code.createdAt.toISOString(),
  };
}

async function generateUniqueInviteCode() {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const normalizedCode = `LGT${randomInviteChunk(9)}`;
    const existing = await prisma.inviteCode.findUnique({
      where: { normalizedCode },
      select: { id: true },
    });

    if (!existing) {
      return {
        normalizedCode,
        code: formatInviteCode(normalizedCode),
      };
    }
  }

  throw new Error("邀请码生成失败，请重试。");
}

export async function listInviteCodes() {
  const rows = await prisma.inviteCode.findMany({
    orderBy: [{ createdAt: "desc" }],
  });

  return rows.map(toListItem);
}

export async function createInviteCode(
  input: CreateInviteCodeInput,
  createdByEmail?: string | null,
) {
  const { code, normalizedCode } = await generateUniqueInviteCode();
  const note = input.note?.trim() || null;

  const created = await prisma.inviteCode.create({
    data: {
      code,
      normalizedCode,
      note,
      createdByEmail: createdByEmail?.trim() || null,
    },
  });

  return toListItem(created);
}

export async function removeInviteCode(id: string) {
  const inviteCode = await prisma.inviteCode.findUnique({
    where: { id },
    select: {
      id: true,
      usedAt: true,
    },
  });

  if (!inviteCode) {
    throw new Error("邀请码不存在。");
  }

  if (inviteCode.usedAt) {
    throw new Error("已使用的邀请码不能删除。");
  }

  await prisma.inviteCode.delete({
    where: { id },
  });

  return listInviteCodes();
}
