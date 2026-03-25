import { prisma } from "@/lib/prisma";
import { getConfiguredAdminEmails } from "@/lib/auth/admin";
import type {
  ManagedUserListItem,
  UpdateManagedUserRoleInput,
} from "@/features/admin-users/types";
import { compareManagedUsers } from "@/features/admin-users/sort";

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function toListItem(
  user: {
    id: string;
    name: string | null;
    email: string | null;
    role: string;
    createdAt: Date;
  },
  envAdmins: Set<string>,
): ManagedUserListItem | null {
  if (!user.email) {
    return null;
  }

  const email = normalizeEmail(user.email);
  const isEnvAdmin = envAdmins.has(email);

  return {
    id: user.id,
    name: user.name,
    email,
    role: isEnvAdmin || user.role === "admin" ? "admin" : "user",
    roleSource: isEnvAdmin ? "environment" : "database",
    createdAt: user.createdAt.toISOString(),
  };
}

export async function listManagedUsers() {
  const rows = await prisma.user.findMany({
    orderBy: [{ createdAt: "desc" }],
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
    },
  });

  const envAdmins = getConfiguredAdminEmails();

  return rows
    .map((user) => toListItem(user, envAdmins))
    .filter((user): user is ManagedUserListItem => Boolean(user))
    .sort(compareManagedUsers);
}

export async function updateManagedUserRole({
  email: rawEmail,
  role,
  actorEmail,
}: UpdateManagedUserRoleInput) {
  const email = normalizeEmail(rawEmail);
  const normalizedActorEmail = actorEmail ? normalizeEmail(actorEmail) : null;
  const envAdmins = getConfiguredAdminEmails();

  if (!email) {
    throw new Error("请输入用户邮箱。");
  }

  if (envAdmins.has(email) && role !== "admin") {
    throw new Error("该账号由环境变量授予管理员，不能在这里降级。");
  }

  if (normalizedActorEmail === email && role !== "admin") {
    throw new Error("不能在这里移除你自己的管理员权限。");
  }

  const existing = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
    },
  });

  if (!existing?.email) {
    throw new Error("未找到对应用户，请确认对方已经注册。");
  }

  const updated = await prisma.user.update({
    where: { id: existing.id },
    data: { role },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
    },
  });

  const user = toListItem(updated, envAdmins);

  if (!user) {
    throw new Error("角色更新失败。");
  }

  return user;
}
