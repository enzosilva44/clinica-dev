import { prisma } from "../../config/prisma.js";
import { asaas } from "./billing.service.js";
import { sendAccessEmail } from "../../providers/notifications/email.provider.js";
import {
  PLAN_CATALOG, monthlyPlanValue,
  MODALIDADES, isModalidadeValida, cobrancaDaModalidade,
} from "../../config/plans.js";
import { documentoAsaas } from "../../lib/documentos.js";

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
async function createSubscription(user, plan, modalidade, firstDueDate) {
  const key = iasoKey();
  const { value, cycle } = cobrancaDaModalidade(plan, modalidade);

  // Sem CPF/CNPJ válido o Asaas não emite cobrança — a assinatura até nasce,
  // mas nunca vira fatura, e a clínica usa o sistema de graça. Falhar aqui é
  // melhor que descobrir no 15º dia.
  const cpfCnpj = documentoAsaas(user);
  if (!cpfCnpj) {
    throw new Error(
      "Informe um CPF ou CNPJ válido no seu cadastro para contratar."
    );
  }

  // customer da clínica na conta Iaso
  const customer = await asaas("POST", "/customers", {
    name: user.clinicName || user.name,
    email: user.email,
    cpfCnpj,
  }, key);

  const rotulo = {
    anual_avista: "anual à vista",
    anual_parcelado: "anual parcelado em 12×",
    mensal: "mensal",
  }[modalidade];

  const subscription = await asaas("POST", "/subscriptions", {
    customer: customer.id,
    billingType: "UNDEFINED",
    value,
    nextDueDate: firstDueDate.toISOString().slice(0, 10),
    cycle,
    description: `Iasoclin — plano ${plan} (${rotulo})`,
  }, key);

  // A 1ª cobrança da assinatura é o que o cliente precisa pagar. O Asaas a
  // emite junto com a assinatura, mas não a devolve no corpo — buscamos para
  // ter o invoiceUrl (link do checkout) e o id, usados na tela de pagamento.
  const charge = await primeiraCobranca(subscription.id, key);

  return { subscription, charge, price: value, cycle };
}

// Busca a cobrança mais antiga em aberto da assinatura. Retorna null se o
// Asaas ainda não gerou nenhuma — quem chama decide se isso é problema.
async function primeiraCobranca(subscriptionId, key) {
  try {
    const r = await asaas("GET", `/payments?subscription=${subscriptionId}&limit=10`, null, key);
    const lista = r?.data ?? [];
    if (!lista.length) return null;
    return lista.sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)))[0];
  } catch (e) {
    console.error(`[primeiraCobranca] ${subscriptionId}:`, e.message);
    return null;
  }
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
//
// Dois caminhos de entrada, definidos por `entrada`:
//
//   "trial"  → 14 dias grátis, acesso liberado NA HORA. A 1ª cobrança vence no
//              15º dia; o CPF/CNPJ coletado no cadastro é o que permite ao
//              Asaas emiti-la. Status: "trialing".
//   "direto" → sem trial. A cobrança vence hoje e o acesso só abre quando o
//              webhook confirmar o pagamento. Status: "pending_payment".
//
// Em ambos o cliente paga no checkout hospedado do Asaas — nenhum dado de
// cartão passa pela aplicação.
export async function contratar(userId, payload) {
  const {
    plan, lgpdVersion, contractVersion, acquisitionChannel,
    modalidade = "mensal",
    entrada = "trial",
  } = payload;

  if (!isContractablePlan(plan)) throw new Error("Plano inválido.");
  if (!isModalidadeValida(modalidade)) {
    throw new Error("Modalidade inválida. Use 'anual_avista', 'anual_parcelado' ou 'mensal'.");
  }
  if (!["trial", "direto"].includes(entrada)) {
    throw new Error("Forma de entrada inválida. Use 'trial' ou 'direto'.");
  }

  const { billingCycle, compromissoMeses } = MODALIDADES[modalidade];

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("Usuário não encontrado.");

  const comTrial = entrada === "trial";

  // 1. Assinatura no Asaas. O vencimento da 1ª cobrança é o que separa os dois
  //    caminhos: fim do trial (D+15) ou hoje.
  const trialEnd = comTrial ? trialEndDate() : null;
  const firstDueDate = trialEnd ?? new Date();
  const { subscription, charge, price } = await createSubscription(
    user, plan, modalidade, firstDueDate
  );

  // Na contratação direta a cobrança É o produto: sem o link do checkout o
  // cliente não tem como pagar e ficaria travado sem acesso.
  if (!comTrial && !charge?.invoiceUrl) {
    throw new Error(
      "Não foi possível gerar a cobrança agora. Tente novamente em alguns instantes."
    );
  }

  // 2. Promove a conta demo → real, grava aceites e limpa a expiração.
  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      plan,
      billingCycle,
      modalidade,
      // Compromisso conta do início do uso: no trial, do fim dele; no direto,
      // de hoje. Só existe nas modalidades anuais.
      compromissoAte: compromissoMeses
        ? new Date(new Date(trialEnd ?? Date.now()).setMonth(
            new Date(trialEnd ?? Date.now()).getMonth() + compromissoMeses
          ))
        : null,
      demoExpiresAt: null,
      leadSource: user.leadSource || "self-service",
      acquisitionChannel: acquisitionChannel || user.acquisitionChannel || null,
      lgpdAcceptedAt: new Date(),
      lgpdVersion: lgpdVersion || null,
      contractAcceptedAt: new Date(),
      contractVersion: contractVersion || null,
      asaasSubscriptionId: subscription.id,
      // trial libera na hora; direto só depois do webhook confirmar o pagamento
      subscriptionStatus: comTrial ? "trialing" : "pending_payment",
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
  // No caminho direto o acesso ainda não existe — o e-mail de boas-vindas sai
  // quando o pagamento for confirmado, não agora.
  if (comTrial) {
    await sendAccessEmail(updated.email, { name: updated.name }).catch((e) =>
      console.error("[contratar] sendAccessEmail:", e.message)
    );
  }

  return {
    user: updated,
    // A tela de pagamento precisa do link do checkout Asaas.
    cobranca: charge
      ? { id: charge.id, invoiceUrl: charge.invoiceUrl, value: charge.value, dueDate: charge.dueDate }
      : null,
  };
}
