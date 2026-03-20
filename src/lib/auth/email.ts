import nodemailer from "nodemailer";

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
): Promise<MailDeliveryResult> {
  const smtp = readSmtpConfig();

  if (!smtp) {
    console.info(`[auth] login code for ${email}: ${code}`);
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
    subject: "Your login verification code",
    text: `Your verification code is ${code}. It will expire in 10 minutes.`,
    html: `<p>Your verification code is <strong>${code}</strong>.</p><p>It will expire in 10 minutes.</p>`,
  });

  return {
    delivery: "smtp",
  };
}
