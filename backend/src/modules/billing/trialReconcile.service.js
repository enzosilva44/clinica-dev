// Reconciliação de trial: confere se o trial vencido virou cobrança de verdade.
//
// POR QUE ISSO EXISTE: nada no código encerra o trial — quem encerra é o Asaas,
// emitindo a cobrança do 15º dia. Quando isso falha, o banco fica em "trialing"
// para sempre e a clínica usa o sistema completo de graça, em silêncio. Foi o
// que aconteceu com a primeira cliente real: trial vencido em 12/08, assinatura
// depois excluída no Asaas, zero cobranças, e ninguém percebeu por 23 dias.
//
// Este job compara nosso banco com o estado real da assinatura no Asaas e
// levanta a mão quando os dois discordam. Ele NÃO bloqueia acesso nem cobra
// ninguém sozinho: decisão comercial é humana. Ele transforma silêncio em
// alerta.

import { prisma } from "../../config/prisma.js";
import { asaas } from "./billing.service.js";

function iasoKey() {
  const key = process.env.ASAAS_API_KEY;
  if (!key) throw new Error("ASAAS_API_KEY (conta Iaso) não configurada.");
  return key;
}

// Situações que exigem atenção humana, da mais grave para a mais branda.
export const PROBLEMAS = Object.freeze({
  SEM_ASSINATURA: "trial vencido e nenhuma assinatura no Asaas",
  ASSINATURA_EXCLUIDA: "assinatura excluída no Asaas — nunca vai cobrar",
  SEM_COBRANCA: "trial vencido e nenhuma cobrança emitida",
  VENCIMENTO_ADIADO: "vencimento da 1ª cobrança rolou para depois do trial",
});

// Consulta o estado real da assinatura no Asaas.
async function estadoNoAsaas(subscriptionId, key) {
  const sub = await asaas("GET", `/subscriptions/${subscriptionId}`, null, key);
  const pays = await asaas("GET", `/payments?subscription=${subscriptionId}&limit=100`, null, key);
  return { sub, cobrancas: pays?.data ?? [] };
}

// Analisa uma clínica com trial vencido. Retorna o problema encontrado ou null.
async function analisar(user, key) {
  if (!user.asaasSubscriptionId) {
    return { problema: PROBLEMAS.SEM_ASSINATURA, detalhe: null };
  }

  let estado;
  try {
    estado = await estadoNoAsaas(user.asaasSubscriptionId, key);
  } catch (e) {
    // Falha de rede/API não é diagnóstico — não inventa problema onde não sabe.
    console.error(`[trialReconcile] ${user.email}: erro ao consultar Asaas — ${e.message}`);
    return null;
  }

  const { sub, cobrancas } = estado;

  if (sub?.deleted) {
    return { problema: PROBLEMAS.ASSINATURA_EXCLUIDA, detalhe: `status=${sub.status}` };
  }
  if (!cobrancas.length) {
    return { problema: PROBLEMAS.SEM_COBRANCA, detalhe: `nextDueDate=${sub?.nextDueDate ?? "?"}` };
  }

  // Há cobrança, mas o vencimento foi empurrado para muito depois do trial:
  // o Asaas rolou o ciclo sem cobrar (foi o caso da Ana Flávia, 12/08 → 12/10).
  const proxima = sub?.nextDueDate ? new Date(sub.nextDueDate) : null;
  const trialEnd = new Date(user.trialEndsAt);
  const trintaDias = 30 * 86_400_000;
  if (proxima && proxima.getTime() - trialEnd.getTime() > trintaDias && !cobrancas.some((c) => c.status === "RECEIVED" || c.status === "CONFIRMED")) {
    return {
      problema: PROBLEMAS.VENCIMENTO_ADIADO,
      detalhe: `trial acabou ${user.trialEndsAt.toISOString().slice(0, 10)}, vencimento em ${sub.nextDueDate}`,
    };
  }

  return null; // trial vencido mas cobrança existe e faz sentido
}

// Notifica todos os ADMINs. Não lança: alerta que falha não pode derrubar o job.
async function alertarAdmins(achados) {
  if (!achados.length) return;

  const linhas = achados.map(
    (a) => `• ${a.clinica} (${a.email}): ${a.problema}${a.detalhe ? ` [${a.detalhe}]` : ""}`
  );
  const content =
    `Trial vencido sem cobrança — ${achados.length} clínica(s) exigem atenção:\n` +
    linhas.join("\n");

  const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
  await Promise.all(
    admins.map((a) =>
      prisma.adminNotification
        .create({ data: { userId: a.id, content, author: "Sistema (reconciliação)" } })
        .catch((e) => console.error("[trialReconcile] alerta:", e.message))
    )
  );
}

// Varre as clínicas com trial vencido e reporta divergências com o Asaas.
// Retorna os achados (útil para teste e para chamada manual via rota admin).
export async function reconcileTrials({ silencioso = false } = {}) {
  const hoje = new Date();

  const candidatos = await prisma.user.findMany({
    where: {
      role: "PROFESSIONAL",
      subscriptionStatus: "trialing",
      trialEndsAt: { not: null, lt: hoje },
    },
    select: {
      id: true, email: true, name: true, clinicName: true,
      asaasSubscriptionId: true, trialEndsAt: true,
    },
  });

  if (!candidatos.length) {
    console.log("[trialReconcile] nenhum trial vencido em aberto.");
    return [];
  }

  const key = iasoKey();
  const achados = [];

  for (const user of candidatos) {
    const r = await analisar(user, key);
    if (!r) continue;
    achados.push({
      userId: user.id,
      email: user.email,
      clinica: user.clinicName || user.name,
      diasVencido: Math.floor((hoje - new Date(user.trialEndsAt)) / 86_400_000),
      ...r,
    });
  }

  for (const a of achados) {
    console.warn(
      `[trialReconcile] ${a.email}: ${a.problema} (trial vencido há ${a.diasVencido}d)`
    );
  }

  if (!silencioso) await alertarAdmins(achados);

  console.log(
    `[trialReconcile] ${candidatos.length} trial(is) vencido(s) verificado(s), ${achados.length} com problema.`
  );
  return achados;
}
