import { NextResponse } from "next/server";

import { duplicateManagedKey, removeManagedKey, updateManagedKey } from "@/features/managed-keys/service";
import { getApiErrorMessage } from "@/lib/api-error";
import type { ManagedKeyUpdateInput } from "@/features/managed-keys/types";
import { getSessionOrNull } from "@/lib/auth/require-session";

export async function PATCH(
  request: Request,
  context: RouteContext<"/api/keys/[id]">,
) {
  const session = await getSessionOrNull();

  if (!session?.user) {
    return NextResponse.json({ message: "请先登录。" }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    const payload = (await request.json()) as Partial<ManagedKeyUpdateInput>;
    const key = await updateManagedKey(id, {
      name: typeof payload.name === "string" ? payload.name : undefined,
      secret: typeof payload.secret === "string" ? payload.secret : undefined,
      baseUrl: typeof payload.baseUrl === "string" ? payload.baseUrl : undefined,
      model:
        typeof payload.model === "string" || payload.model === null
          ? payload.model
          : undefined,
      launchCommand:
        payload.launchCommand === "claude" || payload.launchCommand === "codex"
          ? payload.launchCommand
          : payload.launchCommand === null
            ? null
            : undefined,
      isTestable:
        typeof payload.isTestable === "boolean" ? payload.isTestable : undefined,
      isPinned: typeof payload.isPinned === "boolean" ? payload.isPinned : undefined,
    });

    return NextResponse.json({
      message: "已更新该 key。",
      key,
    });
  } catch (error) {
    const message = getApiErrorMessage(error, "更新失败，请稍后再试。");

    return NextResponse.json({ message }, { status: 400 });
  }
}

export async function POST(
  _request: Request,
  context: RouteContext<"/api/keys/[id]">,
) {
  const session = await getSessionOrNull();

  if (!session?.user) {
    return NextResponse.json({ message: "请先登录。" }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    const result = await duplicateManagedKey(id);

    return NextResponse.json({
      message: "已复制当前 key。",
      key: result.key,
      keys: result.keys,
    });
  } catch (error) {
    const message = getApiErrorMessage(error, "复制失败，请稍后再试。");
    return NextResponse.json({ message }, { status: 400 });
  }
}

export async function DELETE(
  _request: Request,
  context: RouteContext<"/api/keys/[id]">,
) {
  const session = await getSessionOrNull();

  if (!session?.user) {
    return NextResponse.json({ message: "请先登录。" }, { status: 401 });
  }

  const { id } = await context.params;
  try {
    const keys = await removeManagedKey(id);

    return NextResponse.json({
      message: "已删除该 key。",
      keys,
    });
  } catch (error) {
    const message = getApiErrorMessage(error, "删除失败，请稍后再试。");
    return NextResponse.json({ message }, { status: 500 });
  }
}
