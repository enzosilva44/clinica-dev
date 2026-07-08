import { prisma } from "../../config/prisma.js";
import { createPending } from "../financial/transaction.service.js";

const BUDGET_STATUSES = ["rascunho", "aprovado", "concluido"];

function normalizeItem(item) {
  const quantity = Math.max(Number(item.quantity) || 1, 1);
  const unitPrice = Math.max(Number(item.unitPrice) || 0, 0);

  return {
    procedureId: item.procedureId || null,
    procedureName: item.procedureName,
    quantity,
    unitPrice,
    total: quantity * unitPrice,
    observation: item.observation || null,
  };
}

// Anexa saldo de sessões (contratado − realizado) por item do orçamento.
function withBalances(budget) {
  const items = budget.items.map((item) => {
    const done = item.sessions?.length || 0;
    return {
      ...item,
      contracted: item.quantity,
      done,
      remaining: Math.max(item.quantity - done, 0),
    };
  });
  return { ...budget, items };
}

export async function findByPatient(patientId, userId) {
  const budgets = await prisma.budget.findMany({
    where: { patientId, userId },
    include: {
      items: { include: { sessions: { orderBy: { performedAt: "desc" } } } },
      transactions: true,
    },
    orderBy: { createdAt: "desc" },
  });
  return budgets.map(withBalances);
}

export async function updateStatus(id, userId, status) {
  if (!BUDGET_STATUSES.includes(status)) throw new Error("Status inválido");
  const budget = await prisma.budget.findFirst({ where: { id, userId } });
  if (!budget) throw new Error("Orçamento não encontrado");
  return prisma.budget.update({ where: { id }, data: { status } });
}

// Registra uma sessão realizada de um item. Só permitido em orçamento aprovado.
export async function registerSession(budgetItemId, userId, data = {}) {
  const item = await prisma.budgetItem.findFirst({
    where: { id: budgetItemId, budget: { userId } },
    include: { budget: true, sessions: true },
  });
  if (!item) throw new Error("Item de orçamento não encontrado");
  if (item.budget.status !== "aprovado") {
    throw new Error("O orçamento precisa estar aprovado para registrar sessões");
  }
  if (item.sessions.length >= item.quantity) {
    throw new Error("Todas as sessões contratadas deste item já foram realizadas");
  }

  const session = await prisma.budgetSession.create({
    data: {
      budgetItemId,
      appointmentId: data.appointmentId || null,
      performedAt: data.performedAt ? new Date(data.performedAt) : new Date(),
      notes: data.notes || null,
    },
  });

  // Se todos os itens do orçamento atingiram o total contratado, marca concluído.
  await maybeCompleteBudget(item.budgetId);
  return session;
}

export async function removeSession(id, userId) {
  const session = await prisma.budgetSession.findFirst({
    where: { id, budgetItem: { budget: { userId } } },
    include: { budgetItem: true },
  });
  if (!session) throw new Error("Sessão não encontrada");
  await prisma.budgetSession.delete({ where: { id } });
  // Ao devolver saldo, se o orçamento estava concluído, volta pra aprovado.
  const budget = await prisma.budget.findUnique({ where: { id: session.budgetItem.budgetId } });
  if (budget?.status === "concluido") {
    await prisma.budget.update({ where: { id: budget.id }, data: { status: "aprovado" } });
  }
  return { ok: true };
}

async function maybeCompleteBudget(budgetId) {
  const items = await prisma.budgetItem.findMany({
    where: { budgetId },
    include: { _count: { select: { sessions: true } } },
  });
  const allDone = items.length > 0 && items.every((i) => i._count.sessions >= i.quantity);
  if (allDone) {
    await prisma.budget.update({ where: { id: budgetId }, data: { status: "concluido" } });
  }
}

export async function create(data, userId) {
  const items = (data.items || [])
    .filter((item) => item.procedureName)
    .map(normalizeItem);

  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  const discount = Math.max(Number(data.discount) || 0, 0);
  const total = Math.max(subtotal - discount, 0);
  const validUntil = data.validUntil ? new Date(data.validUntil) : null;
  const idempotencyKey = data.idempotencyKey || null;

  // Se já existe um budget com essa idempotencyKey, retorna ele (request repetida)
  if (idempotencyKey) {
    const existing = await prisma.budget.findUnique({
      where: { idempotencyKey },
      include: { items: true },
    });
    if (existing) return existing;
  }

  let budget;
  try {
    budget = await prisma.budget.create({
      data: {
        title: data.title,
        validUntil,
        subtotal,
        discount,
        total,
        observations: data.observations || null,
        status: BUDGET_STATUSES.includes(data.status) ? data.status : "rascunho",
        idempotencyKey,
        patientId: data.patientId,
        userId,
        items: {
          create: items,
        },
      },
      include: { items: true },
    });
  } catch (error) {
    // P2002 = violação de constraint única (race condition: outra request criou primeiro)
    if (error.code === "P2002" && idempotencyKey) {
      const existing = await prisma.budget.findUnique({
        where: { idempotencyKey },
        include: { items: true },
      });
      if (existing) return existing;
    }
    throw error;
  }

  await createPending(userId, {
    budgetId: budget.id,
    patientId: budget.patientId,
    description: budget.title,
    amount: budget.total,
    category: "Procedimento",
    paymentMethod: data.txPaymentMethod || null,
    installments: data.txInstallments ? Number(data.txInstallments) : 1,
    dueDate: data.txDueDate || null,
    notes: data.txNotes || `Orçamento gerado em ${new Date(budget.createdAt).toLocaleDateString("pt-BR")}${budget.validUntil ? `, válido até ${new Date(budget.validUntil).toLocaleDateString("pt-BR")}` : ""}.`,
  });

  return budget;
}

export async function remove(id, userId) {
  const budget = await prisma.budget.findFirst({
    where: { id, userId },
  });

  if (!budget) {
    throw new Error("Orçamento não encontrado");
  }

  // Remove o orçamento e todas as transações vinculadas a ele.
  // No parcelamento, apenas a 1ª parcela carrega o budgetId — as demais
  // compartilham o installmentGroupId. Por isso buscamos o grupo e apagamos
  // todas as parcelas, evitando órfãs que continuariam somando no total gasto.
  return prisma.$transaction(async (tx) => {
    const linked = await tx.transaction.findMany({
      where: { budgetId: id, userId },
      select: { id: true, installmentGroupId: true },
    });

    const groupIds = linked.map((t) => t.installmentGroupId).filter(Boolean);

    await tx.transaction.deleteMany({
      where: {
        userId,
        OR: [
          { budgetId: id },
          ...(groupIds.length ? [{ installmentGroupId: { in: groupIds } }] : []),
        ],
      },
    });

    return tx.budget.delete({ where: { id } });
  });
}
