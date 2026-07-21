import { prisma } from "../../config/prisma.js";

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
  };

  let charge;
  try {
    charge = await asaas("POST", "/payments", payload, key);
  } catch (err) {
    // rollback: remove a transaction se o Asaas rejeitar
    await prisma.transaction.delete({ where: { id: transaction.id } }).catch(() => {});
    throw err;
  }

  // salva o ID do Asaas no notes para rastreabilidade bidirecional
  await prisma.transaction.update({
    where: { id: transaction.id },
    data: { notes: `asaas:${charge.id}` },
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

  return {
    accountId: account.id,
    walletId:  account.walletId,
    status:    account.status || account.accountStatus || "pending",
  };
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

  const { sendWhatsAppMessage } = await import("../whatsapp/whatsapp.provider.js");

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

  const method = { PIX: "PIX", CREDIT_CARD: "Cartão de crédito", BOLETO: "Boleto" }[charge.billingType] ?? charge.billingType;
  const value  = Number(charge.value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const message =
    `Olá! Segue o link para pagamento da sua cobrança no valor de *${value}* (${method}):\n\n${link}\n\nEm caso de dúvidas, entre em contato conosco.`;

  await sendWhatsAppMessage(phone, message, waConfig);
  return { ok: true, phone, link };
}

// ─── webhook ──────────────────────────────────────────────────────────────────

export async function handleWebhook(event) {
  const { event: type, payment } = event;
  if (!payment?.externalReference) return;

  if (type === "PAYMENT_CONFIRMED" || type === "PAYMENT_RECEIVED") {
    await prisma.transaction.updateMany({
      where: { id: payment.externalReference },
      data: { status: "pago", paidAt: new Date() },
    });
  }

  if (type === "PAYMENT_OVERDUE") {
    await prisma.transaction.updateMany({
      where: { id: payment.externalReference, status: "pendente" },
      data: { status: "pendente" }, // mantém pendente, frontend filtra vencidos por dueDate
    });
  }
}
