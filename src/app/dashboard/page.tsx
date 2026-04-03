import type { Metadata } from "next";
import Link from "next/link";
import {
  BookTextIcon,
  KeyRoundIcon,
  MailIcon,
  MessageCircleIcon,
  ShieldIcon,
  TicketIcon,
} from "lucide-react";

import { DashboardPageHeader } from "@/components/dashboard-page-header";
import { Button } from "@/components/ui/button";
import { isEnvironmentAdminEmail } from "@/lib/auth/admin";
import { requireSession } from "@/lib/auth/require-session";

export const metadata: Metadata = {
  title: "控制台",
  description: "登录后页面",
};

export default function DashboardPage() {
  const sessionPromise = requireSession();
  return <DashboardPageContent sessionPromise={sessionPromise} />;
}

async function DashboardPageContent({
  sessionPromise,
}: {
  sessionPromise: ReturnType<typeof requireSession>;
}) {
  const session = await sessionPromise;
  const canAccessAdmin = isEnvironmentAdminEmail(session.user.email);
  const canAccessInvites = session.user.role === "admin";

  return (
    <>
      <DashboardPageHeader title="控制台" />

      <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <QuickLink
            href="/dashboard/chat"
            icon={<MessageCircleIcon className="h-5 w-5" />}
            title="聊天"
            description="直接使用已验证的 key 和模型发起多轮对话。"
          />
          <QuickLink
            href="/dashboard/notes"
            icon={<BookTextIcon className="h-5 w-5" />}
            title="笔记"
            description="记录富文本笔记，支持自动保存、分享和预览。"
          />
          <QuickLink
            href="/dashboard/keys"
            icon={<KeyRoundIcon className="h-5 w-5" />}
            title="Key 管理"
            description="导入、搜索、测试和导出 Claude / Codex key。"
          />
          <QuickLink
            href="/dashboard/mail"
            icon={<MailIcon className="h-5 w-5" />}
            title="临时邮箱"
            description="分配临时邮箱并获取验证码。"
          />
          {canAccessInvites && (
            <QuickLink
              href="/dashboard/invites"
              icon={<TicketIcon className="h-5 w-5" />}
              title="邀请码"
              description="生成和管理邀请码，控制新用户注册。"
            />
          )}
          {canAccessAdmin && (
            <QuickLink
              href="/dashboard/admin"
              icon={<ShieldIcon className="h-5 w-5" />}
              title="管理后台"
              description="用户管理与系统配置。"
            />
          )}
        </div>
      </div>
    </>
  );
}

function QuickLink({
  href,
  icon,
  title,
  description,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Button
      variant="outline"
      nativeButton={false}
      render={<Link href={href} />}
      className="h-auto flex-col items-start gap-2 rounded-2xl p-5 text-left"
    >
      <div className="text-muted-foreground">{icon}</div>
      <div>
        <div className="text-sm font-semibold">{title}</div>
        <p className="mt-1 text-xs font-normal text-muted-foreground">
          {description}
        </p>
      </div>
    </Button>
  );
}
