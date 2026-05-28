import { prisma } from "../../config/prisma.js";

export async function findAll(userId, filters = {}) {
  const where = { userId };

  if (filters.status) where.status = filters.status;
  if (filters.type) where.type = filters.type;

  if (filters.month) {
    const [year, month] = filters.month.split("-").map(Number);
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 1);
    where.createdAt = { gte: start, lt: end };
  }

  return prisma.transaction.findMany({
    where,
    include: {
      patient: { select: { id: true, name: true } },
      appointment: { select: { id: true, procedureType: true, startsAt: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getSummary(userId, month) {
  const [year, m] = month.split("-").map(Number);
  const start = new Date(year, m - 1, 1);
  const end = new Date(year, m, 1);

  const transactions = await prisma.transaction.findMany({
    where: { userId, status: "confirmado", createdAt: { gte: start, lt: end } },
  });

  const receitas = transactions
    .filter((t) => t.type === "receita")
    .reduce((sum, t) => sum + t.amount, 0);

  const despesas = transactions
    .filter((t) => t.type === "despesa")
    .reduce((sum, t) => sum + t.amount, 0);

  const pendentes = await prisma.transaction.count({
    where: { userId, status: "pendente" },
  });

  return { receitas, despesas, saldo: receitas - despesas, pendentes };
}

export async function create(userId, data) {
  return prisma.transaction.create({
    data: {
      type: data.type,
      status: "confirmado",
      description: data.description,
      amount: Number(data.amount),
      paymentMethod: data.paymentMethod || null,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      paidAt: new Date(),
      patientId: data.patientId || null,
      userId,
    },
  });
}

export async function createPending(userId, data) {
  // Verifica se já existe transação para este agendamento
  if (data.appointmentId) {
    const existing = await prisma.transaction.findUnique({
      where: { appointmentId: data.appointmentId },
    });
    if (existing) return existing;
  }

  return prisma.transaction.create({
    data: {
      type: "receita",
      status: "pendente",
      description: data.description,
      amount: Number(data.amount ?? 0),
      appointmentId: data.appointmentId || null,
      patientId: data.patientId || null,
      userId,
    },
  });
}

export async function approve(id, userId, data) {
  const transaction = await prisma.transaction.findFirst({
    where: { id, userId, status: "pendente" },
  });
  if (!transaction) throw new Error("Transação não encontrada ou já confirmada");

  return prisma.transaction.update({
    where: { id },
    data: {
      status: "confirmado",
      amount: data.amount !== undefined ? Number(data.amount) : transaction.amount,
      paymentMethod: data.paymentMethod || null,
      paidAt: new Date(),
    },
  });
}

export async function cancel(id, userId) {
  const transaction = await prisma.transaction.findFirst({ where: { id, userId } });
  if (!transaction) throw new Error("Transação não encontrada");

  return prisma.transaction.update({
    where: { id },
    data: { status: "cancelado" },
  });
}

export async function remove(id, userId) {
  const transaction = await prisma.transaction.findFirst({ where: { id, userId } });
  if (!transaction) throw new Error("Transação não encontrada");

  return prisma.transaction.delete({ where: { id } });
}
