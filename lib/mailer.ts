import nodemailer, { type Transporter } from "nodemailer";

let transport: Transporter | null = null;

function getTransport() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, ""); // app passwords are shown with spaces
  if (!user || !pass) throw new Error("Missing GMAIL_USER or GMAIL_APP_PASSWORD");
  transport ??= nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user, pass },
  });
  return transport;
}

export async function sendOtpEmail(to: string, code: string) {
  const name = process.env.MAIL_FROM_NAME ?? "Teach for a Cause";
  await getTransport().sendMail({
    from: `"${name}" <${process.env.GMAIL_USER}>`,
    to,
    subject: `${code} is your Teach for a Cause code`,
    text: [
      `Your code is ${code}.`,
      "",
      "Enter it on the waitlist page to finish joining. It expires in 10 minutes.",
      "",
      "If you didn't ask for this, you can ignore this email and nothing will happen.",
      "",
      "Teach for a Cause is a free, student led music lesson program in North Carolina. After this code we send one more email, when the list changes, and we delete your address within 30 days of sending it.",
    ].join("\n"),
    html: `<div style="font-family:Georgia,serif;background:#F8F6EE;padding:24px;color:#2A2622">
  <div style="max-width:480px;margin:0 auto;background:#FDFCF8;border:1px solid #DDD8C8;border-radius:16px;padding:28px">
    <p style="margin:0 0 8px;font-size:16px">Your code is</p>
    <p style="margin:0 0 16px;font-size:36px;letter-spacing:6px;font-weight:bold;color:#A8482A">${code}</p>
    <p style="margin:0 0 12px;font-size:16px;line-height:1.5">Enter it on the waitlist page to finish joining. It expires in 10 minutes.</p>
    <p style="margin:0 0 12px;font-size:14px;line-height:1.5;color:#675F56">If you didn't ask for this, you can ignore this email and nothing will happen.</p>
    <p style="margin:0;font-size:14px;line-height:1.5;color:#675F56">Teach for a Cause is a free, student led music lesson program in North Carolina. After this code we send one more email, when the list changes, and we delete your address within 30 days of sending it.</p>
  </div>
</div>`,
  });
}
