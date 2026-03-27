import { NextResponse } from "next/server";

import {
  createInviteCode,
  listInviteCodes,
} from "@/features/invite-codes/service";
import { getUserRoleById } from "@/lib/auth/admin";
import { getApiErrorMessage } from "@/lib/api-error";
import { getSessionOrNull } from "@/lib/auth/require-session";

export async function GET() {
  const session = await getSessionOrNull();

  if (!session?.user) {
    return NextResponse.json({ message: "请先登录。" }, { status: 401 });
  }

  const role = await getUserRoleById(session.user.id, session.user.email);
  if (role !== "admin") {
    return NextResponse.json({ message: "无权限访问。" }, { status: 403 });
  }

  try {
    const inviteCodes = await listInviteCodes();
    return NextResponse.json({ inviteCodes });
  } catch (error) {
    const message = getApiErrorMessage(error, "获取邀请码列表失败，请稍后重试。");
    return NextResponse.json({ message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getSessionOrNull();

  if (!session?.user) {
    return NextResponse.json({ message: "请先登录。" }, { status: 401 });
  }

  const role = await getUserRoleById(session.user.id, session.user.email);
  if (role !== "admin") {
    return NextResponse.json({ message: "无权限访问。" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as
    | { note?: unknown }
    | null;

  const note = typeof body?.note === "string" ? body.note : "";
  try {
    const inviteCode = await createInviteCode(note ? { note } : {}, session.user.email);

    return NextResponse.json(
      { message: "邀请码已生成。", inviteCode },
      { status: 201 },
    );
  } catch (error) {
    const message = getApiErrorMessage(error, "生成邀请码失败，请稍后重试。");
    return NextResponse.json({ message }, { status: 500 });
  }
}
