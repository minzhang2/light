import type { Metadata } from "next";
import { ShieldCheckIcon } from "lucide-react";

import { PasswordVerificationForm } from "@/components/auth/password-verification-form";
import { DashboardPageHeader } from "@/components/dashboard-page-header";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/require-session";

export const metadata: Metadata = {
  title: "修改密码",
  description: "通过邮箱验证码设置或修改登录密码",
};

export default async function DashboardAccountPasswordPage() {
  const session = await requireSession();
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      email: true,
      passwordHash: true,
    },
  });

  if (!user) {
    throw new Error("未找到当前用户。");
  }

  return (
    <>
      <DashboardPageHeader title="修改密码" />

      <div className="flex flex-1 flex-col gap-5 p-4 md:p-6">
        <section className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm md:p-6">
          <div className="flex items-center gap-2.5">
            <ShieldCheckIcon className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">
              {user.passwordHash ? "修改密码" : "设置登录密码"}
            </h2>
          </div>

          {user.email ? (
            <div className="mt-4 max-w-md">
              <PasswordVerificationForm
                fixedEmail={user.email}
                sendCodePath="/api/account/password/send-code"
                submitPath="/api/account/password"
                requestButtonLabel={
                  user.passwordHash ? "发送修改验证码" : "发送设置密码验证码"
                }
                submitButtonLabel={user.passwordHash ? "确认修改密码" : "设置密码"}
                idleHint={
                  user.passwordHash
                    ? "验证码会发送到当前邮箱，验证通过后即可修改密码。"
                    : "当前账户尚未设置密码，验证邮箱后即可设置登录密码。"
                }
              />
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">
              当前账户未绑定邮箱，暂时无法通过邮箱验证码修改密码。
            </p>
          )}
        </section>
      </div>
    </>
  );
}
