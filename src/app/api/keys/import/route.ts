import { NextResponse } from "next/server";

import { importManagedKeys } from "@/features/managed-keys/service";
import { getApiErrorMessage } from "@/lib/api-error";
import { getSessionOrNull } from "@/lib/auth/require-session";

export async function POST(request: Request) {
  const session = await getSessionOrNull();

  if (!session?.user) {
    return NextResponse.json({ message: "请先登录。" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as
    | { raw?: unknown; isTestable?: unknown }
    | null;

  if (!body || typeof body.raw !== "string" || !body.raw.trim()) {
    return NextResponse.json({ message: "请先粘贴原始 key 文本。" }, { status: 400 });
  }

  try {
    const result = await importManagedKeys(body.raw, {
      isTestable:
        typeof body.isTestable === "boolean" ? body.isTestable : undefined,
    });

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
  } catch (error) {
    const message = getApiErrorMessage(error, "导入失败，请稍后重试。");
    return NextResponse.json({ message }, { status: 500 });
  }
}
