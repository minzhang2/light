import { NextResponse } from "next/server";

import { listManagedKeys } from "@/features/managed-keys/service";
import { getApiErrorMessage } from "@/lib/api-error";
import { getSessionOrNull } from "@/lib/auth/require-session";

export async function GET() {
  const session = await getSessionOrNull();

  if (!session?.user) {
    return NextResponse.json({ message: "请先登录。" }, { status: 401 });
  }

  try {
    const keys = await listManagedKeys();
    return NextResponse.json({ keys });
  } catch (error) {
    const message = getApiErrorMessage(error, "获取 key 列表失败，请稍后重试。");
    return NextResponse.json({ message }, { status: 500 });
  }
}
