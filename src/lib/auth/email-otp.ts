export const EMAIL_OTP_PURPOSES = [
  "login",
  "password-reset",
  "password-change",
] as const;

export type EmailOtpPurpose = (typeof EMAIL_OTP_PURPOSES)[number];

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function getEmailOtpCopy(purpose: EmailOtpPurpose) {
  if (purpose === "password-reset") {
    return {
      subject: "【Light Inc.】重置密码验证码",
      text: "请使用此验证码重置密码，30 分钟内有效。",
      actionLabel: "重置密码",
      successMessage: "验证码已发送，请检查邮箱。",
      fallbackMessage: "SMTP 未配置，密码重置验证码已输出到服务端日志。",
    };
  }

  if (purpose === "password-change") {
    return {
      subject: "【Light Inc.】修改密码验证码",
      text: "请使用此验证码修改密码，30 分钟内有效。",
      actionLabel: "修改密码",
      successMessage: "验证码已发送，请检查邮箱。",
      fallbackMessage: "SMTP 未配置，密码修改验证码已输出到服务端日志。",
    };
  }

  return {
    subject: "【Light Inc.】登录验证码",
    text: "请使用此验证码登录，30 分钟内有效。",
    actionLabel: "登录",
    successMessage: "验证码已发送，请检查邮箱。",
    fallbackMessage: "SMTP 未配置，验证码已输出到服务端日志。",
  };
}
