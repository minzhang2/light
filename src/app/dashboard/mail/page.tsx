import type { Metadata } from "next";

import { DashboardPageHeader } from "@/components/dashboard-page-header";
import { MailContainer } from "@/components/mail-container";

export const metadata: Metadata = {
  title: "临时邮箱",
  description: "分配临时邮箱并获取验证码",
};

export default function MailPage() {
  return (
    <div className="flex h-svh min-h-0 flex-col overflow-hidden">
      <DashboardPageHeader
        title="临时邮箱"
        description="分配临时邮箱并获取验证码。"
      />
      <div className="min-h-0 flex-1 overflow-hidden">
        <MailContainer />
      </div>
    </div>
  );
}
