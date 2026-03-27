import { NextResponse } from "next/server";

import { exportManagedKeys } from "@/features/managed-keys/service";
import { getApiErrorMessage } from "@/lib/api-error";
import { getSessionOrNull } from "@/lib/auth/require-session";

export async function GET() {
  const session = await getSessionOrNull();

  if (!session?.user) {
    return NextResponse.json({ message: "请先登录。" }, { status: 401 });
  }

  try {
    const raw = await exportManagedKeys();
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

    return new NextResponse(raw, {
      headers: {
        "content-disposition": `attachment; filename="managed-keys-${timestamp}.txt"`,
        "content-type": "text/plain; charset=utf-8",
      },
    });
  } catch (error) {
    const message = getApiErrorMessage(error, "导出失败，请稍后重试。");
    return NextResponse.json({ message }, { status: 500 });
  }
}
