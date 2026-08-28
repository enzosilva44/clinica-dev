// Roteamento do webhook do Asaas: mensalidade SaaS vs. cobrança da clínica.
//
// O bug que estes testes travam: `handleWebhook` tratava QUALQUER evento com
// `payment.subscription` como mensalidade do Iaso e saía por um `return`. Mas a
// clínica também vende recorrência/parcelado para o PACIENTE (ex.: "Preenchedores"
// em 21x), e esses eventos chegam pelo mesmo webhook com `subscription` também.
// Resultado em produção: o pagamento da paciente caía no ramo da mensalidade,
// não achava clínica ("sem clínica correspondente"), e a Transaction nunca
// recebia baixa no Financeiro.
//
// O discriminador correto não é a presença de `subscription`, e sim a assinatura
// existir em User.asaasSubscriptionId.
//
// Prisma é mockado: nada toca o banco.
import test from "node:test";
import assert from "node:assert/strict";

const calls = [];
let saasSubscriptionIds = new Set();

const prismaMock = {
  user: {
    findFirst: async ({ where }) => {
      calls.push(["user.findFirst", where.asaasSubscriptionId]);
      return saasSubscriptionIds.has(where.asaasSubscriptionId) ? { id: "user-1", overdueSince: null } : null;
    },
    updateMany: async ({ where, data }) => {
      calls.push(["user.updateMany", where.asaasSubscriptionId, data.subscriptionStatus]);
      return { count: saasSubscriptionIds.has(where.asaasSubscriptionId) ? 1 : 0 };
    },
    findUnique: async () => ({ id: "user-1", clinicName: "Clínica Teste", name: "Teste" }),
  },
  transaction: {
    updateMany: async ({ where, data }) => {
      calls.push(["transaction.updateMany", where.id, data.status]);
      return { count: 1 };
    },
    findUnique: async ({ where }) => {
      calls.push(["transaction.findUnique", where.id]);
      return { splitApplied: false, iasoRevenue: null };
    },
  },
  adminFinancialEntry: {
    findFirst: async () => null,
    create: async () => ({}),
    update: async () => ({}),
    updateMany: async () => ({ count: 0 }),
  },
};

test.mock.module("../../config/prisma.js", { namedExports: { prisma: prismaMock } });

const { handleWebhook } = await import("./billing.service.js");

function reset(saasIds = []) {
  calls.length = 0;
  saasSubscriptionIds = new Set(saasIds);
}

// O caso que quebrou em produção (sub_fklghocroev1x3vu, "Preenchedores" 21x).
test("cobrança recorrente da PACIENTE dá baixa na Transaction", async () => {
  reset([]); // nenhuma assinatura SaaS: essa sub não é mensalidade
  await handleWebhook({
    event: "PAYMENT_RECEIVED",
    payment: {
      id: "pay_1",
      subscription: "sub_paciente",
      externalReference: "tx-123",
      value: 155.57,
      netValue: 150.0,
    },
  });

  const baixa = calls.find((c) => c[0] === "transaction.updateMany");
  assert.ok(baixa, "deveria dar baixa na Transaction, mas saiu pelo ramo da mensalidade");
  assert.equal(baixa[1], "tx-123");
  assert.equal(baixa[2], "pago");
  assert.ok(
    !calls.some((c) => c[0] === "user.updateMany"),
    "não pode mexer no status de assinatura de clínica nenhuma",
  );
});

test("mensalidade SaaS ainda reconcilia o status da clínica", async () => {
  reset(["sub_mensalidade"]);
  await handleWebhook({
    event: "PAYMENT_RECEIVED",
    payment: { id: "pay_2", subscription: "sub_mensalidade", value: 199 },
  });

  const rec = calls.find((c) => c[0] === "user.updateMany");
  assert.ok(rec, "mensalidade deveria reconciliar a assinatura");
  assert.equal(rec[2], "active");
  assert.ok(
    !calls.some((c) => c[0] === "transaction.updateMany"),
    "mensalidade não tem Transaction da clínica para baixar",
  );
});

test("mensalidade vencida marca past_due (não vira baixa de Transaction)", async () => {
  reset(["sub_mensalidade"]);
  await handleWebhook({
    event: "PAYMENT_OVERDUE",
    payment: { id: "pay_3", subscription: "sub_mensalidade", value: 199 },
  });

  const rec = calls.find((c) => c[0] === "user.updateMany");
  assert.ok(rec);
  assert.equal(rec[2], "past_due");
});

test("estorno da cobrança da paciente reverte a Transaction", async () => {
  reset([]);
  await handleWebhook({
    event: "PAYMENT_REFUNDED",
    payment: { id: "pay_4", subscription: "sub_paciente", externalReference: "tx-999", value: 100 },
  });

  const rev = calls.find((c) => c[0] === "transaction.updateMany");
  assert.ok(rev, "estorno de cobrança recorrente da paciente deveria reverter a Transaction");
  assert.equal(rev[2], "estornado");
});

// Cobrança avulsa (sem subscription) nunca passou pelo ramo quebrado — garante
// que a correção não mexeu no caminho que já funcionava.
test("cobrança avulsa da clínica segue dando baixa", async () => {
  reset([]);
  await handleWebhook({
    event: "PAYMENT_CONFIRMED",
    payment: { id: "pay_5", externalReference: "tx-avulsa", value: 80, netValue: 78 },
  });

  const baixa = calls.find((c) => c[0] === "transaction.updateMany");
  assert.ok(baixa);
  assert.equal(baixa[1], "tx-avulsa");
  assert.equal(baixa[2], "pago");
});

// Cobrança criada no PAINEL do Asaas (como as 386 da Euriane): tem subscription
// mas nenhum externalReference, porque não nasceu no Iaso. Não deve estourar.
test("cobrança criada fora do sistema não quebra o webhook", async () => {
  reset([]);
  await handleWebhook({
    event: "PAYMENT_RECEIVED",
    payment: { id: "pay_6", subscription: "sub_painel", value: 155.57 },
  });

  assert.ok(
    !calls.some((c) => c[0] === "transaction.updateMany"),
    "sem externalReference não há Transaction para baixar",
  );
});
