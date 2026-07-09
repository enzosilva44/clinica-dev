import { prisma } from "../../config/prisma.js";
import { createPending } from "../financial/transaction.service.js";

const BUDGET_STATUSES = ["rascunho", "aprovado", "concluido", "cancelado"];

function normalizeItem(item) {
  const quantity = Math.max(Number(item.quantity) || 1, 1);
  const unitPrice = Math.max(Number(item.unitPrice) || 0, 0);

  const sessionIndex =
    item.sessionIndex === null || item.sessionIndex === undefined
      ? null
      : Math.max(Number(item.sessionIndex), 0);

  return {
    procedureId: item.procedureId || null,
    procedureName: item.procedureName,
    quantity,
    unitPrice,
    total: quantity * unitPrice,
    observation: item.observation || null,
    sessionIndex: Number.isNaN(sessionIndex) ? null : sessionIndex,
  };
}

// Anexa saldo de sessões do PACOTE (sessionCount − sessões realizadas).
// Os procedimentos (items) são o escopo/inclusos, não a contagem de sessões.
function withBalances(budget) {
  const done = budget.sessions?.length || 0;
  const contracted = budget.isPackage ? budget.sessionCount : 0;
  return {
    ...budget,
    contracted,
    done,
    remaining: Math.max(contracted - done, 0),
  };
}

export async function findByPatient(patientId, userId) {
  const budgets = await prisma.budget.findMany({
    where: { patientId, userId },
    include: {
      items: true,
      sessions: { orderBy: { performedAt: "desc" } },
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

  // Cancelar mantém o orçamento registrado, mas o financeiro precisa bater:
  // removemos as parcelas/cobranças AINDA PENDENTES vinculadas (para não seguirem
  // aparecendo como a-receber). Transações já PAGAS são preservadas — dinheiro que
  // entrou é fato consumado. Segue a lógica de grupo de parcelas do remove().
  if (status === "cancelado") {
    return prisma.$transaction(async (tx) => {
      const linked = await tx.transaction.findMany({
        where: { budgetId: id, userId },
        select: { installmentGroupId: true },
      });
      const groupIds = linked.map((t) => t.installmentGroupId).filter(Boolean);
      await tx.transaction.deleteMany({
        where: {
          userId,
          status: "pendente",
          OR: [
            { budgetId: id },
            ...(groupIds.length ? [{ installmentGroupId: { in: groupIds } }] : []),
          ],
        },
      });
      return tx.budget.update({ where: { id }, data: { status } });
    });
  }

  return prisma.budget.update({ where: { id }, data: { status } });
}

// Registra uma sessão realizada do pacote. Uma sessão pode conter vários
// procedimentos (data.procedures = [{ procedureId?, procedureName }]).
export async function registerSession(budgetId, userId, data = {}) {
  const budget = await prisma.budget.findFirst({
    where: { id: budgetId, userId },
    include: { sessions: true },
  });
  if (!budget) throw new Error("Orçamento não encontrado");
  if (!budget.isPackage) {
    throw new Error("Este orçamento não é um pacote de sessões");
  }
  if (budget.status !== "aprovado") {
    throw new Error("O orçamento precisa estar aprovado para registrar sessões");
  }
  if (budget.sessions.length >= budget.sessionCount) {
    throw new Error("Todas as sessões contratadas do pacote já foram realizadas");
  }

  const procedures = Array.isArray(data.procedures)
    ? data.procedures
        .filter((p) => p && p.procedureName)
        .map((p) => ({ procedureId: p.procedureId || null, procedureName: p.procedureName }))
    : null;

  const session = await prisma.budgetSession.create({
    data: {
      budgetId,
      appointmentId: data.appointmentId || null,
      performedAt: data.performedAt ? new Date(data.performedAt) : new Date(),
      procedures: procedures && procedures.length ? procedures : undefined,
      notes: data.notes || null,
    },
  });

  await maybeCompleteBudget(budgetId);
  return session;
}

export async function removeSession(id, userId) {
  const session = await prisma.budgetSession.findFirst({
    where: { id, budget: { userId } },
    include: { budget: true },
  });
  if (!session) throw new Error("Sessão não encontrada");
  await prisma.budgetSession.delete({ where: { id } });
  // Ao devolver saldo, se o pacote estava concluído, volta pra aprovado.
  if (session.budget.status === "concluido") {
    await prisma.budget.update({ where: { id: session.budgetId }, data: { status: "aprovado" } });
  }
  return { ok: true };
}

async function maybeCompleteBudget(budgetId) {
  const budget = await prisma.budget.findUnique({
    where: { id: budgetId },
    include: { _count: { select: { sessions: true } } },
  });
  if (budget && budget._count.sessions >= budget.sessionCount) {
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
        isPackage: Boolean(data.isPackage),
        sessionCount: data.isPackage ? Math.max(Number(data.sessionCount) || 1, 1) : 1,
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
    settlementType: data.txSettlementType || null,
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
