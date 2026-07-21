import { prisma } from "../../config/prisma.js";

const META_API_VERSION = "v20.0";
const GRAPH = `https://graph.facebook.com/${META_API_VERSION}`;

// Estas variáveis vêm do SEU app na Meta (após virar Tech Provider aprovado):
//   APP_ID       — ID do app Meta for Developers
//   APP_SECRET   — secret do app (troca de code por token)
const APP_ID = process.env.APP_ID;
const APP_SECRET = process.env.APP_SECRET;

function assertConfigured() {
  if (!APP_ID || !APP_SECRET) {
    throw new Error(
      "Integração WhatsApp ainda não está configurada no servidor (APP_ID / APP_SECRET ausentes)."
    );
  }
}

// 1) Troca o `code` do Embedded Signup por um token de sistema de longa duração.
async function exchangeCodeForToken(code) {
  assertConfigured();
  const url = `${GRAPH}/oauth/access_token?client_id=${APP_ID}&client_secret=${APP_SECRET}&code=${encodeURIComponent(
    code
  )}`;
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok || !data.access_token) {
    throw new Error(data?.error?.message || "Falha ao trocar o código de autorização com a Meta.");
  }
  return data.access_token;
}

// 2) Descobre o WABA e o phone_number_id que a clínica autorizou.
// O Embedded Signup pode já devolver esses IDs no callback; aqui buscamos como fallback.
async function fetchWabaAndPhone(accessToken, wabaId, phoneNumberId) {
  // Se o frontend já passou wabaId + phoneNumberId (vindos do callback do FB SDK),
  // apenas confirmamos que estão acessíveis com este token.
  const res = await fetch(`${GRAPH}/${phoneNumberId}?fields=id,display_phone_number,verified_name`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message || "Não foi possível ler o número de WhatsApp autorizado.");
  }
  return { phoneNumberId: data.id, wabaId };
}

// 3) Registra o número na plataforma Cloud API com um PIN de 6 dígitos.
// Necessário antes de conseguir enviar mensagens por esse número.
async function registerPhoneNumber(accessToken, phoneNumberId, pin) {
  const res = await fetch(`${GRAPH}/${phoneNumberId}/register`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ messaging_product: "whatsapp", pin }),
  });
  const data = await res.json();
  // Já registrado retorna erro específico — tratamos como sucesso idempotente.
  if (!res.ok && data?.error?.code !== 100) {
    // 100 costuma acompanhar "already registered"; não falha o fluxo inteiro por isso.
    if (!/already/i.test(data?.error?.message || "")) {
      throw new Error(data?.error?.message || "Falha ao registrar o número na Cloud API.");
    }
  }
  return true;
}

// 4) Assina a WABA no app para receber webhooks de eventos desse número.
async function subscribeAppToWaba(accessToken, wabaId) {
  const res = await fetch(`${GRAPH}/${wabaId}/subscribed_apps`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message || "Falha ao assinar os webhooks da conta WhatsApp.");
  }
  return true;
}

// Orquestra todo o onboarding a partir do que o frontend recebe do Embedded Signup.
export async function connectWhatsApp(userId, { code, wabaId, phoneNumberId }) {
  assertConfigured();
  if (!code || !wabaId || !phoneNumberId) {
    throw new Error("Dados incompletos do Embedded Signup (code, wabaId e phoneNumberId são obrigatórios).");
  }

  const accessToken = await exchangeCodeForToken(code);
  const resolved = await fetchWabaAndPhone(accessToken, wabaId, phoneNumberId);

  // PIN determinístico por clínica evita pedir dígito ao usuário; guarde só se precisar reusar.
  const pin = String(100000 + (Number(userId) % 900000)).slice(0, 6).padStart(6, "0");
  await registerPhoneNumber(accessToken, resolved.phoneNumberId, pin);
  await subscribeAppToWaba(accessToken, resolved.wabaId);

  await prisma.user.update({
    where: { id: userId },
    data: {
      whatsappAccessToken: accessToken,
      whatsappPhoneNumberId: resolved.phoneNumberId,
      whatsappWabaId: resolved.wabaId,
      whatsappStatus: "connected",
      whatsappConnectedAt: new Date(),
    },
  });

  return { status: "connected", phoneNumberId: resolved.phoneNumberId };
}

export async function getWhatsAppStatus(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { whatsappStatus: true, whatsappPhoneNumberId: true, whatsappConnectedAt: true },
  });
  return {
    connected: user?.whatsappStatus === "connected",
    phoneNumberId: user?.whatsappPhoneNumberId || null,
    connectedAt: user?.whatsappConnectedAt || null,
  };
}

export async function disconnectWhatsApp(userId) {
  await prisma.user.update({
    where: { id: userId },
    data: {
      whatsappAccessToken: null,
      whatsappWabaId: null,
      whatsappStatus: null,
      whatsappConnectedAt: null,
    },
  });
  return { status: "disconnected" };
}
