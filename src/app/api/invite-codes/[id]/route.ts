import { NextResponse } from "next/server";

import { removeInviteCode } from "@/features/invite-codes/service";
import { getUserRoleById } from "@/lib/auth/admin";
import { getSessionOrNull } from "@/lib/auth/require-session";
import { getApiErrorMessage } from "@/lib/api-error";

export async function DELETE(
  _request: Request,
  context: RouteContext<"/api/invite-codes/[id]">,
) {
  const session = await getSessionOrNull();

  if (!session?.user) {
    return NextResponse.json({ message: "请先登录。" }, { status: 401 });
  }

  const role = await getUserRoleById(session.user.id, session.user.email);
  if (role !== "admin") {
    return NextResponse.json({ message: "无权限访问。" }, { status: 403 });
  }

  const { id } = await context.params;

  try {
    const inviteCodes = await removeInviteCode(id);

    return NextResponse.json({
      message: "邀请码已删除。",
      inviteCodes,
    });
  } catch (error) {
    const message = getApiErrorMessage(error, "删除失败，请稍后再试。");

    return NextResponse.json({ message }, { status: 400 });
  }
}
