import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/prisma";

const ACTIVE_THROTTLE_MS = 5 * 60 * 1000;

export async function getSessionOrNull() {
  const session = await getServerSession(authOptions);

  if (session?.user?.id) {
    const userId = session.user.id;
    // Fire-and-forget: update lastActiveAt at most once per 5 minutes
    prisma.user
      .findUnique({ where: { id: userId }, select: { lastActiveAt: true } })
      .then((user) => {
        const now = new Date();
        if (
          !user?.lastActiveAt ||
          now.getTime() - user.lastActiveAt.getTime() >= ACTIVE_THROTTLE_MS
        ) {
          return prisma.user.update({
            where: { id: userId },
            data: { lastActiveAt: now },
          });
        }
      })
      .catch(() => {});
  }

  return session;
}

export async function requireSession() {
  const session = await getSessionOrNull();

  if (!session?.user) {
    redirect("/login");
  }

  return session;
}
