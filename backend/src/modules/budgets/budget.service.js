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

  const budget = await prisma.budget.create({
    data: {
      title: data.title,
      validUntil: data.validUntil ? new Date(data.validUntil) : null,
      subtotal,
      discount,
      total,
      observations: data.observations || null,
      patientId: data.patientId,
      userId,
      items: {
        create: items,
      },
    },
    include: { items: true },
  });

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

  return prisma.budget.delete({
    where: { id },
  });
}
