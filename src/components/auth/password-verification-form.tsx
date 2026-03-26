"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

type PasswordVerificationFormProps = {
  fixedEmail?: string;
  initialEmail?: string;
  sendCodePath: string;
  submitPath: string;
  requestButtonLabel?: string;
  submitButtonLabel?: string;
  idleHint?: string;
  successHint?: string;
  onSuccess?: (result: { email: string; message: string }) => void;
};

export function PasswordVerificationForm({
  fixedEmail,
  initialEmail = "",
  sendCodePath,
  submitPath,
  requestButtonLabel = "发送验证码",
  submitButtonLabel = "更新密码",
  idleHint,
  successHint,
  onSuccess,
}: PasswordVerificationFormProps) {
  const [email, setEmail] = useState(fixedEmail ?? initialEmail);
  const [codeRequested, setCodeRequested] = useState(false);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState<string | null>(idleHint ?? null);
  const [error, setError] = useState<string | null>(null);
  const [sendingCode, setSendingCode] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const isBusy = sendingCode || submitting;
  const normalizedEmail = fixedEmail ?? email.trim();
  const canSendCode = useMemo(
    () => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail),
    [normalizedEmail],
  );

  function clearNotice() {
    setMessage(null);
    setError(null);
  }

  async function requestCode() {
    clearNotice();

    if (!canSendCode) {
      setError("请输入有效邮箱。");
      return false;
    }

    setSendingCode(true);
    try {
      const response = await fetch(sendCodePath, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: normalizedEmail }),
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

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!codeRequested) {
      await requestCode();
      return;
    }

    clearNotice();

    if (!canSendCode || !code || !password || !confirmPassword) {
      setError("请填写邮箱、验证码和新密码。");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(submitPath, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: normalizedEmail,
          code: code.trim(),
          password,
          confirmPassword,
        }),
      });

      const data = (await response.json().catch(() => null)) as
        | { message?: string }
        | null;

      if (!response.ok) {
        setError(data?.message ?? "提交失败。");
        return;
      }

      const nextMessage = successHint ?? data?.message ?? "密码已更新。";
      setMessage(nextMessage);
      setCodeRequested(false);
      setCode("");
      setPassword("");
      setConfirmPassword("");
      onSuccess?.({ email: normalizedEmail, message: nextMessage });
    } catch {
      setError("提交失败，请稍后重试。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor={`password-email-${fixedEmail ? "fixed" : "free"}`}>
            邮箱
          </FieldLabel>
          <Input
            id={`password-email-${fixedEmail ? "fixed" : "free"}`}
            autoComplete="email"
            disabled={isBusy || Boolean(fixedEmail)}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="m@example.com"
            type="email"
            value={normalizedEmail}
          />
          {fixedEmail ? (
            <FieldDescription>
              验证码将发送到当前登录邮箱。
            </FieldDescription>
          ) : null}
        </Field>

        {codeRequested ? (
          <>
            <Field>
              <FieldLabel htmlFor="password-code">验证码</FieldLabel>
              <Input
                id="password-code"
                disabled={isBusy}
                onChange={(event) => setCode(event.target.value)}
                placeholder="6 位验证码"
                type="text"
                value={code}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="new-password">新密码</FieldLabel>
              <Input
                id="new-password"
                autoComplete="new-password"
                disabled={isBusy}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="至少 8 位"
                type="password"
                value={password}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="confirm-new-password">
                确认密码
              </FieldLabel>
              <Input
                id="confirm-new-password"
                autoComplete="new-password"
                disabled={isBusy}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="请再次输入密码"
                type="password"
                value={confirmPassword}
              />
            </Field>
          </>
        ) : null}

        {error ? <FieldError>{error}</FieldError> : null}
        {message && !error ? (
          <FieldDescription className="text-center">{message}</FieldDescription>
        ) : null}

        <Field>
          <Button type="submit" size="lg" disabled={isBusy}>
            {codeRequested
              ? submitting
                ? "提交中..."
                : submitButtonLabel
              : sendingCode
                ? "发送中..."
                : requestButtonLabel}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  );
}
