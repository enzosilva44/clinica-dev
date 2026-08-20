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

// Push no celular da equipe a cada mensagem que chega na central. Ninguém fica
// com a Central aberta o dia todo, e cliente esperando resposta é o pior lugar
// para descobrir isso tarde.
//
// Fica FORA de recordInboundSupportMessage de propósito: aquela função é pura
// (sem rede) para os testes. Aqui é o efeito, chamado pelos webhooks.
//
// Não notifica evento reentregue (`duplicated`) nem contato bloqueado — a Meta
// reenvia o mesmo evento com frequência, e cada reentrega viraria um push.
export async function notifySupportInbound(result, msg) {
  if (!result || result.duplicated || result.skipped || !result.ticketId) return false;

  const { sendPush } = await import("../../providers/notifications/pushover.provider.js");

  const ticket = await prisma.supportTicket.findUnique({
    where: { id: result.ticketId },
    include: { contact: true, department: true },
  }).catch(() => null);

  const quem = ticket?.contact?.waName || ticket?.contact?.phone || normPhone(msg?.from) || "desconhecido";
  const texto = msg?.text?.body
    || msg?.interactive?.button_reply?.title
    || msg?.interactive?.list_reply?.title
    || msg?.button?.text
    || `[${msg?.type || "mensagem"}]`;

  const base = process.env.ADMIN_APP_URL;

  return sendPush({
    title: result.isNewTicket ? `Central IASO · nova conversa` : `Central IASO · ${quem}`,
    message: result.isNewTicket ? `${quem}:\n${texto}` : texto,
    url: base ? `${base.replace(/\/$/, "")}/tecnologia/suporte` : null,
    urlTitle: base ? "Abrir a Central" : null,
  });
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

// Resposta do ATENDENTE ao cliente: envia pelo número da central e grava na
// timeline. Envia primeiro e só grava se a Meta aceitar — o contrário mostraria
// ao atendente uma mensagem que o cliente nunca recebeu.
// Fora da janela de 24h a Meta recusa texto livre; o erro dela sobe como está,
// para o atendente saber que precisa de template em vez de "falhou".
export async function replyToContact({ ticketId, text, authorId }) {
  const body = (text ?? "").trim();
  if (!body) throw new Error("Escreva a mensagem antes de enviar.");

  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId }, include: { contact: true },
  });
  if (!ticket) throw new Error("Conversa não encontrada.");

  // Barra antes de gastar a chamada à Meta. Sem isso o atendente recebe o
  // 131047 cru ("Message failed to send because more than 24 hours have
  // passed…"), que não diz o que fazer. A janela é a mesma regra da tela, então
  // os dois lados nunca discordam.
  const window = await getConversationWindow(ticketId);
  if (!window.open) {
    const err = new Error(
      window.reason === "sem_resposta"
        ? "Este contato ainda não respondeu. Até a primeira resposta, só dá para enviar um modelo aprovado."
        : "A janela de 24h fechou. Para reabrir a conversa, envie um modelo aprovado."
    );
    err.code = "window_closed";
    err.window = window;
    throw err;
  }

  const { sendWhatsAppMessage } = await import("../whatsapp/whatsapp.provider.js");
  const sent = await sendWhatsAppMessage(ticket.contact.phone, body, {
    phoneNumberId: process.env.SUPPORT_PHONE_NUMBER_ID,
    accessToken: process.env.SUPPORT_ACCESS_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN,
  });

  const message = await recordOutboundSupportMessage({
    ticketId, text: body, authorId, authorKind: "human",
    metaMessageId: sent?.messages?.[0]?.id ?? null,
  });

  // Responder tira a conversa da fila: quem respondeu está atendendo.
  await prisma.supportTicket.update({
    where: { id: ticketId },
    data: {
      status: ticket.status === "resolvido" || ticket.status === "encerrado"
        ? ticket.status : "em_atendimento",
      assigneeId: ticket.assigneeId ?? authorId ?? null,
      assignedAt: ticket.assignedAt ?? (ticket.assigneeId ? null : new Date()),
    },
  }).catch(() => {});

  return message;
}

// ─── janela de 24h ───────────────────────────────────────────────────────────

// A Meta só aceita texto livre nas 24h seguintes à ÚLTIMA MENSAGEM DO CLIENTE.
// Fora disso, só template aprovado — texto livre volta com erro 131047.
//
// A pegadinha que define o desenho: enviar template NÃO abre a janela. Só a
// resposta da pessoa abre. Então depois de disparar uma prospecção o atendente
// continua sem poder escrever livremente, e uma tela que não mostrasse isso
// deixaria ele digitando uma mensagem que a Meta vai recusar.
//
// Calculado a partir do último inbound (sem campo novo no schema): lastMessageAt
// do ticket serve para ordenar a fila, mas é tocado por mensagem NOSSA também —
// usá-lo aqui daria janela aberta para sempre, bastando o atendente responder.
export const WINDOW_HOURS = 24;

export async function getConversationWindow(ticketId) {
  const lastInbound = await prisma.supportMessage.findFirst({
    where: { ticketId, direction: "inbound" },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true, sentAt: true },
  });

  // Nunca respondeu: conversa que nós iniciamos e que segue só de ida.
  if (!lastInbound) {
    return { open: false, expiresAt: null, lastInboundAt: null, reason: "sem_resposta" };
  }

  const base = lastInbound.sentAt ?? lastInbound.createdAt;
  const expiresAt = new Date(base.getTime() + WINDOW_HOURS * 3600 * 1000);

  return {
    open: expiresAt > new Date(),
    expiresAt,
    lastInboundAt: base,
    reason: expiresAt > new Date() ? "aberta" : "expirada",
  };
}

// ─── saída: conversa iniciada pela Central ───────────────────────────────────

// Nós ligando para o cliente, e não o contrário. Cria contato + ticket JÁ FORA
// da triagem: o menu de departamentos existe para descobrir o que a pessoa quer,
// e quem liga já sabe — mandar o menu para quem nós procuramos seria absurdo.
//
// O ticket nasce em "em_atendimento" com assignee de quem iniciou: a conversa
// tem dono desde o primeiro instante, então não passa pela fila.
//
// Envia primeiro e só grava se a Meta aceitar, igual a replyToContact: gravar
// antes mostraria ao atendente uma mensagem que o cliente nunca recebeu.
export async function startSupportConversation({
  phone, waName, templateName, values = {}, authorId, departmentKey,
}) {
  const { findOutreachTemplate, buildTemplateParams, renderTemplateText, assertTemplateEnviavel } =
    await import("./support.templates.js");

  const normalized = normPhone(phone);
  if (!normalized) throw new Error("Informe o número de WhatsApp do contato.");
  // 55 + DDD + 8 ou 9 dígitos. Número curto demais é erro de digitação, e a
  // Meta aceitaria o envio para outro número qualquer.
  if (normalized.length < 12 || normalized.length > 13) {
    throw new Error("Número de WhatsApp inválido — use DDD + número.");
  }

  const template = findOutreachTemplate(templateName);
  if (!template) throw new Error("Escolha um modelo de mensagem para iniciar a conversa.");

  // Antes de qualquer efeito: template não aprovado é recusado pela Meta, e
  // seguir daqui só criaria contato para uma mensagem que não vai sair.
  assertTemplateEnviavel(template);

  const params = buildTemplateParams(template, values);

  const contact = await upsertContact(normalized, waName);
  if (contact.blocked) {
    throw new Error("Este contato pediu para não receber mensagens (opt-out).");
  }

  // Conversa viva com essa pessoa: continuar nela em vez de abrir uma paralela,
  // que deixaria o histórico partido em dois lugares.
  const existing = await findOpenTicket(contact.id);
  if (existing) {
    return { ok: false, reason: "ja_existe", ticketId: existing.id };
  }

  const department = departmentKey
    ? await prisma.supportDepartment.findUnique({ where: { key: departmentKey } })
    : null;

  const { sendWhatsAppTemplate } = await import("../whatsapp/whatsapp.provider.js");
  const sent = await sendWhatsAppTemplate(normalized, template.name, params, {
    phoneNumberId: process.env.SUPPORT_PHONE_NUMBER_ID,
    accessToken: process.env.SUPPORT_ACCESS_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN,
    language: template.language,
  });

  const now = new Date();
  const text = renderTemplateText(template, params);

  const ticket = await prisma.supportTicket.create({
    data: {
      contactId: contact.id,
      departmentId: department?.id ?? null,
      assigneeId: authorId ?? null,
      // Fora da triagem de propósito — ver comentário no topo da função.
      status: "em_atendimento",
      subject: department?.name ?? template.label,
      assignedAt: authorId ? now : null,
      lastMessageAt: now,
      lastPreview: text.slice(0, 120),
      // firstInboundAt fica null: o cliente ainda não falou. É isso que faz o
      // SLA de 1ª resposta não contar tempo de uma conversa que nós iniciamos.
    },
  });

  await prisma.supportMessage.create({
    data: {
      ticketId: ticket.id,
      direction: "outbound",
      kind: "template",
      text,
      metaMessageId: sent?.messages?.[0]?.id ?? null,
      authorId: authorId ?? null,
      authorKind: "template",
      status: "sent",
      sentAt: now,
    },
  });

  await prisma.supportAssignmentLog.create({
    data: {
      ticketId: ticket.id,
      action: "assumir",
      toUserId: authorId ?? null,
      actorId: authorId ?? null,
      note: `conversa iniciada pela central (${template.name})`,
    },
  });

  return { ok: true, ticketId: ticket.id, contactId: contact.id, text };
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

  // Estado da janela de cada linha numa consulta só. Chamar
  // getConversationWindow por ticket seria N+1 numa tela que lista 25 de uma vez.
  const ids = rows.map((t) => t.id);
  const ultimosInbound = ids.length
    ? await prisma.supportMessage.groupBy({
        by: ["ticketId"],
        where: { ticketId: { in: ids }, direction: "inbound" },
        _max: { createdAt: true },
      })
    : [];

  const porTicket = new Map(ultimosInbound.map((g) => [g.ticketId, g._max.createdAt]));
  const agora = Date.now();

  const data = rows.map((t) => {
    const last = porTicket.get(t.id) ?? null;
    const expiresAt = last ? new Date(last.getTime() + WINDOW_HOURS * 3600 * 1000) : null;
    return {
      ...t,
      window: {
        open: Boolean(expiresAt && expiresAt.getTime() > agora),
        expiresAt,
        lastInboundAt: last,
        reason: !last ? "sem_resposta" : expiresAt.getTime() > agora ? "aberta" : "expirada",
      },
    };
  });

  return { data, total, totalPages: Math.ceil(total / l) };
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
  // A tela precisa da janela junto do ticket: é ela que decide se a caixa de
  // resposta fica liberada ou bloqueada com aviso.
  const window = await getConversationWindow(id);
  return { ...ticket, messages, window };
}

export async function markTicketRead(id) {
  return prisma.supportTicket.update({ where: { id }, data: { unreadCount: 0 } });
}
