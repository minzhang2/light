import { NextResponse } from "next/server";

import { testManagedKey } from "@/features/managed-keys/service";
import { getSessionOrNull } from "@/lib/auth/require-session";

export async function POST(
  _request: Request,
  context: RouteContext<"/api/keys/[id]/test">,
) {
  const session = await getSessionOrNull();

  if (!session?.user) {
    return NextResponse.json({ message: "请先登录。" }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    const result = await testManagedKey(id);

    return NextResponse.json({
      message: result.result.message,
      key: result.key,
      result: result.result,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "测试失败，请稍后再试。";

    return NextResponse.json({ message }, { status: 500 });
  }
}
