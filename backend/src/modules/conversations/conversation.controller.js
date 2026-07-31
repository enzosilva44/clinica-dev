// Endpoints de leitura do inbox de Conversas (Fase 2).
// Tudo escopado por req.user.id — a clínica só vê as próprias conversas.
import { prisma } from "../../config/prisma.js";

// GET /conversations — lista de conversas da clínica, mais recente primeiro.
// Traz o contato (nome/telefone/paciente) e o preview da última mensagem.
export async function listConversations(req, res) {
  const { page = 1, limit = 20, status } = req.query;
  const p = Math.max(1, +page);
  const l = Math.min(50, +limit);
  const where = { userId: req.user.id, ...(status ? { status } : {}) };

  const [data, total] = await Promise.all([
    prisma.conversation.findMany({
      where,
      orderBy: { lastMessageAt: "desc" },
      skip: (p - 1) * l,
      take: l,
      include: {
        contact: {
          select: { id: true, phone: true, name: true, patientId: true },
        },
      },
    }),
    prisma.conversation.count({ where }),
  ]);

  res.json({ data, total, totalPages: Math.ceil(total / l) });
}

// GET /conversations/:id — a timeline (mensagens em ordem cronológica).
// 404 se a conversa não é da clínica logada (não vaza conversa de outra clínica).
export async function getConversation(req, res) {
  const { id } = req.params;
  const conversation = await prisma.conversation.findFirst({
    where: { id, userId: req.user.id },
    include: {
      contact: { select: { id: true, phone: true, name: true, patientId: true } },
    },
  });
  if (!conversation) return res.status(404).json({ error: "Conversa não encontrada" });

  const messages = await prisma.message.findMany({
    where: { conversationId: id },
    orderBy: { createdAt: "asc" },
  });

  res.json({ ...conversation, messages });
}

// POST /conversations/:id/read — zera o contador de não lidas.
export async function markRead(req, res) {
  const { id } = req.params;
  const updated = await prisma.conversation.updateMany({
    where: { id, userId: req.user.id },
    data: { unreadCount: 0 },
  });
  if (updated.count === 0) return res.status(404).json({ error: "Conversa não encontrada" });
  res.json({ ok: true });
}
