import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/require-session";

export type UserRole = "user" | "admin";

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function getConfiguredAdminEmails() {
  const raw = process.env.ADMIN_EMAILS ?? "";

  return new Set(
    raw
      .split(/[\s,;]+/)
      .map((item) => normalizeEmail(item))
      .filter(Boolean),
  );
}

export function isEnvironmentAdminEmail(email?: string | null) {
  const normalizedEmail = email ? normalizeEmail(email) : null;

  return normalizedEmail ? getConfiguredAdminEmails().has(normalizedEmail) : false;
}

export async function getUserRoleById(
  userId: string,
  email?: string | null,
): Promise<UserRole> {
  const normalizedEmail = email ? normalizeEmail(email) : null;

  if (isEnvironmentAdminEmail(normalizedEmail)) {
    return "admin";
  }

  try {
    if (normalizedEmail) {
      const userByEmail = await prisma.user.findUnique({
        where: { email: normalizedEmail },
        select: { role: true },
      });

      if (userByEmail) {
        return userByEmail.role === "admin" ? "admin" : "user";
      }
    }

    const userById = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    return userById?.role === "admin" ? "admin" : "user";
  } catch {
    // Role lookup must not block login before the database schema is updated.
    return "user";
  }
}

export async function requireAdminSession() {
  const session = await requireSession();
  const role = await getUserRoleById(session.user.id, session.user.email);

  if (role !== "admin") {
    redirect("/dashboard");
  }

  return {
    ...session,
    user: {
      ...session.user,
      role,
    },
  };
}

export async function requireEnvironmentAdminSession() {
  const session = await requireSession();

  if (!isEnvironmentAdminEmail(session.user.email)) {
    redirect("/dashboard");
  }

  return {
    ...session,
    user: {
      ...session.user,
      role: "admin" as const,
    },
  };
}
