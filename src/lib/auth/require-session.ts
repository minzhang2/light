import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth/options";

export async function getSessionOrNull() {
  return getServerSession(authOptions);
}

export async function requireSession() {
  const session = await getSessionOrNull();

  if (!session?.user) {
    redirect("/login");
  }

  return session;
}
