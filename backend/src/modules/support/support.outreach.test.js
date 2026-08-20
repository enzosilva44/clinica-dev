// Conversa iniciada pela Central + janela de 24h.
//
// O que estes testes protegem, em uma frase: a Meta só aceita texto livre nas
// 24h seguintes à mensagem DO CLIENTE, e enviar template não abre essa janela.
// Errar isso significa a tela liberar uma caixa de resposta que a Meta vai
// recusar — o atendente descobre digitando.
//
// O envio é mockado (module mocks): nenhum teste fala com a Meta.
import test from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../../config/prisma.js";
import { buildTemplateParams, findOutreachTemplate, renderTemplateText } from "./support.templates.js";

const PHONE = "5511999990042"; // número de teste, não existe

async function limpar() {
  const c = await prisma.supportContact.findUnique({ where: { phone: PHONE } });
  if (!c) return;
  const tickets = await prisma.supportTicket.findMany({
    where: { contactId: c.id }, select: { id: true },
  });
  const ids = tickets.map((t) => t.id);
  if (ids.length) {
    await prisma.supportMessage.deleteMany({ where: { ticketId: { in: ids } } });
    await prisma.supportAssignmentLog.deleteMany({ where: { ticketId: { in: ids } } });
    await prisma.supportTicket.deleteMany({ where: { id: { in: ids } } });
  }
  await prisma.supportContact.delete({ where: { id: c.id } });
}

// ─── catálogo de templates (puro, sem banco) ─────────────────────────────────

test("monta os parâmetros na ordem das variáveis do corpo", () => {
  const t = findOutreachTemplate("prospeccao_iaso");
  const params = buildTemplateParams(t, {
    nome: "Fernanda",
    mensagem: "Queria te mostrar como a IASO organiza a agenda.",
  });
  assert.deepEqual(params, [
    "Fernanda",
    "Queria te mostrar como a IASO organiza a agenda.",
  ]);
});

test("colapsa quebra de linha e espaço duplo — a Meta recusa parâmetro assim", () => {
  const t = findOutreachTemplate("prospeccao_iaso");
  const [, msg] = buildTemplateParams(t, {
    nome: "Ana",
    mensagem: "primeira linha\n\nsegunda   linha",
  });
  assert.equal(msg, "primeira linha segunda linha");
});

test("campo obrigatório vazio cita o rótulo, não a chave", () => {
  const t = findOutreachTemplate("prospeccao_iaso");
  assert.throws(
    () => buildTemplateParams(t, { nome: "Ana", mensagem: "   " }),
    /Motivo do contato/
  );
});

test("recusa texto acima do limite do campo", () => {
  const t = findOutreachTemplate("prospeccao_iaso");
  assert.throws(
    () => buildTemplateParams(t, { nome: "x".repeat(61), mensagem: "oi" }),
    /60 caracteres/
  );
});

test("renderiza o texto que o cliente vai ver, para gravar na timeline", () => {
  const t = findOutreachTemplate("prospeccao_iaso");
  const texto = renderTemplateText(t, ["Fernanda", "Sobre a agenda."]);
  assert.match(texto, /Olá Fernanda!/);
  assert.match(texto, /Sobre a agenda\./);
  assert.doesNotMatch(texto, /\{\{\d\}\}/); // nenhuma variável sobrando
});

// ─── janela de 24h ───────────────────────────────────────────────────────────

test("conversa que nós iniciamos fica com a janela FECHADA até a pessoa responder", async (t) => {
  await limpar();
  // O template "sai" sem tocar na Meta.
  t.mock.module("../whatsapp/whatsapp.provider.js", {
    namedExports: {
      sendWhatsAppTemplate: async () => ({ messages: [{ id: "wamid.out1" }] }),
      sendWhatsAppMessage: async () => ({ messages: [{ id: "wamid.out2" }] }),
    },
  });
  const { startSupportConversation, getConversationWindow } = await import("./support.service.js");

  const r = await startSupportConversation({
    phone: PHONE,
    waName: "Lead Teste",
    templateName: "prospeccao_iaso",
    values: { nome: "Lead", mensagem: "Queria te apresentar a IASO." },
  });
  assert.equal(r.ok, true);

  const janela = await getConversationWindow(r.ticketId);
  assert.equal(janela.open, false, "template enviado NÃO abre a janela de 24h");
  assert.equal(janela.reason, "sem_resposta");
  assert.equal(janela.expiresAt, null);

  await limpar();
});

test("ticket iniciado pela central nasce fora da triagem e com dono", async (t) => {
  await limpar();
  t.mock.module("../whatsapp/whatsapp.provider.js", {
    namedExports: {
      sendWhatsAppTemplate: async () => ({ messages: [{ id: "wamid.out3" }] }),
      sendWhatsAppMessage: async () => ({ messages: [{ id: "wamid.out4" }] }),
    },
  });
  const { startSupportConversation, getTicket } = await import("./support.service.js");

  const r = await startSupportConversation({
    phone: PHONE,
    templateName: "prospeccao_iaso",
    values: { nome: "Lead", mensagem: "Oi!" },
    authorId: "user-teste-1",
  });

  const ticket = await getTicket(r.ticketId);
  // Menu de departamentos é para quem procurou a gente — aqui fomos nós.
  assert.equal(ticket.status, "em_atendimento");
  assert.equal(ticket.assigneeId, "user-teste-1");
  // Sem 1º inbound: o SLA de primeira resposta não pode contar conversa nossa.
  assert.equal(ticket.firstInboundAt, null);
  assert.equal(ticket.messages.length, 1);
  assert.equal(ticket.messages[0].kind, "template");
  assert.equal(ticket.messages[0].direction, "outbound");
  assert.match(ticket.messages[0].text, /Olá Lead!/);

  await limpar();
});

test("resposta do contato ABRE a janela de 24h", async (t) => {
  await limpar();
  t.mock.module("../whatsapp/whatsapp.provider.js", {
    namedExports: {
      sendWhatsAppTemplate: async () => ({ messages: [{ id: "wamid.out5" }] }),
      sendWhatsAppMessage: async () => ({ messages: [{ id: "wamid.out6" }] }),
    },
  });
  const { startSupportConversation, getConversationWindow, recordInboundSupportMessage } =
    await import("./support.service.js");

  const r = await startSupportConversation({
    phone: PHONE,
    templateName: "prospeccao_iaso",
    values: { nome: "Lead", mensagem: "Oi!" },
  });

  await recordInboundSupportMessage({
    id: "wamid.in1", from: PHONE, type: "text", text: { body: "tenho interesse" },
    timestamp: String(Math.floor(Date.now() / 1000)),
  });

  const janela = await getConversationWindow(r.ticketId);
  assert.equal(janela.open, true);
  assert.equal(janela.reason, "aberta");
  // Expira ~24h depois — margem de 1 min para o tempo de execução do teste.
  const horas = (janela.expiresAt - Date.now()) / 3600000;
  assert.ok(horas > 23.9 && horas <= 24, `esperava ~24h, veio ${horas}`);

  await limpar();
});

test("janela expira 24h após o último inbound, não após a nossa resposta", async (t) => {
  await limpar();
  t.mock.module("../whatsapp/whatsapp.provider.js", {
    namedExports: {
      sendWhatsAppTemplate: async () => ({ messages: [{ id: "wamid.out7" }] }),
      sendWhatsAppMessage: async () => ({ messages: [{ id: "wamid.out8" }] }),
    },
  });
  const { startSupportConversation, getConversationWindow, recordOutboundSupportMessage } =
    await import("./support.service.js");

  const r = await startSupportConversation({
    phone: PHONE, templateName: "prospeccao_iaso", values: { nome: "Lead", mensagem: "Oi!" },
  });

  // Inbound de 25h atrás: a janela já deveria estar fechada.
  const ontem = new Date(Date.now() - 25 * 3600 * 1000);
  await prisma.supportMessage.create({
    data: {
      ticketId: r.ticketId, direction: "inbound", kind: "text",
      text: "escrevi ontem", authorKind: "human", createdAt: ontem, sentAt: ontem,
    },
  });

  // Nossa mensagem AGORA não pode reabrir a janela — é o erro que o
  // lastMessageAt do ticket cometeria, porque ele é tocado por outbound também.
  await recordOutboundSupportMessage({
    ticketId: r.ticketId, text: "oi, tudo bem?", authorKind: "human",
  });

  const janela = await getConversationWindow(r.ticketId);
  assert.equal(janela.open, false, "responder não reabre a janela");
  assert.equal(janela.reason, "expirada");

  await limpar();
});

test("texto livre com a janela fechada é barrado antes de chamar a Meta", async (t) => {
  await limpar();
  let chamouMeta = false;
  t.mock.module("../whatsapp/whatsapp.provider.js", {
    namedExports: {
      sendWhatsAppTemplate: async () => ({ messages: [{ id: "wamid.out9" }] }),
      sendWhatsAppMessage: async () => {
        chamouMeta = true; // se cair aqui, gastamos uma chamada que ia falhar
        return { messages: [{ id: "wamid.out10" }] };
      },
    },
  });
  const { startSupportConversation, replyToContact } = await import("./support.service.js");

  const r = await startSupportConversation({
    phone: PHONE, templateName: "prospeccao_iaso", values: { nome: "Lead", mensagem: "Oi!" },
  });

  await assert.rejects(
    () => replyToContact({ ticketId: r.ticketId, text: "posso te ligar?" }),
    (err) => {
      assert.equal(err.code, "window_closed");
      assert.match(err.message, /ainda não respondeu/);
      return true;
    }
  );
  assert.equal(chamouMeta, false, "não deve chamar a Meta com a janela fechada");

  await limpar();
});

test("não abre conversa paralela quando já existe uma viva", async (t) => {
  await limpar();
  t.mock.module("../whatsapp/whatsapp.provider.js", {
    namedExports: {
      sendWhatsAppTemplate: async () => ({ messages: [{ id: "wamid.out11" }] }),
      sendWhatsAppMessage: async () => ({ messages: [{ id: "wamid.out12" }] }),
    },
  });
  const { startSupportConversation } = await import("./support.service.js");

  const values = { nome: "Lead", mensagem: "Oi!" };
  const primeira = await startSupportConversation({ phone: PHONE, templateName: "prospeccao_iaso", values });
  const segunda = await startSupportConversation({ phone: PHONE, templateName: "prospeccao_iaso", values });

  assert.equal(segunda.ok, false);
  assert.equal(segunda.reason, "ja_existe");
  assert.equal(segunda.ticketId, primeira.ticketId, "deve apontar para a conversa existente");

  await limpar();
});

test("recusa número curto demais antes de enviar", async (t) => {
  t.mock.module("../whatsapp/whatsapp.provider.js", {
    namedExports: {
      sendWhatsAppTemplate: async () => { throw new Error("não deveria enviar"); },
      sendWhatsAppMessage: async () => ({}),
    },
  });
  const { startSupportConversation } = await import("./support.service.js");

  await assert.rejects(
    () => startSupportConversation({
      phone: "119999", templateName: "prospeccao_iaso", values: { nome: "A", mensagem: "b" },
    }),
    /inválido/
  );
});

test("recusa modelo que não está no catálogo", async (t) => {
  t.mock.module("../whatsapp/whatsapp.provider.js", {
    namedExports: {
      sendWhatsAppTemplate: async () => { throw new Error("não deveria enviar"); },
      sendWhatsAppMessage: async () => ({}),
    },
  });
  const { startSupportConversation } = await import("./support.service.js");

  await assert.rejects(
    () => startSupportConversation({
      phone: PHONE, templateName: "inventado_iaso", values: {},
    }),
    /modelo de mensagem/
  );
});
