import type { Metadata } from "next";

import { DashboardPageHeader } from "@/components/dashboard-page-header";
import { ManagedKeyManager } from "@/components/managed-key-manager";
import { listManagedKeys } from "@/features/managed-keys/service";

export const metadata: Metadata = {
  title: "Key 管理",
  description: "集中管理 Claude 和 Codex key",
};

export default async function DashboardKeysPage() {
  const keys = await listManagedKeys();

  return (
    <>
      <DashboardPageHeader
        title="Key 管理"
        description="搜索、复制、导入并测试 Claude / Codex key 的可用性。"
      />
      <ManagedKeyManager initialKeys={keys} />
    </>
  );
}
