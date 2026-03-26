import { NextResponse } from "next/server";

import { importManagedKeys } from "@/features/managed-keys/service";
import { getSessionOrNull } from "@/lib/auth/require-session";

export async function POST(request: Request) {
  const session = await getSessionOrNull();

  if (!session?.user) {
    return NextResponse.json({ message: "请先登录。" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as
    | { raw?: unknown }
    | null;

  if (!body || typeof body.raw !== "string" || !body.raw.trim()) {
    return NextResponse.json({ message: "请先粘贴原始 key 文本。" }, { status: 400 });
  }

  const result = await importManagedKeys(body.raw);

  if (result.parsedCount === 0) {
    return NextResponse.json(
      { message: "没有识别到可导入的 key，请检查格式。" },
      { status: 400 },
    );
  }

  return NextResponse.json({
    message: `已导入并合并 ${result.parsedCount} 条唯一 key。`,
    keys: result.keys,
    newKeyIds: result.newKeyIds,
  });
}
