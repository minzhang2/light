import type { Metadata } from "next";
import Link from "next/link";

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
  const canAccessAdminConsole = isEnvironmentAdminEmail(session.user.email);
  const canAccessInvites = session.user.role === "admin";

  return (
    <>
      <DashboardPageHeader
        title="控制台"
        description="这里保留总览入口，重点功能已经补到 Key 管理页面。"
      />
      <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
        <section className="relative overflow-hidden rounded-[2rem] border border-border/70 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.18),_transparent_32%),linear-gradient(135deg,_rgba(255,255,255,0.96),_rgba(248,250,252,0.94))] p-8 shadow-sm">
          <div className="max-w-2xl">
            <p className="text-sm font-medium uppercase tracking-[0.28em] text-sky-700">
              Key Workspace
            </p>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">
              统一管理 Claude / Codex key
            </h1>
            <p className="mt-4 text-base leading-7 text-slate-600">
              已经新增专门的管理页，可以批量导入、自动去重、搜索、复制，并对不同协议做可用性测试。
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              {canAccessAdminConsole ? (
                <Button
                  variant="outline"
                  nativeButton={false}
                  render={<Link href="/dashboard/admin" />}
                >
                  管理后台
                </Button>
              ) : null}
              {canAccessInvites ? (
                <Button
                  variant="outline"
                  nativeButton={false}
                  render={<Link href="/dashboard/invites" />}
                >
                  管理邀请码
                </Button>
              ) : null}
              <Button nativeButton={false} render={<Link href="/dashboard/keys" />}>
                进入 Key 管理
              </Button>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {[
            ...(canAccessInvites
              ? [{
                  title: "邀请码注册",
                  text: "当前关闭公开注册，先在后台生成邀请码，再发给需要开通账号的人。",
                }]
              : []),
            {
              title: "批量导入",
              text: "直接粘贴你现在这种 export 文本，系统会自动解析并合并重复项。",
            },
            {
              title: "快速搜索",
              text: "支持按名称、域名、模型、别名检索，找 key 会比在纯文本里翻快很多。",
            },
            {
              title: "在线测试",
              text: "每条记录都可以单独做协议测试，快速判断 Claude 或 Codex 是否还能正常连通。",
            },
          ].map((item) => (
            <div
              key={item.title}
              className="rounded-3xl border border-border/70 bg-card p-5 shadow-sm"
            >
              <h2 className="text-lg font-semibold">{item.title}</h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                {item.text}
              </p>
            </div>
          ))}
        </section>
      </div>
    </>
  );
}
