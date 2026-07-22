import { prisma } from "../../config/prisma.js";
import { checkQuota, consumeQuota } from "./quota.service.js";
import { buildSplit } from "./split.service.js";

const BASE_URL = process.env.ASAAS_URL ?? "https://sandbox.asaas.com/api/v3";

function asaasHeaders(apiKey) {
  return {
    "Content-Type": "application/json",
    access_token: apiKey,
  };
}

export async function asaas(method, path, body, apiKey) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: asaasHeaders(apiKey),
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }

  if (!res.ok) {
    const msg = data?.errors?.[0]?.description ?? data?.message ?? `Asaas error ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

// Resolve a API key do usuário: campo no DB > .env
async function resolveKey(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { asaasApiKey: true } });
  const key = user?.asaasApiKey || process.env.ASAAS_API_KEY;
  if (!key) throw new Error("Conta Asaas não configurada. Vá em Faturamento → Configuração.");
  return key;
}

// ─── clientes ─────────────────────────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function cleanCpf(cpf) {
  if (!cpf) return undefined;
  const digits = cpf.replace(/\D/g, "");
  return digits.length >= 11 ? digits : undefined;
}

function validEmail(email) {
  return email && EMAIL_RE.test(email) ? email : undefined;
}

export async function findOrCreateCustomer(userId, patient) {
  const key = await resolveKey(userId);
  const cpf = cleanCpf(patient.cpf);
  const email = validEmail(patient.email);

  // busca por CPF, depois por e-mail — chamadas separadas para nunca passar parâmetro vazio
  if (cpf) {
    const byCpf = await asaas("GET", `/customers?cpfCnpj=${cpf}`, null, key);
    if (byCpf.data?.length > 0) return byCpf.data[0];
  }

  if (email) {
    const byEmail = await asaas("GET", `/customers?email=${encodeURIComponent(email)}`, null, key);
    if (byEmail.data?.length > 0) return byEmail.data[0];
  }

  const phone = patient.phone?.replace(/\D/g, "") || undefined;

  // tenta com cpf; se Asaas rejeitar (CPF inválido/teste), cria sem
  try {
    return await asaas("POST", "/customers", {
      name: patient.name,
      cpfCnpj: cpf,
      email: email,
      mobilePhone: phone,
    }, key);
  } catch (err) {
    if (cpf && err.message?.toLowerCase().includes("cpf")) {
      return asaas("POST", "/customers", {
        name: patient.name,
        email: email,
        mobilePhone: phone,
      }, key);
    }
    throw err;
  }
}

// ─── cobranças ────────────────────────────────────────────────────────────────

const METHOD_LABEL = { pix: "PIX", credit_card: "Cartão", boleto: "Boleto" };

export async function createCharge(userId, data) {
  const key = await resolveKey(userId);

  // garante que o cliente existe no Asaas
  let customer;
  if (data.patientId) {
    const patient = await prisma.patient.findFirst({ where: { id: data.patientId, userId } });
    if (patient) customer = await findOrCreateCustomer(userId, patient);
  }

  if (!customer) throw new Error("Paciente não encontrado para vincular a cobrança");

  // cria a Transaction no Financeiro primeiro — o ID vira externalReference no Asaas
  const transaction = await prisma.transaction.create({
    data: {
      type: "receita",
      status: "pendente",
      description: data.description || "Cobrança via Faturamento",
      amount: Number(data.amount),
      paymentMethod: METHOD_LABEL[data.method] ?? "PIX",
      dueDate: data.dueDate ? new Date(data.dueDate + "T12:00:00") : undefined,
      patientId: data.patientId ?? undefined,
      userId,
      category: "Faturamento",
    },
  });

  const billingType = { pix: "PIX", credit_card: "CREDIT_CARD", boleto: "BOLETO" }[data.method] ?? "PIX";

  // Split IASOPay: comissão retida na cobrança clínica→paciente. buildSplit decide
  // percentual vs fixo pela config do banco e omite o split (applied=false) em
  // qualquer caso inválido — a cobrança nunca quebra por causa do split.
  const clinic = await prisma.user.findUnique({
    where: { id: userId },
    select: { asaasWalletId: true },
  });
  const splitResult = await buildSplit({
    paymentMethod: data.method,
    amount: Number(data.amount),
    clinicWalletId: clinic?.asaasWalletId,
  });

  const payload = {
    customer: customer.id,
    billingType,
    value: Number(data.amount),
    dueDate: data.dueDate,
    description: data.description ?? "Cobrança Iasoclin",
    externalReference: transaction.id,
    installmentCount: billingType === "CREDIT_CARD" && data.installments > 1
      ? Number(data.installments) : undefined,
    installmentValue: billingType === "CREDIT_CARD" && data.installments > 1
      ? Math.round((Number(data.amount) / Number(data.installments)) * 100) / 100 : undefined,
    split: splitResult.split, // undefined quando não se aplica → Asaas ignora
  };

  let charge;
  try {
    charge = await asaas("POST", "/payments", payload, key);
  } catch (err) {
    // rollback: remove a transaction se o Asaas rejeitar
    await prisma.transaction.delete({ where: { id: transaction.id } }).catch(() => {});
    throw err;
  }

  // salva o ID do Asaas + o resultado do split no Transaction (rastreabilidade).
  await prisma.transaction.update({
    where: { id: transaction.id },
    data: {
      notes: `asaas:${charge.id}`,
      splitApplied: splitResult.applied,
      splitType:    splitResult.applied ? splitResult.config.splitType  : null,
      splitValue:   splitResult.applied ? splitResult.config.splitValue : null,
      iasoRevenue:  splitResult.applied ? splitResult.iasoRevenue       : null,
    },
  });

  return { ...charge, transactionId: transaction.id };
}

export async function listCharges(userId, params = {}) {
  const key = await resolveKey(userId);
  const qs = new URLSearchParams({
    limit: "50",
    offset: "0",
    ...params,
  }).toString();
  return asaas("GET", `/payments?${qs}`, null, key);
}

export async function getCharge(userId, chargeId) {
  const key = await resolveKey(userId);
  const charge = await asaas("GET", `/payments/${chargeId}`, null, key);

  // se for PIX e pendente, busca o QR code
  if (charge.billingType === "PIX" && charge.status === "PENDING") {
    try {
      const pix = await asaas("GET", `/payments/${chargeId}/pixQrCode`, null, key);
      charge.pixQrCode = pix;
    } catch { /* QR code pode não estar disponível ainda */ }
  }

  return charge;
}

export async function cancelCharge(userId, chargeId) {
  const key = await resolveKey(userId);
  const result = await asaas("DELETE", `/payments/${chargeId}`, null, key);

  // marca a Transaction vinculada como cancelada — evita registro órfão no Financeiro.
  // só cancela se ainda estiver pendente (não reverte algo já pago)
  await prisma.transaction.updateMany({
    where: { userId, notes: `asaas:${chargeId}`, status: "pendente" },
    data: { status: "cancelado" },
  });

  return result;
}

export async function simulatePayment(userId, chargeId) {
  const key = await resolveKey(userId);
  const charge = await asaas("GET", `/payments/${chargeId}`, null, key);
  const today = new Date().toISOString().split("T")[0];

  const result = await asaas("POST", `/payments/${chargeId}/receiveInCash`, {
    paymentDate: today,
    value: charge.value,
  }, key);

  // sincroniza com o Financeiro direto — webhook pode não disparar em ambiente local
  if (charge.externalReference) {
    await prisma.transaction.updateMany({
      where: { id: charge.externalReference },
      data: { status: "pago", paidAt: new Date() },
    });
  }

  return result;
}

// ─── saldo & transferências ───────────────────────────────────────────────────

export async function getBalance(userId) {
  const key = await resolveKey(userId);
  return asaas("GET", "/finance/balance", null, key);
}

export async function createTransfer(userId, { pixAddressKey, value, pixAddressKeyType }) {
  const key = await resolveKey(userId);
  return asaas("POST", "/transfers", {
    value: Number(value),
    pixAddressKey,
    pixAddressKeyType: pixAddressKeyType ?? "EMAIL",
  }, key);
}

export async function listTransfers(userId) {
  const key = await resolveKey(userId);
  return asaas("GET", "/transfers?limit=20", null, key);
}

// ─── configuração ─────────────────────────────────────────────────────────────

export async function saveConfig(userId, { asaasApiKey, defaultPixKey, clinicName }) {
  // testa a chave antes de salvar
  if (asaasApiKey) {
    try {
      await asaas("GET", "/finance/balance", null, asaasApiKey);
    } catch {
      throw new Error("Chave Asaas inválida ou sem permissão. Verifique e tente novamente.");
    }

    await prisma.user.update({
      where: { id: userId },
      data: { asaasApiKey },
    });
  }

  return { ok: true };
}

export async function getConfig(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { asaasApiKey: true, asaasAccountId: true, asaasAccountStatus: true },
  });
  return {
    connected: !!user?.asaasApiKey || !!process.env.ASAAS_API_KEY,
    hasCustomKey: !!user?.asaasApiKey,
    hasSubaccount: !!user?.asaasAccountId,
    subaccountStatus: user?.asaasAccountStatus ?? null,
  };
}

// ─── IASOPay: criação de subconta Asaas (1 por tenant/User) ──────────────────
// Usa a chave RAIZ da IASO (env) para criar uma subconta cujo apiKey/walletId
// ficam salvos no próprio User. A partir daí resolveKey passa a usá-los, e todas
// as cobranças da clínica caem na conta dela. Raiz precisa ser PJ/CNPJ.

const onlyDigits = (v) => (v || "").replace(/\D/g, "");

function buildSubaccountPayload(user, incomeValue) {
  const isPJ = (user.personType || "").toLowerCase() === "pj" || !!user.cnpj;
  const cpfCnpj = onlyDigits(isPJ ? user.cnpj : user.cpf);

  const income = Number(incomeValue);

  const missing = [];
  if (!user.name && !user.clinicName)  missing.push("nome");
  if (!user.email)                     missing.push("e-mail");
  if (!cpfCnpj)                        missing.push(isPJ ? "CNPJ" : "CPF");
  if (!user.zipCode)                   missing.push("CEP");
  if (!isPJ && !user.birthDate)        missing.push("data de nascimento");
  if (!income || income <= 0)          missing.push(isPJ ? "faturamento mensal" : "renda mensal");
  if (missing.length) {
    throw new Error(
      `Complete os dados antes de ativar o IASOPay. Faltam: ${missing.join(", ")}.`
    );
  }

  // O e-mail é o login/acesso do titular no Asaas — precisa ser real e válido.
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRe.test(user.email)) {
    throw new Error("E-mail inválido. Use um e-mail real e ativo — ele será seu acesso ao Asaas para receber e sacar.");
  }

  const payload = {
    name:          user.clinicName || user.name,
    email:         user.email,
    cpfCnpj,
    mobilePhone:   onlyDigits(user.phone) || undefined,
    incomeValue:   income,
    address:       user.street || undefined,
    addressNumber: user.addressNumber || undefined,
    complement:    user.complement || undefined,
    province:      user.neighborhood || undefined,
    postalCode:    onlyDigits(user.zipCode),
  };

  if (isPJ) {
    // LIMITED cobre a maioria das clínicas PJ; MEI/associação a clínica ajusta no Asaas.
    payload.companyType = "LIMITED";
  } else {
    payload.birthDate = user.birthDate
      ? new Date(user.birthDate).toISOString().slice(0, 10)
      : undefined;
  }

  return payload;
}

export async function createSubaccount(userId, { incomeValue } = {}) {
  const rootKey = process.env.ASAAS_API_KEY;
  if (!rootKey) throw new Error("Chave raiz Asaas (ASAAS_API_KEY) não configurada no servidor.");

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("Usuário não encontrado.");
  if (user.asaasAccountId) {
    return { alreadyExists: true, accountId: user.asaasAccountId, status: user.asaasAccountStatus };
  }

  const payload = buildSubaccountPayload(user, incomeValue);

  // Chamada com a chave RAIZ (não a do usuário)
  const account = await asaas("POST", "/accounts", payload, rootKey);

  await prisma.user.update({
    where: { id: userId },
    data: {
      asaasApiKey:        account.apiKey        ?? user.asaasApiKey,
      asaasWalletId:      account.walletId      ?? null,
      asaasAccountId:     account.id            ?? null,
      asaasAccountStatus: account.status || account.accountStatus || "pending",
    },
  });

  // Registra o webhook NA subconta (com a apiKey dela) apontando de volta pro
  // nosso endpoint. Não-bloqueante: se falhar, a subconta já está criada/salva —
  // o webhook pode ser reconfigurado depois sem refazer a conta.
  let webhook = null;
  if (account.apiKey) {
    try {
      webhook = await registerSubaccountWebhook(account.apiKey);
    } catch (err) {
      console.warn(`[subaccount] webhook não registrado p/ ${account.id}: ${err.message}`);
    }
  }

  return {
    accountId: account.id,
    walletId:  account.walletId,
    status:    account.status || account.accountStatus || "pending",
    webhookRegistered: !!webhook,
  };
}

// URL pública do nosso endpoint de webhook. Override explícito via
// ASAAS_WEBHOOK_URL; senão deriva de APP_URL; senão o domínio padrão.
function webhookEndpoint() {
  if (process.env.ASAAS_WEBHOOK_URL) return process.env.ASAAS_WEBHOOK_URL;
  const base = (process.env.APP_URL || "https://sistema.iasoclin.com.br").replace(/\/$/, "");
  return `${base}/billing/webhook`;
}

// Cria o webhook na subconta (chamada feita COM a apiKey da subconta). Todos os
// eventos de pagamento relevantes ao split são assinados. O authToken viaja no
// header `asaas-access-token` — o mesmo que billing.routes valida.
export async function registerSubaccountWebhook(subaccountApiKey) {
  const url = webhookEndpoint();
  const payload = {
    name: "IASOPay",
    url,
    email: process.env.ASAAS_WEBHOOK_EMAIL || undefined,
    enabled: true,
    interrupted: false,
    authToken: process.env.ASAAS_WEBHOOK_TOKEN || undefined,
    sendType: "SEQUENTIALLY",
    events: [
      "PAYMENT_RECEIVED",
      "PAYMENT_CONFIRMED",
      "PAYMENT_REFUNDED",
      "PAYMENT_DELETED",
      "PAYMENT_OVERDUE",
    ],
  };
  return asaas("POST", "/webhooks", payload, subaccountApiKey);
}

// ─── IASOPay: walletId da conta RAIZ (destino do Split) ──────────────────────
// O Split do Asaas divide para uma walletId de destino, não para uma apiKey.
// A comissão da IASO cai na wallet da conta root. Descobrimos 1x via GET /wallets
// com a chave raiz e guardamos em AdminSetting (key-value, sem migração).

const IASOPAY_WALLET_KEY = "iasopay_wallet_id";

// Busca no Asaas a walletId da conta root e persiste. Idempotente: pode rodar
// de novo para atualizar. Aceita override por env (ASAAS_ROOT_WALLET_ID) sem
// bater na API.
export async function syncIasopayWallet(updatedBy = "Sistema") {
  const rootKey = process.env.ASAAS_API_KEY;
  if (!rootKey) throw new Error("Chave raiz Asaas (ASAAS_API_KEY) não configurada no servidor.");

  let walletId = process.env.ASAAS_ROOT_WALLET_ID;
  if (!walletId) {
    const res = await asaas("GET", "/wallets", null, rootKey);
    // A conta root costuma ter uma única wallet; usa a primeira retornada.
    walletId = res?.data?.[0]?.id;
    if (!walletId) throw new Error("Não foi possível obter a walletId da conta raiz Asaas (GET /wallets vazio).");
  }

  await prisma.adminSetting.upsert({
    where:  { key: IASOPAY_WALLET_KEY },
    update: { value: { walletId }, updatedBy },
    create: { key: IASOPAY_WALLET_KEY, value: { walletId }, updatedBy },
  });

  return { walletId };
}

// Lê a walletId root já sincronizada. Retorna null se ainda não configurada —
// nesse caso o Split é omitido (cobrança segue 100% na clínica, sem quebrar).
export async function getIasopayWalletId() {
  if (process.env.ASAAS_ROOT_WALLET_ID) return process.env.ASAAS_ROOT_WALLET_ID;
  const row = await prisma.adminSetting.findUnique({ where: { key: IASOPAY_WALLET_KEY } });
  return row?.value?.walletId ?? null;
}

// ─── envio de link via WhatsApp ───────────────────────────────────────────────

export async function sendPaymentLink(userId, chargeId) {
  const key    = await resolveKey(userId);
  const charge = await asaas("GET", `/payments/${chargeId}`, null, key);

  const link = charge.invoiceUrl || charge.bankSlipUrl;
  if (!link) throw new Error("Link de pagamento ainda não disponível para esta cobrança.");

  // busca o paciente via externalReference (ID da Transaction)
  let phone;
  if (charge.externalReference) {
    const tx = await prisma.transaction.findUnique({
      where: { id: charge.externalReference },
      select: { patient: { select: { phone: true, name: true } } },
    });
    phone = tx?.patient?.phone?.replace(/\D/g, "");
  }

  if (!phone) throw new Error("Paciente sem telefone cadastrado para envio do link.");

  const patientName = charge.externalReference
    ? (await prisma.transaction.findUnique({
        where: { id: charge.externalReference },
        select: { patient: { select: { name: true } } },
      }))?.patient?.name
    : null;

  const { sendWhatsAppMessage, sendWhatsAppTemplate } = await import("../whatsapp/whatsapp.provider.js");
  const { getActiveTemplate, interpolate } = await import("../automations/automation.service.js");

  // Credenciais WhatsApp do usuário/clínica com fallback para env
  const userWa = await prisma.user.findUnique({
    where: { id: userId },
    select: { whatsappPhoneNumberId: true, whatsappAccessToken: true },
  });
  const waConfig = {
    phoneNumberId: userWa?.whatsappPhoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID,
    accessToken:   userWa?.whatsappAccessToken   || process.env.WHATSAPP_ACCESS_TOKEN,
  };
  if (!waConfig.phoneNumberId || !waConfig.accessToken) {
    throw new Error("WhatsApp não configurado. Acesse Automações → Conexão e salve suas credenciais.");
  }

  // Cota de WhatsApp esgotada: bloqueia só o envio do link (controller traduz em 402).
  const quota = await checkQuota(userId, "whatsapp");
  if (!quota.ok) {
    const { QuotaExceededError } = await import("./quota.service.js");
    throw new QuotaExceededError("whatsapp", { used: quota.used, limit: quota.limit });
  }

  const method = { PIX: "PIX", CREDIT_CARD: "Cartão de crédito", BOLETO: "Boleto" }[charge.billingType] ?? charge.billingType;
  const value  = Number(charge.value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const firstName = (patientName || "").split(" ")[0] || "tudo bem";

  // Envio proativo (fora da janela de 24h) exige Message Template aprovado na Meta.
  // O link vai como VARIÁVEL do template "link_pagamento" — 1 template serve p/
  // toda cobrança. Se a clínica tem o template ativo, usa-o; senão, cai em texto
  // livre (só entrega dentro da janela de 24h, mas mantém compatibilidade).
  const tpl = await getActiveTemplate(userId, "payment_link");
  if (tpl?.metaTemplateName) {
    const vars = { nome: firstName, valor: `${value} (${method})`, link };
    const params = (tpl.metaVariables || []).map((k) => vars[k] ?? "");
    await sendWhatsAppTemplate(phone, tpl.metaTemplateName, params, {
      ...waConfig,
      language: tpl.metaLanguage || "pt_BR",
    });
  } else {
    const message = tpl
      ? interpolate(tpl.body, { nome: firstName, valor: `${value} (${method})`, link })
      : `Olá! Segue o link para pagamento da sua cobrança no valor de *${value}* (${method}):\n\n${link}\n\nEm caso de dúvidas, entre em contato conosco.`;
    await sendWhatsAppMessage(phone, message, waConfig);
  }

  await consumeQuota(userId, "whatsapp", 1, { source: "sendPaymentLink", chargeId: charge.id });
  return { ok: true, phone, link, viaTemplate: !!tpl?.metaTemplateName };
}

// ─── webhook ──────────────────────────────────────────────────────────────────

export async function handleWebhook(event) {
  const { event: type, payment } = event;
  console.log(`[webhook] recebido: ${type}` +
    (payment ? ` | pay=${payment.id} sub=${payment.subscription || "-"} ref=${payment.externalReference || "-"}` : " | sem payment"));
  if (!payment) return;

  // ── Assinatura SaaS (mensalidade Iaso → clínica) ──────────────────────────
  // Pagamentos de subscription trazem payment.subscription (ID da assinatura),
  // que casa com User.asaasSubscriptionId. Reconcilia o status de acesso.
  if (payment.subscription) {
    await reconcileSubscription(type, payment.subscription, payment);
    return; // eventos de subscription não têm externalReference de Transaction
  }

  // ── Cobrança avulsa (Financeiro da clínica → paciente) ────────────────────
  if (!payment.externalReference) return;

  // Top-up de cota (CLÍNICA→IASO): externalReference = "topup:<user>:<res>:<amt>".
  // Ao confirmar, credita as unidades avulsas no ciclo atual.
  if (payment.externalReference.startsWith("topup:")) {
    if (type === "PAYMENT_CONFIRMED" || type === "PAYMENT_RECEIVED") {
      const { creditTopupFromWebhook } = await import("./usage.service.js");
      await creditTopupFromWebhook(payment.externalReference);
    }
    return;
  }

  if (type === "PAYMENT_CONFIRMED" || type === "PAYMENT_RECEIVED") {
    await prisma.transaction.updateMany({
      where: { id: payment.externalReference },
      data: { status: "pago", paidAt: new Date() },
    });
    // Split: a comissão IASOPay já foi registrada no createCharge (iasoRevenue).
    // O recebimento apenas confirma; não recalcula para não divergir do que o
    // Asaas efetivamente reteve. Log de conciliação.
    const tx = await prisma.transaction.findUnique({
      where: { id: payment.externalReference },
      select: { splitApplied: true, iasoRevenue: true },
    });
    if (tx?.splitApplied) {
      console.log(`[webhook] cobrança ${payment.id} recebida com split — comissão IASOPay ≈ R$${tx.iasoRevenue ?? 0}.`);
    }
  }

  // Estorno ou exclusão da cobrança: reverte a Transaction no Financeiro da clínica.
  // O Asaas também estorna o split proporcionalmente; aqui só refletimos o status.
  if (type === "PAYMENT_REFUNDED" || type === "PAYMENT_DELETED") {
    const newStatus = type === "PAYMENT_REFUNDED" ? "estornado" : "cancelado";
    const res = await prisma.transaction.updateMany({
      where: { id: payment.externalReference },
      data: { status: newStatus, paidAt: null },
    });
    if (res.count) {
      console.log(`[webhook] cobrança ${payment.id} → ${newStatus} (Transaction ${payment.externalReference}).`);
    }
  }

  if (type === "PAYMENT_OVERDUE") {
    await prisma.transaction.updateMany({
      where: { id: payment.externalReference, status: "pendente" },
      data: { status: "pendente" }, // mantém pendente, frontend filtra vencidos por dueDate
    });
  }
}

// Sincroniza o status da assinatura SaaS a partir dos eventos de pagamento do
// Asaas. active = em dia; past_due = venceu; suspended = cancelada por falta de
// pagamento (Asaas expira a subscription após N tentativas).
async function reconcileSubscription(type, subscriptionId, payment) {
  const map = {
    PAYMENT_CONFIRMED: "active",
    PAYMENT_RECEIVED: "active",
    PAYMENT_OVERDUE: "past_due",
    PAYMENT_DELETED: "canceled",
    PAYMENT_REFUNDED: "past_due",
  };
  const status = map[type];
  if (!status) return; // evento sem impacto no acesso

  const data = { subscriptionStatus: status };
  if (status === "active") {
    // Pagou: trial virou assinatura paga e zera qualquer atraso pendente.
    data.trialEndsAt = null;
    data.overdueSince = null;
  } else if (status === "past_due") {
    // Marca o início do atraso só uma vez (a carência de 10 dias conta daqui).
    const u = await prisma.user.findFirst({
      where: { asaasSubscriptionId: subscriptionId },
      select: { overdueSince: true },
    });
    if (u && !u.overdueSince) data.overdueSince = new Date();
  }

  const res = await prisma.user.updateMany({
    where: { asaasSubscriptionId: subscriptionId },
    data,
  });
  if (res.count === 0) {
    console.warn(`[webhook] subscription ${subscriptionId} sem clínica correspondente (evento ${type}).`);
    return;
  }
  console.log(`[webhook] assinatura ${subscriptionId} → status=${status} (${res.count} clínica[s]).`);

  // Baixa no Faturamento (Admin) — regime de caixa: só quando o dinheiro cai
  // (PAYMENT_RECEIVED). Uma entrada efetivada por pagamento.
  if (type === "PAYMENT_RECEIVED") {
    await settleSubscriptionPayment(subscriptionId, payment);
  }
}

// Cria (ou efetiva) o lançamento de receita da mensalidade no Faturamento.
// Idempotente: usa recorrenciaRef = ID do pagamento Asaas para não duplicar se
// o webhook reenviar o mesmo evento. Na 1ª cobrança, reaproveita o lançamento
// "pendente" criado na contratação; nos meses seguintes, cria um novo.
async function settleSubscriptionPayment(subscriptionId, payment) {
  const paymentId = payment?.id;
  if (!paymentId) return;

  // Já lançado? (reenvio do webhook)
  const dup = await prisma.adminFinancialEntry.findFirst({
    where: { recorrenciaRef: paymentId },
    select: { id: true },
  });
  if (dup) {
    console.log(`[webhook] pagamento ${paymentId} já lançado no Faturamento — ignorado.`);
    return;
  }

  const clinic = await prisma.user.findFirst({
    where: { asaasSubscriptionId: subscriptionId },
    select: { id: true, clinicName: true, name: true, plan: true },
  });
  if (!clinic) return;

  const paidAt = payment.clientPaymentDate || payment.paymentDate || payment.confirmedDate;
  const settled = {
    status: "aprovado",
    paidAt: paidAt ? new Date(paidAt) : new Date(),
    paymentMethod: (payment.billingType || "").toLowerCase() || undefined,
    recorrenciaRef: paymentId, // marca de idempotência
    approvedBy: "Sistema (Asaas)",
    approvedAt: new Date(),
  };

  // 1ª cobrança: reaproveita o lançamento pendente da contratação (sem ref ainda).
  const pending = await prisma.adminFinancialEntry.findFirst({
    where: { clinicId: clinic.id, category: "assinatura", status: "pendente", recorrenciaRef: null },
    orderBy: { createdAt: "desc" },
  });

  if (pending) {
    await prisma.adminFinancialEntry.update({ where: { id: pending.id }, data: settled });
    console.log(`[webhook] Faturamento: mensalidade de ${clinic.clinicName || clinic.name} efetivada (pagamento ${paymentId}).`);
  } else {
    await prisma.adminFinancialEntry.create({
      data: {
        type: "receita",
        description: `Mensalidade Iasoclin — ${clinic.clinicName || clinic.name}`,
        amount: payment.value ?? 0,
        category: "assinatura",
        planType: clinic.plan,
        clinicId: clinic.id,
        clinicName: clinic.clinicName || clinic.name,
        recorrente: true,
        recorrencia: "mensal",
        createdBy: "Sistema (Asaas)",
        ...settled,
      },
    });
    console.log(`[webhook] Faturamento: nova baixa de ${clinic.clinicName || clinic.name} (pagamento ${paymentId}).`);
  }
}
