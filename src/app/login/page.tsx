import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { LoginForm } from "@/components/auth/login-form";
import {
  authOptions,
  getEnabledSocialProviders,
} from "@/lib/auth/options";

export const metadata: Metadata = {
  title: "登录",
  description: "多方式登录页面",
};

export default async function LoginPage() {
  const session = await getServerSession(authOptions);
  if (session) {
    redirect("/dashboard");
  }

  const socialProviders = getEnabledSocialProviders();

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background p-6 md:p-10">
      <div className="w-full max-w-sm">
        <LoginForm socialProviders={socialProviders} />
      </div>
    </div>
  );
}
