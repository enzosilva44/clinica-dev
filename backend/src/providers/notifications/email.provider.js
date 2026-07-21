import nodemailer from "nodemailer";

function createTransport() {
  return nodemailer.createTransport({
    host:   process.env.SMTP_HOST   || "smtp.gmail.com",
    port:   Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

const FROM = process.env.SMTP_FROM || "Iasoclin <noreply@iasoclin.com.br>";

export async function sendEmailOtp(to, code, documentName) {
  if (!process.env.SMTP_HOST && !process.env.SMTP_USER) {
    console.warn(`[OTP] SMTP não configurado. Código para ${to}: ${code}`);
    return;
  }

  const transport = createTransport();
  await transport.sendMail({
    from: FROM,
    to,
    subject: `${code} — Código de assinatura | Iasoclin`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#fff;border:1px solid #E8E0D2;border-radius:12px">
        <h2 style="color:#1F4D46;margin:0 0 8px">Código de Assinatura</h2>
        <p style="color:#555;font-size:14px;margin:0 0 24px">
          Para assinar o documento <strong>${documentName}</strong>, utilize o código abaixo:
        </p>
        <div style="background:#F5F1EA;border-radius:8px;padding:20px;text-align:center;margin-bottom:24px">
          <span style="font-size:36px;font-weight:700;color:#1F4D46;letter-spacing:8px">${code}</span>
        </div>
        <p style="color:#888;font-size:12px;margin:0">
          Este código expira em <strong>10 minutos</strong>.<br>
          Se você não solicitou esta assinatura, ignore este e-mail.
        </p>
        <hr style="border:none;border-top:1px solid #E8E0D2;margin:24px 0">
        <p style="color:#aaa;font-size:11px;margin:0">Iasoclin · Assinatura Eletrônica</p>
      </div>
    `,
  });
}

// E-mail de boas-vindas / acesso após contratação self-service.
export async function sendAccessEmail(to, { name, loginUrl }) {
  if (!process.env.SMTP_HOST && !process.env.SMTP_USER) {
    console.warn(`[AccessEmail] SMTP não configurado. Acesso liberado para ${to}.`);
    return;
  }

  const url = loginUrl || process.env.APP_URL || "https://sistema.iasoclin.com.br";
  const transport = createTransport();
  await transport.sendMail({
    from: FROM,
    to,
    subject: "Bem-vinda ao Iasoclin — sua conta está ativa 🎉",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#fff;border:1px solid #E8E0D2;border-radius:12px">
        <h2 style="color:#1F4D46;margin:0 0 8px">Sua conta está ativa!</h2>
        <p style="color:#555;font-size:14px;margin:0 0 20px">
          Olá${name ? `, ${name}` : ""}! Sua contratação foi concluída e você já pode usar o Iasoclin.
          Você tem <strong>14 dias grátis</strong> — a primeira cobrança acontece só no 15º dia.
        </p>
        <div style="text-align:center;margin-bottom:24px">
          <a href="${url}" style="display:inline-block;background:#1F4D46;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px">Acessar o sistema</a>
        </div>
        <p style="color:#888;font-size:12px;margin:0">
          Qualquer dúvida, é só responder este e-mail ou falar com a gente no WhatsApp.
        </p>
        <hr style="border:none;border-top:1px solid #E8E0D2;margin:24px 0">
        <p style="color:#aaa;font-size:11px;margin:0">Iasoclin · Tecnologia que cuida de quem cuida.</p>
      </div>
    `,
  });
}
