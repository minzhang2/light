import type { Metadata } from "next";

import { DashboardPageHeader } from "@/components/dashboard-page-header";
import { InviteCodeManager } from "@/components/invite-code-manager";
import { listInviteCodes } from "@/features/invite-codes/service";
import { requireAdminSession } from "@/lib/auth/admin";

export const metadata: Metadata = {
  title: "邀请码",
  description: "生成和查看邀请码",
};

export default async function DashboardInvitesPage() {
  await requireAdminSession();
  const inviteCodes = await listInviteCodes();

  return (
    <>
      <DashboardPageHeader
        title="邀请码"
        description="当前项目关闭公开注册，只有持有邀请码的用户才能创建账号。"
      />
      <InviteCodeManager initialInviteCodes={inviteCodes} />
    </>
  );
}
