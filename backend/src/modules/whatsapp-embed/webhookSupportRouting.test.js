// O DESVIO do webhook: evento do número da central vira ticket de suporte;
// evento de qualquer outro número segue no fluxo de pacientes das clínicas.
// Errar aqui ou engole chamado de clínica, ou sequestra conversa de paciente.
import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

process.env.SUPPORT_PHONE_NUMBER_ID = "1278044038716755";
process.env.APP_SECRET = "s";

const calls = { support: 0, inbound: 0 };

test.mock.module("../support/support.service.js", {
  namedExports: {
    isSupportNumber: (id) => Boolean(id) && String(id) === process.env.SUPPORT_PHONE_NUMBER_ID,
    recordInboundSupportMessage: async () => { calls.support++; return { reply: null }; },
    recordOutboundSupportMessage: async () => {},
    updateOutboundStatus: async () => {},
  },
});
test.mock.module("../automations/inbound.service.js", {
  namedExports: { processInboundMessage: async () => { calls.inbound++; } },
});
test.mock.module("../conversations/webhook/webhookEvent.service.js", {
  namedExports: { enqueueWebhookEvent: async () => {} },
});

const { receiveWebhook } = await import("./whatsappWebhook.js");

// Assina o corpo como a Meta faz: sem isso o handler devolve 401 antes do desvio.
function reqFor(phoneNumberId) {
  const body = { entry: [{ changes: [{ value: {
    metadata: { phone_number_id: phoneNumberId },
    messages: [{ id: "wamid.X", from: "5511999999999", type: "text", text: { body: "oi" } }],
  } }] }] };
  const rawBody = Buffer.from(JSON.stringify(body));
  const sig = "sha256=" + crypto.createHmac("sha256", process.env.APP_SECRET).update(rawBody).digest("hex");
  return { body, rawBody, get: () => sig };
}
const res = { sendStatus() {} };

test("evento da central vira ticket e não entra no fluxo de pacientes", async () => {
  calls.support = 0; calls.inbound = 0;
  await receiveWebhook(reqFor("1278044038716755"), res);
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(calls.support, 1);
  assert.equal(calls.inbound, 0);
});

test("evento de clínica segue no fluxo de pacientes, intocado", async () => {
  calls.support = 0; calls.inbound = 0;
  await receiveWebhook(reqFor("1158855287319096"), res);
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(calls.inbound, 1);
  assert.equal(calls.support, 0);
});

test("sem a env configurada, nada vira suporte", async () => {
  const orig = process.env.SUPPORT_PHONE_NUMBER_ID;
  delete process.env.SUPPORT_PHONE_NUMBER_ID;
  calls.support = 0; calls.inbound = 0;
  await receiveWebhook(reqFor("1278044038716755"), res);
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(calls.support, 0);
  assert.equal(calls.inbound, 1);
  process.env.SUPPORT_PHONE_NUMBER_ID = orig;
});
