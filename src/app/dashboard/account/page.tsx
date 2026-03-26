import type { Metadata } from "next";
import {
  ShieldCheckIcon,
  UserRoundIcon,
} from "lucide-react";

import { DashboardPageHeader } from "@/components/dashboard-page-header";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getEnabledSocialProviders } from "@/lib/auth/options";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/require-session";

export const metadata: Metadata = {
  title: "Account",
  description: "个人中心",
};

function formatDate(value: Date | null | undefined) {
  if (!value) return "未记录";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(value);
}

export default async function DashboardAccountPage() {
  const session = await requireSession();
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      emailVerified: true,
      passwordHash: true,
      createdAt: true,
      accounts: { select: { provider: true } },
      _count: { select: { sessions: true } },
    },
  });

  if (!user) throw new Error("未找到当前用户。");

  const enabledProviders = getEnabledSocialProviders();
  const linkedProviders = [
    ...new Set(user.accounts.map((a: { provider: string }) => a.provider)),
  ];
  const signInMethods = [
    user.passwordHash ? "账号密码" : null,
    user.emailVerified ? "邮箱验证码" : null,
    ...linkedProviders.map((p) =>
      p === "google" ? "Google" : p === "apple" ? "Apple" : p,
    ),
  ].filter(Boolean) as string[];
  const availableProviders = [
    "账号密码",
    "邮箱验证码",
    enabledProviders.google ? "Google" : null,
    enabledProviders.apple ? "Apple" : null,
  ].filter(Boolean) as string[];

  const avatarFallback = (user.name ?? user.email ?? "U")
    .slice(0, 1)
    .toUpperCase();
  const isAdmin = session.user.role === "admin";

  return (
    <>
      <DashboardPageHeader title="个人中心" />

      <div className="flex flex-1 flex-col gap-5 p-4 md:p-6">
        {/* Profile */}
        <section className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm md:p-6">
          <div className="flex items-start gap-4">
            <Avatar size="lg">
              {user.image && (
                <AvatarImage src={user.image} alt={user.name ?? "User"} />
              )}
              <AvatarFallback>{avatarFallback}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold tracking-tight">
                  {user.name ?? "未设置昵称"}
                </h1>
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                  {isAdmin ? "管理员" : "成员"}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {user.email ?? "未绑定邮箱"}
              </p>
            </div>
            <SignOutButton variant="outline" size="sm" />
          </div>
        </section>

        {/* Info grid */}
        <section className="grid gap-5 md:grid-cols-2">
          {/* 账户信息 */}
          <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm md:p-6">
            <div className="flex items-center gap-2.5">
              <UserRoundIcon className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">账户信息</h2>
            </div>

            <dl className="mt-4 space-y-3">
              <InfoRow label="用户 ID" value={user.id} mono />
              <InfoRow
                label="邮箱验证"
                value={
                  user.emailVerified
                    ? `已验证 · ${formatDate(user.emailVerified)}`
                    : "未验证"
                }
              />
              <InfoRow label="注册时间" value={formatDate(user.createdAt)} />
              <InfoRow
                label="活跃会话"
                value={`${user._count.sessions} 个`}
              />
              {linkedProviders.length > 0 && (
                <InfoRow
                  label="第三方绑定"
                  value={linkedProviders
                    .map((p) =>
                      p === "google"
                        ? "Google"
                        : p === "apple"
                          ? "Apple"
                          : p,
                    )
                    .join(" / ")}
                />
              )}
            </dl>
          </div>

          {/* 登录与安全 */}
          <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm md:p-6">
            <div className="flex items-center gap-2.5">
              <ShieldCheckIcon className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">登录与安全</h2>
            </div>

            <dl className="mt-4 space-y-3">
              <InfoRow
                label="已启用方式"
                value={signInMethods.join(" · ") || "未启用"}
              />
              <InfoRow
                label="系统支持"
                value={availableProviders.join(" · ")}
              />
              <InfoRow
                label="密码状态"
                value={
                  user.passwordHash ? "已设置" : "未设置，仅支持无密码登录"
                }
              />
              <InfoRow
                label="邮箱可信度"
                value={
                  user.emailVerified
                    ? "已验证，可用于验证码登录"
                    : "未验证，建议尽快完成"
                }
              />
            </dl>
          </div>
        </section>

      </div>
    </>
  );
}

function InfoRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="shrink-0 text-xs text-muted-foreground">{label}</dt>
      <dd
        className={`text-right text-sm font-medium ${mono ? "font-mono text-xs" : ""}`}
      >
        {value}
      </dd>
    </div>
  );
}
