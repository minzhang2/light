import { NextResponse } from "next/server";

import { listManagedKeys } from "@/features/managed-keys/service";
import { getSessionOrNull } from "@/lib/auth/require-session";

export async function GET() {
  const session = await getSessionOrNull();

  if (!session?.user) {
    return NextResponse.json({ message: "请先登录。" }, { status: 401 });
  }

  const keys = await listManagedKeys();
  return NextResponse.json({ keys });
}
