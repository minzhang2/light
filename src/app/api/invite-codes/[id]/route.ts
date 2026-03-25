import { NextResponse } from "next/server";

import { removeInviteCode } from "@/features/invite-codes/service";
import { requireAdminSession } from "@/lib/auth/admin";

export async function DELETE(
  _request: Request,
  context: RouteContext<"/api/invite-codes/[id]">,
) {
  await requireAdminSession();

  const { id } = await context.params;

  try {
    const inviteCodes = await removeInviteCode(id);

    return NextResponse.json({
      message: "邀请码已删除。",
      inviteCodes,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "删除失败，请稍后再试。";

    return NextResponse.json({ message }, { status: 400 });
  }
}
