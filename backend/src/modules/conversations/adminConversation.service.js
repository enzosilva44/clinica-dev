// Visão de operador (admin.iaso) do módulo Conversas.
// Diferente do conversation.controller (escopo por clínica): aqui NÃO há
// filtro por userId — o operador da plataforma vê todas as clínicas + a saúde
// da fila WebhookEvent. Só chamado atrás de requireAdmin no core.
import { prisma } from "../../config/prisma.js";

// Saúde da fila + volume de conversas. Um retrato rápido pro painel.
export async function conversationsOverview() {
  const [statusRows, totalConversations, totalMessages, recentFailures] = await Promise.all([
    prisma.webhookEvent.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.conversation.count(),
    prisma.message.count(),
    prisma.webhookEvent.findMany({
      where: { status: "failed" },
      orderBy: { receivedAt: "desc" },
      take: 10,
      select: { id: true, source: true, attempts: true, lastError: true, receivedAt: true },
    }),
  ]);

  const queue = { pending: 0, processing: 0, processed: 0, failed: 0 };
  for (const r of statusRows) queue[r.status] = r._count._all;

  return { queue, totalConversations, totalMessages, recentFailures };
}

// Lista de conversas de TODAS as clínicas, mais recente primeiro.
// Traz o nome da clínica (dona) e do contato p/ a tabela do operador.
export async function listAllConversations({ page = 1, limit = 20, status } = {}) {
  const p = Math.max(1, +page);
  const l = Math.min(50, +limit);
  const where = status ? { status } : {};

  const [rows, total] = await Promise.all([
    prisma.conversation.findMany({
      where,
      orderBy: { lastMessageAt: "desc" },
      skip: (p - 1) * l,
      take: l,
      include: {
        contact: { select: { phone: true, name: true, patientId: true } },
        user: { select: { id: true, name: true, clinicName: true } },
      },
    }),
    prisma.conversation.count({ where }),
  ]);

  const data = rows.map((c) => ({
    id: c.id,
    status: c.status,
    lastMessageAt: c.lastMessageAt,
    lastPreview: c.lastPreview,
    unreadCount: c.unreadCount,
    contact: c.contact,
    clinic: { id: c.user.id, name: c.user.clinicName || c.user.name },
  }));

  return { data, total, totalPages: Math.ceil(total / l) };
}

// Timeline de uma conversa (qualquer clínica — visão de operador, sem escopo).
export async function getConversationTimeline(id) {
  const conversation = await prisma.conversation.findUnique({
    where: { id },
    include: {
      contact: { select: { phone: true, name: true, patientId: true } },
      user: { select: { id: true, name: true, clinicName: true } },
    },
  });
  if (!conversation) return null;

  const messages = await prisma.message.findMany({
    where: { conversationId: id },
    orderBy: { createdAt: "asc" },
  });

  return {
    id: conversation.id,
    status: conversation.status,
    contact: conversation.contact,
    clinic: { id: conversation.user.id, name: conversation.user.clinicName || conversation.user.name },
    messages,
  };
}
