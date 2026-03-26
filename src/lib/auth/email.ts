import nodemailer from "nodemailer";

import {
  getEmailOtpCopy,
  type EmailOtpPurpose,
} from "@/lib/auth/email-otp";

export type MailDeliveryResult = {
  delivery: "smtp" | "log";
  previewCode?: string;
};

function readSmtpConfig() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM;
  const port = Number(process.env.SMTP_PORT ?? "587");

  if (!host || !user || !pass || !from) {
    return null;
  }

  return {
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    from,
  };
}

export async function sendLoginCodeEmail(
  email: string,
  code: string,
  purpose: EmailOtpPurpose = "login",
): Promise<MailDeliveryResult> {
  const smtp = readSmtpConfig();
  const mailCopy = getEmailOtpCopy(purpose);

  if (!smtp) {
    console.info(`[auth] ${mailCopy.actionLabel}验证码（${email}）：${code}`);
    return {
      delivery: "log",
      previewCode: code,
    };
  }

  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: smtp.auth,
  });

  await transporter.sendMail({
    from: smtp.from,
    to: email,
    subject: mailCopy.subject,
    text: `你的验证码是 ${code}。${mailCopy.text}`,
    html: `<p>你的验证码是 <strong>${code}</strong>。</p><p>${mailCopy.text}</p>`,
  });

  return {
    delivery: "smtp",
  };
}
