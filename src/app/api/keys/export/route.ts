import { NextResponse } from "next/server";

import { exportManagedKeys } from "@/features/managed-keys/service";
import { getSessionOrNull } from "@/lib/auth/require-session";

export async function GET() {
  const session = await getSessionOrNull();

  if (!session?.user) {
    return NextResponse.json({ message: "请先登录。" }, { status: 401 });
  }

  const raw = await exportManagedKeys();
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

  return new NextResponse(raw, {
    headers: {
      "content-disposition": `attachment; filename="managed-keys-${timestamp}.txt"`,
      "content-type": "text/plain; charset=utf-8",
    },
  });
}
