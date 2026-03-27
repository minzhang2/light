import { NextResponse } from "next/server";

import {
  listManagedUsers,
  updateManagedUserRole,
} from "@/features/admin-users/service";
import { isEnvironmentAdminEmail } from "@/lib/auth/admin";
import { getApiErrorMessage } from "@/lib/api-error";
import { getSessionOrNull } from "@/lib/auth/require-session";

export async function GET() {
  const session = await getSessionOrNull();

  if (!session?.user) {
    return NextResponse.json({ message: "请先登录。" }, { status: 401 });
  }

  if (!isEnvironmentAdminEmail(session.user.email)) {
    return NextResponse.json({ message: "无权限访问。" }, { status: 403 });
  }

  try {
    const users = await listManagedUsers();
    return NextResponse.json({ users });
  } catch (error) {
    const message = getApiErrorMessage(error, "获取用户列表失败，请稍后重试。");
    return NextResponse.json({ message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const session = await getSessionOrNull();

  if (!session?.user) {
    return NextResponse.json({ message: "请先登录。" }, { status: 401 });
  }

  if (!isEnvironmentAdminEmail(session.user.email)) {
    return NextResponse.json({ message: "无权限访问。" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as
    | {
        email?: unknown;
        role?: unknown;
      }
    | null;

  if (
    !body ||
    typeof body.email !== "string" ||
    (body.role !== "admin" && body.role !== "user")
  ) {
    return NextResponse.json({ message: "参数不完整。" }, { status: 400 });
  }

  try {
    const user = await updateManagedUserRole({
      email: body.email,
      role: body.role,
      actorEmail: session.user.email,
    });

    return NextResponse.json({
      message: body.role === "admin" ? "已授予管理员。" : "已设为普通用户。",
      user,
    });
  } catch (error) {
    const message = getApiErrorMessage(error, "角色更新失败，请稍后再试。");

    return NextResponse.json({ message }, { status: 400 });
  }
}
