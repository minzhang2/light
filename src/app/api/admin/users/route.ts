import { NextResponse } from "next/server";

import {
  listManagedUsers,
  updateManagedUserRole,
} from "@/features/admin-users/service";
import { requireEnvironmentAdminSession } from "@/lib/auth/admin";

export async function GET() {
  await requireEnvironmentAdminSession();

  const users = await listManagedUsers();
  return NextResponse.json({ users });
}

export async function PATCH(request: Request) {
  const session = await requireEnvironmentAdminSession();

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
    const message =
      error instanceof Error ? error.message : "角色更新失败，请稍后再试。";

    return NextResponse.json({ message }, { status: 400 });
  }
}
