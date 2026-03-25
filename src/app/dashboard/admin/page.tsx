import type { Metadata } from "next";

import { AdminUserManager } from "@/components/admin-user-manager";
import { DashboardPageHeader } from "@/components/dashboard-page-header";
import { listManagedUsers } from "@/features/admin-users/service";
import { requireEnvironmentAdminSession } from "@/lib/auth/admin";

export const metadata: Metadata = {
  title: "管理后台",
  description: "管理员账号和角色管理",
};

export default async function DashboardAdminPage() {
  const session = await requireEnvironmentAdminSession();
  const users = await listManagedUsers();

  return (
    <>
      <DashboardPageHeader
        title="管理后台"
        description="集中管理管理员权限和用户角色。"
      />
      <AdminUserManager
        initialUsers={users}
        currentAdminEmail={session.user.email ?? ""}
      />
    </>
  );
}
