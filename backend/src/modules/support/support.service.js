// Iaso Suporte — central de atendimento da própria IASO.
// Quem escreve é o cliente (clínica/lead); quem atende é a equipe interna.
// Roda em paralelo ao inbox por clínica (conversations/) — a separação é feita
// pelo phone_number_id que a Meta manda em cada evento.
import { prisma } from "../../config/prisma.js";
import {
  DEPARTMENTS,
  interpretMenuChoice,
  isWithinBusinessHours,
  menuText,
  outOfHoursText,
  invalidOptionText,
} from "./support.triage.js";

// Status que ainda contam como "vivo" — mensagem nova entra aqui em vez de
// abrir ticket novo.
const OPEN_STATUSES = ["triagem", "aguardando", "em_atendimento"];

export function normPhone(raw) {
  const d = String(raw ?? "").replace(/\D/g, "");
  if (!d) return null;
  return d.startsWith("55") ? d : `55${d}`;
}

// O número da central. Só eventos deste phone_number_id viram ticket de
// suporte; o resto segue para o inbox das clínicas.
export function isSupportNumber(phoneNumberId) {
  const id = process.env.SUPPORT_PHONE_NUMBER_ID;
  return Boolean(id) && String(phoneNumberId) === String(id);
}

export async function ensureDepartments() {
  for (const d of DEPARTMENTS) {
    await prisma.supportDepartment.upsert({
      where: { key: d.key },
      update: { name: d.name, order: d.order },
      create: { key: d.key, name: d.name, order: d.order },
    });
  }
  return prisma.supportDepartment.findMany({ orderBy: { order: "asc" } });
}

async function upsertContact(phone, waName) {
  const existing = await prisma.supportContact.findUnique({ where: { phone } });
  if (existing) {
    return prisma.supportContact.update({
      where: { id: existing.id },
      data: { lastSeenAt: new Date(), waName: waName ?? existing.waName },
    });
  }
  // Contato novo: tenta casar com um cliente IASO pelo telefone cadastrado.
  const clinic = await prisma.user
    .findFirst({ where: { phone: { contains: phone.slice(-8) } }, select: { id: true } })
    .catch(() => null);

  return prisma.supportContact.create({
    data: { phone, waName: waName ?? null, clinicId: clinic?.id ?? null },
  });
}

// Ticket vivo mais recente, ou null.
async function findOpenTicket(contactId) {
  return prisma.supportTicket.findFirst({
    where: { contactId, status: { in: OPEN_STATUSES } },
    orderBy: { lastMessageAt: "desc" },
  });
}

// ─── entrada: mensagem do cliente ────────────────────────────────────────────

// Registra uma mensagem recebida e devolve o que a central deve responder
// automaticamente (ou null). NÃO envia nada — quem envia é o caller, para
// manter esta função testável e livre de efeito de rede.
export async function recordInboundSupportMessage(msg, meta = {}) {
  const phone = normPhone(msg.from);
  if (!phone) return { skipped: "sem_phone" };

  // Idempotência forte: mesmo evento reentregue não vira duas mensagens.
  if (msg.id) {
    const dup = await prisma.supportMessage.findUnique({ where: { metaMessageId: msg.id } });
    if (dup) return { duplicated: true, ticketId: dup.ticketId };
  }

  const contact = await upsertContact(phone, meta.waName);
  if (contact.blocked) return { skipped: "bloqueado" };

  const text = msg.text?.body || null;
  const buttonPayload =
    msg.button?.text ||
    msg.interactive?.button_reply?.title ||
    msg.interactive?.list_reply?.title ||
    null;
  const kind = msg.interactive ? "interactive" : msg.button ? "button" : (msg.type || "text");

  let ticket = await findOpenTicket(contact.id);
  const isNewTicket = !ticket;
  if (!ticket) {
    ticket = await prisma.supportTicket.create({
      data: { contactId: contact.id, status: "triagem", firstInboundAt: new Date() },
    });
  }

  const now = new Date();
  const preview = (text || buttonPayload || `[${kind}]`).slice(0, 120);

  await prisma.supportMessage.create({
    data: {
      ticketId: ticket.id,
      direction: "inbound",
      kind,
      text,
      buttonPayload,
      metaMessageId: msg.id ?? null,
      authorKind: "human",
      sentAt: msg.timestamp ? new Date(Number(msg.timestamp) * 1000) : now,
    },
  });

  await prisma.supportTicket.update({
    where: { id: ticket.id },
    data: {
      lastMessageAt: now,
      lastPreview: preview,
      unreadCount: { increment: 1 },
      firstInboundAt: ticket.firstInboundAt ?? now,
    },
  });

  const reply = await decideAutoReply({ ticket, isNewTicket, answer: text || buttonPayload });
  return { ticketId: ticket.id, contactId: contact.id, isNewTicket, reply };
}

// Decide a resposta automática. Só age enquanto o ticket está em triagem —
// depois que tem departamento, quem responde é o atendente (nada de robô
// interrompendo conversa humana).
async function decideAutoReply({ ticket, isNewTicket, answer }) {
  if (ticket.status !== "triagem") return null;

  const foraDoHorario = !isWithinBusinessHours();

  // Primeira mensagem: saúda e mostra o menu (uma vez só).
  if (isNewTicket) {
    return { text: foraDoHorario ? `${menuText()}\n\n---\n${outOfHoursText()}` : menuText(), kind: "menu" };
  }

  const choice = interpretMenuChoice(answer);

  if (choice.type === "department") {
    const dept = await prisma.supportDepartment.findUnique({ where: { key: choice.key } });
    await prisma.supportTicket.update({
      where: { id: ticket.id },
      data: { departmentId: dept?.id ?? null, status: "aguardando", subject: dept?.name ?? null },
    });
    const txt = foraDoHorario
      ? `Certo! Encaminhei para *${dept?.name}*.\n\n${outOfHoursText()}`
      : `Certo! Encaminhei para *${dept?.name}*. Um atendente assume em instantes.`;
    return { text: txt, kind: "routed" };
  }

  if (choice.type === "human") {
    await prisma.supportTicket.update({ where: { id: ticket.id }, data: { status: "aguardando" } });
    const txt = foraDoHorario
      ? outOfHoursText()
      : "Certo! Já chamei um atendente. Em instantes alguém responde por aqui.";
    return { text: txt, kind: "routed" };
  }

  return { text: invalidOptionText(), kind: "invalid" };
}

// ─── saída: resposta do atendente ────────────────────────────────────────────

export async function recordOutboundSupportMessage({
  ticketId, text, authorId, authorKind = "human", metaMessageId = null, kind = "text",
}) {
  const now = new Date();
  const ticket = await prisma.supportTicket.findUnique({ where: { id: ticketId } });
  if (!ticket) return null;

  const message = await prisma.supportMessage.create({
    data: { ticketId, direction: "outbound", kind, text, authorId, authorKind, metaMessageId, status: "sent", sentAt: now },
  });

  await prisma.supportTicket.update({
    where: { id: ticketId },
    data: {
      lastMessageAt: now,
      lastPreview: (text || "").slice(0, 120),
      unreadCount: 0,
      // Marca o tempo de 1ª resposta só na primeira vez (métrica de SLA).
      firstReplyAt: ticket.firstReplyAt ?? (authorKind === "human" ? now : null),
    },
  });

  return message;
}

export async function addInternalNote({ ticketId, text, authorId }) {
  return prisma.supportMessage.create({
    data: { ticketId, direction: "outbound", kind: "text", text, authorId, authorKind: "human", isInternalNote: true },
  });
}

export async function updateOutboundStatus(metaMessageId, status) {
  if (!metaMessageId || !status) return null;
  return prisma.supportMessage
    .update({ where: { metaMessageId }, data: { status } })
    .catch(() => null); // status de mensagem que não é nossa: ignora
}

// ─── operação: assumir, transferir, resolver ─────────────────────────────────

// Atribuição ATÔMICA: o updateMany com assigneeId:null na condição garante que
// só o primeiro atendente ganha. Se count===0, alguém chegou antes — sem lock
// distribuído, sem transação longa, resolvido pelo próprio Postgres.
export async function claimTicket(ticketId, userId) {
  const { count } = await prisma.supportTicket.updateMany({
    where: { id: ticketId, assigneeId: null },
    data: { assigneeId: userId, status: "em_atendimento", assignedAt: new Date() },
  });

  if (count === 0) {
    const current = await prisma.supportTicket.findUnique({
      where: { id: ticketId },
      select: { assigneeId: true },
    });
    return { ok: false, reason: "ja_atribuido", assigneeId: current?.assigneeId ?? null };
  }

  await prisma.supportAssignmentLog.create({
    data: { ticketId, action: "assumir", toUserId: userId, actorId: userId },
  });
  return { ok: true };
}

export async function transferTicket({ ticketId, toUserId, toDeptId, actorId, note }) {
  const before = await prisma.supportTicket.findUnique({ where: { id: ticketId } });
  if (!before) return { ok: false, reason: "nao_encontrado" };

  await prisma.supportTicket.update({
    where: { id: ticketId },
    data: {
      assigneeId: toUserId ?? null, // transferir p/ departamento devolve à fila
      departmentId: toDeptId ?? before.departmentId,
      status: toUserId ? "em_atendimento" : "aguardando",
      assignedAt: toUserId ? new Date() : null,
    },
  });

  await prisma.supportAssignmentLog.create({
    data: {
      ticketId,
      action: toUserId ? "transferir_atendente" : "transferir_departamento",
      fromUserId: before.assigneeId,
      toUserId: toUserId ?? null,
      fromDeptId: before.departmentId,
      toDeptId: toDeptId ?? null,
      actorId,
      note: note ?? null,
    },
  });
  return { ok: true };
}

export async function resolveTicket({ ticketId, actorId, reason }) {
  await prisma.supportTicket.update({
    where: { id: ticketId },
    data: { status: "resolvido", resolvedAt: new Date(), closeReason: reason ?? null },
  });
  await prisma.supportAssignmentLog.create({
    data: { ticketId, action: "liberar", actorId, note: reason ?? "resolvido" },
  });
  return { ok: true };
}

export async function reopenTicket({ ticketId, actorId }) {
  await prisma.supportTicket.update({
    where: { id: ticketId },
    data: { status: "em_atendimento", resolvedAt: null, closedAt: null, closeReason: null },
  });
  await prisma.supportAssignmentLog.create({
    data: { ticketId, action: "atribuir", actorId, note: "reaberto" },
  });
  return { ok: true };
}

// ─── leitura ─────────────────────────────────────────────────────────────────

export async function listTickets({ status, departmentId, assigneeId, page = 1, limit = 25 } = {}) {
  const p = Math.max(1, +page);
  const l = Math.min(50, +limit);
  const where = {};
  if (status) where.status = status;
  if (departmentId) where.departmentId = departmentId;
  if (assigneeId) where.assigneeId = assigneeId;

  const [rows, total] = await Promise.all([
    prisma.supportTicket.findMany({
      where,
      orderBy: { lastMessageAt: "desc" },
      skip: (p - 1) * l,
      take: l,
      include: { contact: true, department: true },
    }),
    prisma.supportTicket.count({ where }),
  ]);

  return { data: rows, total, totalPages: Math.ceil(total / l) };
}

export async function getTicket(id) {
  const ticket = await prisma.supportTicket.findUnique({
    where: { id },
    include: { contact: true, department: true },
  });
  if (!ticket) return null;
  const messages = await prisma.supportMessage.findMany({
    where: { ticketId: id },
    orderBy: { createdAt: "asc" },
  });
  return { ...ticket, messages };
}

export async function markTicketRead(id) {
  return prisma.supportTicket.update({ where: { id }, data: { unreadCount: 0 } });
}
