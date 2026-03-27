import { prisma } from "@/lib/prisma";
import { getConfiguredAdminEmails } from "@/lib/auth/admin";
import type {
  ManagedUserActivitySummary,
  ManagedUserListItem,
  UpdateManagedUserRoleInput,
} from "@/features/admin-users/types";
import { compareManagedUsers } from "@/features/admin-users/sort";

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function createEmptyActivity(): ManagedUserActivitySummary {
  return {
    chatSessionCount: 0,
    chatMessageCount: 0,
    mailboxCount: 0,
    lastChatAt: null,
    lastMailboxAt: null,
    lastActiveAt: null,
  };
}

function pickLatestIso(left: string | null, right: string | null) {
  if (!left) {
    return right;
  }
  if (!right) {
    return left;
  }
  return left >= right ? left : right;
}

function withLastActive(
  activity: Omit<ManagedUserActivitySummary, "lastActiveAt">,
): ManagedUserActivitySummary {
  return {
    ...activity,
    lastActiveAt: pickLatestIso(activity.lastChatAt, activity.lastMailboxAt),
  };
}

async function listManagedUserActivity(userIds: string[]) {
  if (userIds.length === 0) {
    return new Map<string, ManagedUserActivitySummary>();
  }

  const [chatSessions, mailboxes] = await Promise.all([
    prisma.chatSession.findMany({
      where: { userId: { in: userIds } },
      select: {
        userId: true,
        updatedAt: true,
        _count: { select: { messages: true } },
      },
    }),
    prisma.tempMailbox.findMany({
      where: { userId: { in: userIds } },
      select: {
        userId: true,
        updatedAt: true,
      },
    }),
  ]);

  const draft = new Map<string, Omit<ManagedUserActivitySummary, "lastActiveAt">>();

  for (const userId of userIds) {
    draft.set(userId, createEmptyActivity());
  }

  for (const session of chatSessions) {
    const current = draft.get(session.userId) ?? createEmptyActivity();
    const nextLastChatAt = pickLatestIso(
      current.lastChatAt,
      session.updatedAt.toISOString(),
    );
    draft.set(session.userId, {
      ...current,
      chatSessionCount: current.chatSessionCount + 1,
      chatMessageCount: current.chatMessageCount + session._count.messages,
      lastChatAt: nextLastChatAt,
    });
  }

  for (const mailbox of mailboxes) {
    const current = draft.get(mailbox.userId) ?? createEmptyActivity();
    const nextLastMailboxAt = pickLatestIso(
      current.lastMailboxAt,
      mailbox.updatedAt.toISOString(),
    );
    draft.set(mailbox.userId, {
      ...current,
      mailboxCount: current.mailboxCount + 1,
      lastMailboxAt: nextLastMailboxAt,
    });
  }

  const activityByUserId = new Map<string, ManagedUserActivitySummary>();

  for (const [userId, activity] of draft) {
    activityByUserId.set(userId, withLastActive(activity));
  }

  return activityByUserId;
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
  activity: ManagedUserActivitySummary,
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
    activity,
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
  const activityByUserId = await listManagedUserActivity(rows.map((user) => user.id));

  return rows
    .map((user) =>
      toListItem(user, envAdmins, activityByUserId.get(user.id) ?? createEmptyActivity()),
    )
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

  const activityByUserId = await listManagedUserActivity([updated.id]);
  const user = toListItem(
    updated,
    envAdmins,
    activityByUserId.get(updated.id) ?? createEmptyActivity(),
  );

  if (!user) {
    throw new Error("角色更新失败。");
  }

  return user;
}
