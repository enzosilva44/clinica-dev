import { prisma } from "../../config/prisma.js";
import { asaas } from "./billing.service.js";
import { sendAccessEmail } from "../../providers/notifications/email.provider.js";

// Valor mensal por plano (mensalidade SaaS Iaso → clínica). Mantido em código
// por enquanto; pode migrar para tabela de planos no futuro.
const PLAN_PRICE = { solo: 197, clinica: 447 };

const TRIAL_DAYS = 14; // primeira cobrança no 15º dia

// Chave Asaas da IASO (não a da clínica) — a mensalidade é cobrada pela Iaso.
function iasoKey() {
  const key = process.env.ASAAS_API_KEY;
  if (!key) throw new Error("ASAAS_API_KEY (conta Iaso) não configurada.");
  return key;
}

function firstChargeDate() {
  const d = new Date();
  d.setDate(d.getDate() + TRIAL_DAYS + 1); // 15º dia
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

// Cria (ou reusa) o customer da clínica na conta Asaas da Iaso e abre a
// assinatura recorrente mensal do plano contratado.
async function createSubscription(user, plan, card) {
  const key = iasoKey();
  const price = PLAN_PRICE[plan] ?? PLAN_PRICE.solo;

  // customer da clínica na conta Iaso
  const customer = await asaas("POST", "/customers", {
    name: user.clinicName || user.name,
    email: user.email,
    cpfCnpj: (user.cpf || user.cnpj || "").replace(/\D/g, "") || undefined,
  }, key);

  const [expMonth, expYear] = (card.expiry || "").split("/");
  const subscription = await asaas("POST", "/subscriptions", {
    customer: customer.id,
    billingType: "CREDIT_CARD",
    value: price,
    nextDueDate: firstChargeDate(),
    cycle: "MONTHLY",
    description: `Iasoclin — plano ${plan}`,
    creditCard: {
      holderName: card.holderName,
      number: card.number,
      expiryMonth: expMonth,
      expiryYear: expYear?.length === 2 ? `20${expYear}` : expYear,
      ccv: card.cvv,
    },
    creditCardHolderInfo: {
      name: card.holderName,
      email: user.email,
      cpfCnpj: (user.cpf || user.cnpj || "").replace(/\D/g, "") || undefined,
      postalCode: (user.zipCode || "").replace(/\D/g, "") || undefined,
      addressNumber: user.addressNumber || "0",
      phone: (user.phone || "").replace(/\D/g, "") || undefined,
    },
  }, key);

  return { subscription, price };
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
      status: "aprovado",
      createdBy: "Sistema (self-service)",
      approvedBy: "Sistema (self-service)",
      approvedAt: new Date(),
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
async function upsertLead(user, acquisitionChannel) {
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
  const { plan, lgpdVersion, contractVersion, card, acquisitionChannel } = payload;

  if (!PLAN_PRICE[plan]) throw new Error("Plano inválido.");
  if (!card?.number || !card?.holderName || !card?.expiry || !card?.cvv) {
    throw new Error("Dados do cartão incompletos.");
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("Usuário não encontrado.");

  // 1. Assinatura recorrente Asaas (D+15).
  const { subscription, price } = await createSubscription(user, plan, card);

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
      // conta passa a ser ativa/em uso — alimenta o score de CS (loginCount/lastLoginAt)
      lastLoginAt: new Date(),
      loginCount: user.loginCount > 0 ? undefined : 1,
      // guarda só os dados de exibição do cartão (não o número completo)
      cardBrand: subscription.creditCard?.creditCardBrand || null,
      cardLast4: subscription.creditCard?.creditCardNumber?.slice(-4) || card.number.slice(-4),
      cardHolderName: card.holderName,
      cardExpiry: card.expiry,
    },
  });

  // 3. Efeitos colaterais (não bloqueiam a resposta de sucesso).
  await registerFinancialEntry(updated, plan, price);
  await upsertLead(updated, acquisitionChannel);
  await notifyCS(updated);
  await sendAccessEmail(updated.email, { name: updated.name }).catch((e) =>
    console.error("[contratar] sendAccessEmail:", e.message)
  );

  return updated;
}
