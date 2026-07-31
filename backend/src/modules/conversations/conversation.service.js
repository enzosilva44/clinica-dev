// Iaso Conversas — materialização do inbox (Fase 2).
// Transforma eventos crus da fila WebhookEvent (e envios da automação) numa
// timeline por paciente: Contact → Conversation → Message.
//
// O número da Meta é COMPARTILHADO entre clínicas, então tudo é escopado por
// userId (a clínica). A atribuição de uma mensagem inbound à clínica certa
// segue a mesma heurística do inbound.service: o envio mais recente àquele
// telefone (automationLog).
import { prisma } from "../../config/prisma.js";

// Normaliza telefone p/ comparação/armazenamento (só dígitos, com 55).
export function normPhone(p) {
  let d = (p || "").replace(/\D/g, "");
  if (d && !d.startsWith("55")) d = "55" + d;
  return d;
}

// Resumo curto p/ a lista do inbox (evita guardar corpo gigante no preview).
function preview(text, buttonPayload) {
  const s = (buttonPayload || text || "").trim().replace(/\s+/g, " ");
  return s.length > 120 ? s.slice(0, 117) + "…" : s || null;
}

// Acha a clínica (userId) + paciente pelo envio mais recente àquele telefone.
// Mesma lógica do inbound.service: casa pelo telefone normalizado nos últimos
// envios (tolera com/sem 55, com/sem 9º dígito via normPhone).
async function attributeToClinic(phone) {
  const norm = normPhone(phone);
  const candidates = await prisma.automationLog.findMany({
    where: { status: { in: ["sent", "delivered", "read"] } },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: { userId: true, patientId: true, patientName: true, phone: true },
  });
  return candidates.find((c) => normPhone(c.phone) === norm) || null;
}

// Upsert do contato (userId+phone é único). Preenche/atualiza nome e paciente
// quando vierem — nunca apaga um vínculo já existente com null.
async function upsertContact({ userId, phone, name, patientId }) {
  const norm = normPhone(phone);
  return prisma.contact.upsert({
    where: { userId_phone: { userId, phone: norm } },
    create: { userId, phone: norm, name: name || null, patientId: patientId || null },
    update: {
      ...(name ? { name } : {}),
      ...(patientId ? { patientId } : {}),
    },
  });
}

// Garante a conversa (uma por contato) e devolve o id.
async function ensureConversation(contact) {
  const existing = await prisma.conversation.findUnique({ where: { contactId: contact.id } });
  if (existing) return existing;
  return prisma.conversation.create({
    data: { userId: contact.userId, contactId: contact.id },
  });
}

// Registra UMA mensagem inbound na conversa da clínica certa.
// Idempotente por metaMessageId (Message.metaMessageId é @unique). Silencioso
// se não conseguir atribuir a clínica — mantém o comportamento do inbound atual.
export async function recordInboundMessage(msg) {
  const phone = msg.from;
  if (!phone) return { skipped: "sem_phone" };

  // Idempotência forte: se essa msg já virou Message, sai.
  if (msg.id) {
    const dup = await prisma.message.findUnique({ where: { metaMessageId: msg.id } });
    if (dup) return { duplicated: true };
  }

  const owner = await attributeToClinic(phone);
  if (!owner) return { skipped: "sem_clinica" };

  const buttonPayload =
    msg.button?.text ||
    msg.interactive?.button_reply?.title ||
    msg.interactive?.list_reply?.title ||
    null;
  const text = msg.text?.body || null;
  const kind = msg.interactive ? "interactive" : msg.button ? "button" : "text";

  const contact = await upsertContact({
    userId: owner.userId,
    phone,
    name: owner.patientName,
    patientId: owner.patientId,
  });
  const conversation = await ensureConversation(contact);

  const message = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      direction: "inbound",
      kind,
      text,
      buttonPayload,
      metaMessageId: msg.id || null,
    },
  });

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: {
      lastMessageAt: message.createdAt,
      lastPreview: preview(text, buttonPayload),
      unreadCount: { increment: 1 },
      status: "open", // reabre se estava fechada
    },
  });

  return { messageId: message.id, conversationId: conversation.id };
}

// Registra uma mensagem OUTBOUND (envio da clínica → paciente).
// Chamado pelo fluxo de automação após enviar. Não depende do webhook.
// `userId` já é conhecido (é a clínica que disparou), então não há atribuição.
export async function recordOutboundMessage({
  userId,
  phone,
  text,
  patientId,
  patientName,
  kind = "template",
  metaMessageId,
}) {
  if (!userId || !phone) return { skipped: "faltam_dados" };
  if (metaMessageId) {
    const dup = await prisma.message.findUnique({ where: { metaMessageId } });
    if (dup) return { duplicated: true };
  }

  const contact = await upsertContact({ userId, phone, name: patientName, patientId });
  const conversation = await ensureConversation(contact);

  const message = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      direction: "outbound",
      kind,
      text: text || null,
      metaMessageId: metaMessageId || null,
      status: "sent",
    },
  });

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { lastMessageAt: message.createdAt, lastPreview: preview(text) },
    // outbound não mexe em unreadCount (é a própria clínica falando)
  });

  return { messageId: message.id, conversationId: conversation.id };
}

// Atualiza o status de entrega de uma mensagem outbound (status callback da Meta:
// sent → delivered → read → failed). Best-effort: se a msg não existe, ignora.
export async function updateOutboundStatus(metaMessageId, status) {
  if (!metaMessageId || !status) return;
  await prisma.message
    .updateMany({ where: { metaMessageId, direction: "outbound" }, data: { status } })
    .catch(() => {});
}
