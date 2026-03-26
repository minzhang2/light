"use client";

import { useMemo, useState } from "react";
import { BriefcaseBusiness } from "lucide-react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

import { PasswordVerificationForm } from "@/components/auth/password-verification-form";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldSeparator,
  FieldLabel,
  FieldError,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Mode = "password" | "email-code" | "register" | "reset-password";

type LoginFormProps = {
  socialProviders: {
    google: boolean;
    apple: boolean;
  };
  requireInviteCode: boolean;
};

export function LoginForm({ socialProviders, requireInviteCode }: LoginFormProps) {
  const router = useRouter();

  const [mode, setMode] = useState<Mode>("password");
  const [codeRequested, setCodeRequested] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [code, setCode] = useState("");

  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const isBusy = loading || sendingCode;

  const canSendCode = useMemo(
    () => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()),
    [email],
  );

  function clearNotice() {
    setMessage(null);
    setError(null);
  }

  function switchMode(nextMode: Mode) {
    setMode(nextMode);
    clearNotice();
    if (nextMode !== "email-code") {
      setCodeRequested(false);
      setCode("");
    }
    if (nextMode !== "register") {
      setConfirmPassword("");
      setInviteCode("");
    }
    if (nextMode !== "reset-password") {
      setPassword("");
    }
  }

  async function signInByCredentials(
    provider: "password" | "email-code",
    payload: Record<string, string>,
  ) {
    const result = await signIn(provider, {
      redirect: false,
      callbackUrl: "/dashboard",
      ...payload,
    });

    if (!result || result.error) {
      throw new Error("登录失败，请检查输入内容。");
    }

    router.push(result.url ?? "/dashboard");
    router.refresh();
  }

  async function requestCode() {
    if (!canSendCode) {
      setError("请先输入有效邮箱。");
      return false;
    }

    setSendingCode(true);
    try {
      const response = await fetch("/api/auth/send-code", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = (await response.json().catch(() => null)) as
        | { message?: string; devCode?: string }
        | null;

      if (!response.ok) {
        setError(data?.message ?? "发送验证码失败。");
        return false;
      }

      setCodeRequested(true);
      const suffix = data?.devCode ? ` 开发验证码：${data.devCode}` : "";
      setMessage(`${data?.message ?? "验证码已发送。"}${suffix}`);
      return true;
    } catch {
      setError("发送验证码失败，请稍后重试。");
      return false;
    } finally {
      setSendingCode(false);
    }
  }

  async function handleEmailCodeSubmit(event: React.FormEvent) {
    event.preventDefault();
    clearNotice();

    if (!codeRequested) {
      await requestCode();
      return;
    }

    if (!email || !code) {
      setError("请输入邮箱和验证码。");
      return;
    }

    setLoading(true);
    try {
      await signInByCredentials("email-code", {
        email: email.trim(),
        code: code.trim(),
      });
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "登录失败。");
      setLoading(false);
    }
  }

  async function handlePasswordLogin(event: React.FormEvent) {
    event.preventDefault();
    clearNotice();

    if (!email || !password) {
      setError("请输入邮箱和密码。");
      return;
    }

    setLoading(true);
    try {
      await signInByCredentials("password", {
        email: email.trim(),
        password,
      });
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "登录失败。");
      setLoading(false);
    }
  }

  async function handleRegister(event: React.FormEvent) {
    event.preventDefault();
    clearNotice();

    if (!email || !password || !confirmPassword) {
      setError(
        requireInviteCode
          ? "请输入邮箱、邀请码、密码和确认密码。"
          : "请输入邮箱、密码和确认密码。",
      );
      return;
    }

    if (requireInviteCode && !inviteCode) {
      setError("请输入邀请码。");
      return;
    }
    if (password !== confirmPassword) {
      setError("两次密码输入不一致。");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          inviteCode: inviteCode.trim(),
          password,
          confirmPassword,
        }),
      });

      const data = (await response.json().catch(() => null)) as
        | { message?: string }
        | null;

      if (!response.ok) {
        setError(data?.message ?? "注册失败。");
        setLoading(false);
        return;
      }

      setMessage(data?.message ?? "账号创建成功，正在登录...");
      await signInByCredentials("password", {
        email: email.trim(),
        password,
      });
    } catch {
      setError("注册失败，请稍后重试。");
      setLoading(false);
    }
  }

  async function handleSocialSignIn(provider: "google" | "apple") {
    clearNotice();

    if (!socialProviders[provider]) {
      setError(
        provider === "google"
          ? "Google 登录暂未配置。"
          : "Apple 登录暂未配置。",
      );
      return;
    }

    setLoading(true);
    try {
      await signIn(provider, { callbackUrl: "/dashboard" });
    } catch {
      setError("发起第三方登录失败。");
      setLoading(false);
    }
  }

  if (mode === "reset-password") {
    return (
      <div className={cn("flex flex-col gap-6")}>
        <div className="flex flex-col items-center gap-2 text-center">
          <a
            href="#"
            className="flex flex-col items-center gap-2 font-medium"
          >
            <div className="flex size-8 items-center justify-center rounded-md">
              <BriefcaseBusiness className="size-6" />
            </div>
            <span className="sr-only">Light Inc.</span>
          </a>
          <h1 className="text-xl font-bold">重置密码</h1>
          <FieldDescription>
            想起来了？{" "}
            <button
              className="underline underline-offset-4 hover:text-primary"
              disabled={loading || sendingCode}
              onClick={() => switchMode("password")}
              type="button"
            >
              返回登录
            </button>
          </FieldDescription>
        </div>

        <PasswordVerificationForm
          initialEmail={email}
          sendCodePath="/api/auth/password/send-code"
          submitPath="/api/auth/password/reset"
          requestButtonLabel="发送重置验证码"
          submitButtonLabel="更新密码"
          idleHint="输入邮箱后发送验证码，验证通过后即可设置新密码。"
          successHint="密码已更新，请返回登录并使用新密码。"
          onSuccess={({ email: nextEmail }) => {
            setEmail(nextEmail);
            setMode("password");
            setMessage("密码已更新，请使用新密码登录。");
            setError(null);
          }}
        />
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-6")}>
      <form
        onSubmit={
          mode === "register"
            ? handleRegister
            : mode === "password"
              ? handlePasswordLogin
              : handleEmailCodeSubmit
        }
      >
        <FieldGroup>
          <div className="flex flex-col items-center gap-2 text-center">
            <a
              href="#"
              className="flex flex-col items-center gap-2 font-medium"
            >
              <div className="flex size-8 items-center justify-center rounded-md">
                <BriefcaseBusiness className="size-6" />
              </div>
              <span className="sr-only">Light Inc.</span>
            </a>
            <h1 className="text-xl font-bold">欢迎来到 Light Inc.</h1>
            <FieldDescription>
              {mode === "register" ? "已有账号？" : "还没有账号？"}
              <button
                className="underline underline-offset-4 hover:text-primary"
                disabled={isBusy}
                onClick={() => switchMode(mode === "register" ? "password" : "register")}
                type="button"
              >
                {mode === "register" ? "登录" : "注册"}
              </button>
            </FieldDescription>
          </div>

          {mode === "register" && (
            <Field>
              <FieldLabel htmlFor="name">姓名</FieldLabel>
              <Input
                id="name"
                autoComplete="name"
                disabled={isBusy}
                onChange={(event) => setName(event.target.value)}
                placeholder="请输入姓名"
                type="text"
                value={name}
              />
            </Field>
          )}

          <Field>
            <FieldLabel htmlFor="email">邮箱</FieldLabel>
            <Input
              id="email"
              autoComplete="email"
              disabled={isBusy}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="m@example.com"
              type="email"
              value={email}
            />
          </Field>

          {mode === "register" && requireInviteCode && (
            <Field>
              <FieldLabel htmlFor="invite-code">邀请码</FieldLabel>
              <Input
                id="invite-code"
                autoComplete="off"
                disabled={isBusy}
                onChange={(event) => setInviteCode(event.target.value)}
                placeholder="LGTX-XXXX-XXXX"
                type="text"
                value={inviteCode}
              />
              <FieldDescription>
                当前仅支持邀请码注册。
              </FieldDescription>
            </Field>
          )}

          {(mode === "password" || mode === "register") && (
            <Field>
              <FieldLabel htmlFor="password">密码</FieldLabel>
              <Input
                id="password"
                autoComplete={mode === "register" ? "new-password" : "current-password"}
                disabled={isBusy}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="至少 8 位"
                type="password"
                value={password}
              />
              {mode === "password" ? (
                <FieldDescription>
                  <button
                    className="underline underline-offset-4 hover:text-primary"
                    disabled={isBusy}
                    onClick={() => switchMode("reset-password")}
                    type="button"
                  >
                    忘记密码？通过邮箱验证码重置
                  </button>
                </FieldDescription>
              ) : null}
            </Field>
          )}

          {mode === "register" && (
            <Field>
              <FieldLabel htmlFor="confirm-password">确认密码</FieldLabel>
              <Input
                id="confirm-password"
                autoComplete="new-password"
                disabled={isBusy}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="请再次输入密码"
                type="password"
                value={confirmPassword}
              />
            </Field>
          )}

          {mode === "email-code" && codeRequested && (
            <Field>
              <FieldLabel htmlFor="code">验证码</FieldLabel>
              <Input
                id="code"
                disabled={isBusy}
                onChange={(event) => setCode(event.target.value)}
                placeholder="6 位验证码"
                type="text"
                value={code}
              />
            </Field>
          )}

          {error && (
            <FieldError>{error}</FieldError>
          )}

          {message && !error && (
            <FieldDescription className="text-center">
              {message}
            </FieldDescription>
          )}

          <Field>
            <Button type="submit" size="lg" disabled={isBusy}>
              {mode === "register"
                ? loading
                  ? "注册中..."
                  : "注册"
                : mode === "password"
                  ? loading
                    ? "登录中..."
                    : "登录"
                  : codeRequested
                    ? loading
                      ? "验证中..."
                      : "验证并登录"
                    : sendingCode
                      ? "发送验证码中..."
                      : "发送验证码"}
            </Button>
          </Field>

          <div className="text-center">
            <FieldDescription>
              {mode === "email-code" ? (
                <button
                  className="underline underline-offset-4 hover:text-primary"
                  disabled={isBusy}
                  onClick={() => switchMode("password")}
                  type="button"
                >
                  使用密码登录
                </button>
              ) : (
                <button
                  className="underline underline-offset-4 hover:text-primary"
                  disabled={isBusy}
                  onClick={() => switchMode("email-code")}
                  type="button"
                >
                  使用邮箱验证码登录
                </button>
              )}
            </FieldDescription>
          </div>

          <FieldSeparator>或</FieldSeparator>

          <Field className="grid gap-4 sm:grid-cols-2">
            <Button
              size="lg"
              disabled={isBusy}
              onClick={() => handleSocialSignIn("apple")}
              type="button"
              variant="outline"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                <path
                  d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"
                  fill="currentColor"
                />
              </svg>
              使用 Apple 继续
            </Button>
            <Button
              size="lg"
              disabled={isBusy}
              onClick={() => handleSocialSignIn("google")}
              type="button"
              variant="outline"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                <path
                  d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
                  fill="currentColor"
                />
              </svg>
              使用 Google 继续
            </Button>
          </Field>
        </FieldGroup>
      </form>
      <FieldDescription className="px-6 text-center">
        点击继续即表示你同意我们的{" "}
        <a href="#">《服务条款》</a>{" "}
        和 <a href="#">《隐私政策》</a>。
      </FieldDescription>
    </div>
  );
}
