// Testes de integração do Iaso Suporte — rodam contra o banco de DEV.
// Cobrem os três pontos onde a falha é silenciosa e cara:
//   1. idempotência   (webhook reentregue não duplica mensagem)
//   2. concorrência   (dois atendentes não assumem o mesmo ticket)
//   3. ciclo de vida  (ticket novo só depois que o anterior fecha)
//
// Cada teste limpa o que criou. Nenhuma mensagem é enviada: o service só
// DECIDE a resposta, quem envia é o worker.
import test from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../../config/prisma.js";
import {
  claimTicket,
  ensureDepartments,
  getTicket,
  recordInboundSupportMessage,
  resolveTicket,
  transferTicket,
  normPhone,
} from "./support.service.js";

const PHONE = "5511999990001"; // número de teste, não existe

async function limpar() {
  const c = await prisma.supportContact.findUnique({ where: { phone: PHONE } });
  if (!c) return;
  const tickets = await prisma.supportTicket.findMany({ where: { contactId: c.id }, select: { id: true } });
  const ids = tickets.map((t) => t.id);
  if (ids.length) {
    await prisma.supportMessage.deleteMany({ where: { ticketId: { in: ids } } });
    await prisma.supportAssignmentLog.deleteMany({ where: { ticketId: { in: ids } } });
    await prisma.supportTicket.deleteMany({ where: { id: { in: ids } } });
  }
  await prisma.supportContact.delete({ where: { id: c.id } });
}

function inbound(id, text) {
  return { id, from: PHONE, type: "text", text: { body: text }, timestamp: String(Math.floor(Date.now() / 1000)) };
}

test("normaliza telefone para o formato com 55, sem duplicar contato", () => {
  assert.equal(normPhone("11999990001"), "5511999990001");
  assert.equal(normPhone("5511999990001"), "5511999990001");
  assert.equal(normPhone("(11) 99999-0001"), "5511999990001");
  assert.equal(normPhone(""), null);
});

test("primeira mensagem abre ticket em triagem e responde com o menu", async () => {
  await limpar();
  await ensureDepartments();

  const r = await recordInboundSupportMessage(inbound("wamid.t1", "oi"), { waName: "Cliente Teste" });
  assert.ok(r.ticketId);
  assert.equal(r.isNewTicket, true);
  assert.equal(r.reply.kind, "menu");
  assert.match(r.reply.text, /Você está falando com a IASO/);

  const t = await getTicket(r.ticketId);
  assert.equal(t.status, "triagem");
  assert.equal(t.messages.length, 1);
  assert.ok(t.firstInboundAt, "marca o início da espera p/ SLA");

  await limpar();
});

test("webhook reentregue NÃO duplica a mensagem", async () => {
  await limpar();
  await ensureDepartments();

  const msg = inbound("wamid.dup", "oi");
  const primeira = await recordInboundSupportMessage(msg);
  const segunda  = await recordInboundSupportMessage(msg); // mesma id, como a Meta faz

  assert.equal(segunda.duplicated, true);
  assert.equal(segunda.ticketId, primeira.ticketId);

  const t = await getTicket(primeira.ticketId);
  assert.equal(t.messages.length, 1, "a mensagem foi gravada uma única vez");

  await limpar();
});

test("responder o menu roteia para o departamento e sai da triagem", async () => {
  await limpar();
  await ensureDepartments();

  const abre = await recordInboundSupportMessage(inbound("wamid.t2", "oi"));
  const escolhe = await recordInboundSupportMessage(inbound("wamid.t3", "3"));

  assert.equal(escolhe.ticketId, abre.ticketId, "continua no mesmo ticket");
  assert.equal(escolhe.reply.kind, "routed");

  const t = await getTicket(abre.ticketId);
  assert.equal(t.status, "aguardando");
  assert.equal(t.department.key, "financeiro");

  await limpar();
});

test("opção inválida não escolhe departamento e repete as opções", async () => {
  await limpar();
  await ensureDepartments();

  await recordInboundSupportMessage(inbound("wamid.t4", "oi"));
  const r = await recordInboundSupportMessage(inbound("wamid.t5", "asdfgh"));

  assert.equal(r.reply.kind, "invalid");
  const t = await getTicket(r.ticketId);
  assert.equal(t.status, "triagem", "segue em triagem");
  assert.equal(t.departmentId, null);

  await limpar();
});

test("dois atendentes disputando: exatamente um assume", async () => {
  await limpar();
  await ensureDepartments();

  const { ticketId } = await recordInboundSupportMessage(inbound("wamid.t6", "oi"));

  // Dispara em paralelo, como dois cliques no mesmo instante.
  const [a, b] = await Promise.all([
    claimTicket(ticketId, "atendente-A"),
    claimTicket(ticketId, "atendente-B"),
  ]);

  const ganhos = [a, b].filter((r) => r.ok).length;
  assert.equal(ganhos, 1, "só um atendente pode assumir");

  const perdedor = [a, b].find((r) => !r.ok);
  assert.equal(perdedor.reason, "ja_atribuido");
  assert.ok(perdedor.assigneeId, "o perdedor descobre quem ficou com o ticket");

  const t = await getTicket(ticketId);
  assert.equal(t.status, "em_atendimento");
  assert.ok(["atendente-A", "atendente-B"].includes(t.assigneeId));

  await limpar();
});

test("transferir para departamento devolve o ticket à fila", async () => {
  await limpar();
  const [comercial] = await ensureDepartments();

  const { ticketId } = await recordInboundSupportMessage(inbound("wamid.t7", "oi"));
  await claimTicket(ticketId, "atendente-A");
  await transferTicket({ ticketId, toDeptId: comercial.id, actorId: "atendente-A" });

  const t = await getTicket(ticketId);
  assert.equal(t.assigneeId, null, "volta para a fila, sem dono");
  assert.equal(t.status, "aguardando");
  assert.equal(t.departmentId, comercial.id);

  const logs = await prisma.supportAssignmentLog.findMany({ where: { ticketId } });
  assert.ok(logs.some((l) => l.action === "transferir_departamento"), "transferência fica auditada");

  await limpar();
});

test("mensagem nova após resolver abre um ticket NOVO", async () => {
  await limpar();
  await ensureDepartments();

  const primeiro = await recordInboundSupportMessage(inbound("wamid.t8", "oi"));
  await resolveTicket({ ticketId: primeiro.ticketId, actorId: "atendente-A", reason: "resolvido" });

  const segundo = await recordInboundSupportMessage(inbound("wamid.t9", "voltei"));
  assert.notEqual(segundo.ticketId, primeiro.ticketId, "ticket anterior estava fechado");
  assert.equal(segundo.isNewTicket, true);

  await limpar();
});

test("enquanto o ticket está aberto, mensagens seguem no mesmo ticket", async () => {
  await limpar();
  await ensureDepartments();

  const a = await recordInboundSupportMessage(inbound("wamid.ta", "oi"));
  const b = await recordInboundSupportMessage(inbound("wamid.tb", "2"));
  const c = await recordInboundSupportMessage(inbound("wamid.tc", "mais uma coisa"));

  assert.equal(b.ticketId, a.ticketId);
  assert.equal(c.ticketId, a.ticketId);

  const t = await getTicket(a.ticketId);
  assert.equal(t.messages.length, 3);

  await limpar();
});

test("robô não responde depois que o ticket saiu da triagem", async () => {
  await limpar();
  await ensureDepartments();

  await recordInboundSupportMessage(inbound("wamid.td", "oi"));
  await recordInboundSupportMessage(inbound("wamid.te", "2")); // vai p/ suporte
  const depois = await recordInboundSupportMessage(inbound("wamid.tf", "1"));

  assert.equal(depois.reply, null, "não interrompe a conversa com o atendente");

  await limpar();
});

test.after(async () => {
  await limpar();
  await prisma.$disconnect();
});
