import { prisma } from "../../config/prisma.js";
import { asaas } from "./billing.service.js";
import { sendAccessEmail } from "../../providers/notifications/email.provider.js";
import { PLAN_CATALOG, monthlyPlanValue } from "../../config/plans.js";

// Plano contratável = tem mensalidade positiva definida no catálogo (fonte única).
// Enterprise (monthly: null / sob consulta) e demo/dev ficam de fora do self-service.
function isContractablePlan(plan) {
  return (PLAN_CATALOG[plan]?.monthly ?? 0) > 0;
}

const TRIAL_DAYS = 14; // primeira cobrança no 15º dia

// Chave Asaas da IASO (não a da clínica) — a mensalidade é cobrada pela Iaso.
function iasoKey() {
  const key = process.env.ASAAS_API_KEY;
  if (!key) throw new Error("ASAAS_API_KEY (conta Iaso) não configurada.");
  return key;
}

function trialEndDate() {
  const d = new Date();
  d.setDate(d.getDate() + TRIAL_DAYS + 1); // 15º dia
  return d;
}

// Cria (ou reusa) o customer da clínica na conta Asaas da Iaso e abre a
// assinatura recorrente mensal do plano contratado.
//
// Dados de cartão NUNCA passam por aqui: a assinatura sai sempre como
// billingType UNDEFINED e o cliente escolhe PIX/cartão/boleto no checkout
// hospedado do Asaas (1ª cobrança emitida no fim do trial). Isso mantém a
// aplicação fora do escopo PCI-DSS.
async function createSubscription(user, plan, trialEnd) {
  const key = iasoKey();
  const price = monthlyPlanValue(plan);

  // customer da clínica na conta Iaso
  const customer = await asaas("POST", "/customers", {
    name: user.clinicName || user.name,
    email: user.email,
    cpfCnpj: (user.cpf || user.cnpj || "").replace(/\D/g, "") || undefined,
  }, key);

  const subscription = await asaas("POST", "/subscriptions", {
    customer: customer.id,
    billingType: "UNDEFINED",
    value: price,
    nextDueDate: trialEnd.toISOString().slice(0, 10),
    cycle: "MONTHLY",
    description: `Iasoclin — plano ${plan}`,
  }, key);

  return { subscription, price };
}

// Cancela a assinatura recorrente da clínica na conta Asaas da Iaso.
// Sem isso o Asaas continua emitindo a mensalidade todo mês mesmo depois da
// conta ser excluída aqui — a assinatura vive lá, não no nosso banco.
// Deletar a subscription também remove as cobranças dela ainda não pagas.
// Não lança: a exclusão da conta não pode falhar por causa do Asaas.
export async function cancelSubscription(user) {
  if (!user?.asaasSubscriptionId) return false;
  try {
    await asaas("DELETE", `/subscriptions/${user.asaasSubscriptionId}`, null, iasoKey());
    return true;
  } catch (e) {
    console.error(`[cancelSubscription] ${user.asaasSubscriptionId}:`, e.message);
    return false;
  }
}

// Registra a mensalidade no Financeiro do Admin (aba Faturamento) como
// lançamento recorrente aprovado.
async function registerFinancialEntry(user, plan, price) {
  await prisma.adminFinancialEntry.create({
    data: {
      type: "receita",
      description: `Mensalidade Iasoclin — ${user.clinicName || user.name}`,
      amount: price,
      category: "assinatura",
      planType: plan,
      paymentMethod: "credit_card",
      clinicId: user.id,
      clinicName: user.clinicName || user.name,
      recorrente: true,
      recorrencia: "mensal",
      // Nasce como PREVISÃO (pendente). A baixa efetiva vem do webhook quando o
      // Asaas confirma o recebimento (PAYMENT_RECEIVED) — regime de caixa.
      status: "pendente",
      createdBy: "Sistema (self-service)",
    },
  }).catch((e) => console.error("[contratar] registerFinancialEntry:", e.message));
}

// Notificação informativa (não bloqueante) a todos os ADMINs: nova clínica ativa.
async function notifyCS(user) {
  const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
  await Promise.all(admins.map((a) =>
    prisma.adminNotification.create({
      data: {
        userId: a.id,
        content: `Nova clínica ativa (self-service): ${user.clinicName || user.name}`,
        author: "Sistema",
      },
    }).catch((e) => console.error("[contratar] notifyCS:", e.message))
  ));
}

// Card no CRM entra automaticamente em "fechado". Reaproveita o Lead criado
// na demo (casado por telefone), promovendo "demo" → "fechado".
async function upsertLead(user, acquisitionChannel, value) {
  // e-mail de login da demo é sintético (demo+...@demo.iasoclin); casa por telefone.
  const existing = user.phone
    ? await prisma.lead.findFirst({ where: { phone: user.phone }, orderBy: { createdAt: "desc" } })
    : null;

  const data = {
    name: user.clinicName || user.name,
    phone: user.phone || null,
    clinicName: user.clinicName || null,
    source: "self-service",
    status: "fechado",
    value: value ?? null, // MRR do plano contratado — alimenta "Fechados (MRR)" no kanban
  };
  if (existing) {
    // preserva o e-mail real coletado na demo, se houver
    await prisma.lead.update({ where: { id: existing.id }, data });
  } else {
    await prisma.lead.create({ data });
  }
}

// Fluxo self-service completo: Fechamento + Onboarding automáticos.
// `user` é o registro logado (conta demo sendo promovida, ou conta real).
export async function contratar(userId, payload) {
  const { plan, lgpdVersion, contractVersion, acquisitionChannel } = payload;

  if (!isContractablePlan(plan)) throw new Error("Plano inválido.");

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("Usuário não encontrado.");

  // 1. Assinatura recorrente Asaas — 1ª cobrança no fim do trial (D+15).
  const trialEnd = trialEndDate();
  const { subscription, price } = await createSubscription(user, plan, trialEnd);

  // 2. Promove a conta demo → real, grava aceites e limpa a expiração.
  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      plan,
      demoExpiresAt: null,
      leadSource: user.leadSource || "self-service",
      acquisitionChannel: acquisitionChannel || user.acquisitionChannel || null,
      lgpdAcceptedAt: new Date(),
      lgpdVersion: lgpdVersion || null,
      contractAcceptedAt: new Date(),
      contractVersion: contractVersion || null,
      asaasSubscriptionId: subscription.id,
      subscriptionStatus: "trialing", // vira "active" no 1º pagamento confirmado (webhook)
      trialEndsAt: trialEnd,
      // conta passa a ser ativa/em uso — alimenta o score de CS (loginCount/lastLoginAt)
      lastLoginAt: new Date(),
      loginCount: user.loginCount > 0 ? undefined : 1,
    },
  });

  // 3. Efeitos colaterais (não bloqueiam a resposta de sucesso).
  await registerFinancialEntry(updated, plan, price);
  await upsertLead(updated, acquisitionChannel, price);
  await notifyCS(updated);
  await sendAccessEmail(updated.email, { name: updated.name }).catch((e) =>
    console.error("[contratar] sendAccessEmail:", e.message)
  );

  return updated;
}
