import { NextResponse } from "next/server";

import { getSessionOrNull } from "@/lib/auth/require-session";
import { getMailAccounts } from "@/lib/mail-accounts";

export async function GET() {
  const session = await getSessionOrNull();
  if (!session?.user) {
    return NextResponse.json({ message: "请先登录。" }, { status: 401 });
  }

  const accounts = getMailAccounts().map((account, index) => ({
    index,
    label: account.label,
  }));

  return NextResponse.json({ accounts });
}
