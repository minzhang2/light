import { NextResponse } from "next/server";

import {
  createInviteCode,
  listInviteCodes,
} from "@/features/invite-codes/service";
import { requireAdminSession } from "@/lib/auth/admin";

export async function GET() {
  await requireAdminSession();

  const inviteCodes = await listInviteCodes();

  return NextResponse.json({ inviteCodes });
}

export async function POST(request: Request) {
  const session = await requireAdminSession();

  const body = (await request.json().catch(() => null)) as
    | { note?: unknown }
    | null;

  const note = typeof body?.note === "string" ? body.note : "";
  const inviteCode = await createInviteCode(note ? { note } : {}, session.user.email);

  return NextResponse.json(
    { message: "邀请码已生成。", inviteCode },
    { status: 201 },
  );
}
