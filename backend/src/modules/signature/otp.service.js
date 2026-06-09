import crypto from "crypto";
import { prisma } from "../../config/prisma.js";
import { sendOtp } from "../../providers/notifications/index.js";

const OTP_TTL_MINUTES = 10;
const MAX_ATTEMPTS    = 5;
const MAX_SENDS_PER_HOUR = 5;

function generateCode() {
  return String(Math.floor(100000 + crypto.randomInt(900000))).padStart(6, "0");
}

export async function requestOtp({ context, method, target, documentName }) {
  // Rate limit: máximo MAX_SENDS_PER_HOUR envios por hora para o mesmo contexto
  const since = new Date(Date.now() - 3600 * 1000);
  const recentCount = await prisma.otpCode.count({
    where: { context, createdAt: { gte: since } },
  });
  if (recentCount >= MAX_SENDS_PER_HOUR) {
    throw new Error("Muitas tentativas. Aguarde 1 hora antes de solicitar um novo código.");
  }

  // Invalida códigos anteriores não utilizados para o mesmo contexto
  await prisma.otpCode.updateMany({
    where: { context, usedAt: null },
    data: { expiresAt: new Date(0) },
  });

  const code = generateCode();
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

  await prisma.otpCode.create({
    data: { context, method, target, code, expiresAt },
  });

  await sendOtp(method, target, code, documentName);
  return { sent: true, method, maskedTarget: maskTarget(method, target) };
}

export async function validateOtp({ context, code }) {
  const record = await prisma.otpCode.findFirst({
    where: {
      context,
      usedAt:    null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!record) {
    throw new Error("Código expirado ou não encontrado. Solicite um novo.");
  }

  // Incrementa tentativas antes de validar (proteção contra brute force)
  await prisma.otpCode.update({
    where: { id: record.id },
    data:  { attempts: { increment: 1 } },
  });

  if (record.attempts + 1 >= MAX_ATTEMPTS) {
    await prisma.otpCode.update({
      where: { id: record.id },
      data:  { expiresAt: new Date(0) },
    });
    throw new Error("Número máximo de tentativas atingido. Solicite um novo código.");
  }

  if (record.code !== code) {
    throw new Error("Código inválido.");
  }

  // Marca como utilizado
  await prisma.otpCode.update({
    where: { id: record.id },
    data:  { usedAt: new Date() },
  });

  return { valid: true };
}

function maskTarget(method, target) {
  if (method === "email") {
    const [local, domain] = target.split("@");
    return `${local.slice(0, 2)}***@${domain}`;
  }
  // phone/whatsapp: mantém só últimos 4 dígitos
  return `****${target.slice(-4)}`;
}
