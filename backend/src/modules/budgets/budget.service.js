import { prisma } from "../../config/prisma.js";
import { createPending } from "../financial/transaction.service.js";

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

export async function findByPatient(patientId, userId) {
  return prisma.budget.findMany({
    where: { patientId, userId },
    include: { items: true, transactions: true },
    orderBy: { createdAt: "desc" },
  });
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
