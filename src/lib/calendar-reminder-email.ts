import nodemailer from "nodemailer";

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

export async function sendCalendarReminderEmail(
  toEmail: string,
  noteText: string,
  lunarDateStr: string,
): Promise<void> {
  const smtp = readSmtpConfig();

  if (!smtp) {
    console.info(
      `[calendar-reminder] (no SMTP) ${toEmail}: ${lunarDateStr} - ${noteText}`,
    );
    return;
  }

  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: smtp.auth,
  });

  await transporter.sendMail({
    from: smtp.from,
    to: toEmail,
    subject: `日历提醒：${lunarDateStr}`,
    text: `今天是${lunarDateStr}，你的备注：${noteText}`,
    html: `<p>今天是 <strong>${lunarDateStr}</strong></p><p>备注：${noteText}</p>`,
  });
}
