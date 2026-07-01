import { randomUUID } from "crypto";
import { prisma } from "../../config/prisma.js";
import { computeFee } from "./cardFee.service.js";


// ─── include padrão ──────────────────────────────────────────────────────────

const INCLUDE = {
  patient: { select: { id: true, name: true } },
  appointment: {
    select: {
      id: true, title: true, procedureType: true, startsAt: true,
      patient: { select: { id: true, name: true } },
    },
  },
  budget: {
    select: {
      id: true, title: true, total: true,
      patient: { select: { id: true, name: true } },
    },
  },
};

// ─── helpers ──────────────────────────────────────────────────────────────────

function monthRange(month) {
  const [year, m] = month.split("-").map(Number);
  return { start: new Date(year, m - 1, 1), end: new Date(year, m, 1) };
}

function calcSummary(txs) {
  const receitas = txs.filter((t) => t.type === "receita").reduce((s, t) => s + t.amount, 0);
  const despesas = txs.filter((t) => t.type === "despesa").reduce((s, t) => s + t.amount, 0);
  return { receitas, despesas, saldo: receitas - despesas };
}

async function resolvePatientId(data) {
  if (data.patientId) return data.patientId;
  if (data.appointmentId) {
    const appt = await prisma.appointment.findUnique({ where: { id: data.appointmentId } });
    if (appt?.patientId) return appt.patientId;
  }
  if (data.budgetId) {
    const budget = await prisma.budget.findUnique({ where: { id: data.budgetId } });
    if (budget?.patientId) return budget.patientId;
  }
  return null;
}

// ─── findAll ─────────────────────────────────────────────────────────────────

export async function findAll(userId, filters = {}) {
  const where = { userId };

  if (filters.patientId) where.patientId = filters.patientId;
  if (filters.status) where.status = filters.status;
  if (filters.type) where.type = filters.type;
  if (filters.category) where.category = filters.category;
  if (filters.paymentMethod) where.paymentMethod = filters.paymentMethod;

  if (filters.startDate || filters.endDate) {
    where.createdAt = {};
    if (filters.startDate) where.createdAt.gte = new Date(filters.startDate);
    if (filters.endDate) where.createdAt.lte = new Date(filters.endDate + "T23:59:59.999Z");
  } else if (filters.month) {
    const { start, end } = monthRange(filters.month);
    where.createdAt = { gte: start, lt: end };
  }

  return prisma.transaction.findMany({ where, include: INCLUDE, orderBy: { createdAt: "desc" } });
}

// ─── getSummary ───────────────────────────────────────────────────────────────

export async function getSummary(userId, month) {
  const { start, end } = monthRange(month);
  const transactions = await prisma.transaction.findMany({
    where: { userId, status: "confirmado", createdAt: { gte: start, lt: end } },
  });
  const pendentes = await prisma.transaction.count({ where: { userId, status: "pendente" } });
  return { ...calcSummary(transactions), pendentes };
}

// ─── getAnalytics ─────────────────────────────────────────────────────────────

export async function getAnalytics(userId, month) {
  const { start, end } = monthRange(month);
  const [year, m] = month.split("-").map(Number);
  const prevYear = m === 1 ? year - 1 : year;
  const prevM = m === 1 ? 12 : m - 1;
  const { start: prevStart, end: prevEnd } = monthRange(`${prevYear}-${String(prevM).padStart(2, "0")}`);

  const [curr, prev] = await Promise.all([
    prisma.transaction.findMany({ where: { userId, status: "confirmado", createdAt: { gte: start, lt: end } } }),
    prisma.transaction.findMany({ where: { userId, status: "confirmado", createdAt: { gte: prevStart, lt: prevEnd } } }),
  ]);

  const weeks = [
    { name: "Sem 1", receitas: 0, despesas: 0 },
    { name: "Sem 2", receitas: 0, despesas: 0 },
    { name: "Sem 3", receitas: 0, despesas: 0 },
    { name: "Sem 4+", receitas: 0, despesas: 0 },
  ];
  for (const t of curr) {
    const day = new Date(t.createdAt).getDate();
    const wi = day <= 7 ? 0 : day <= 14 ? 1 : day <= 21 ? 2 : 3;
    if (t.type === "receita") weeks[wi].receitas += t.amount;
    else weeks[wi].despesas += t.amount;
  }

  const catMap = {};
  for (const t of curr) {
    const cat = t.category || "Outros";
    if (!catMap[cat]) catMap[cat] = { receitas: 0, despesas: 0 };
    if (t.type === "receita") catMap[cat].receitas += t.amount;
    else catMap[cat].despesas += t.amount;
  }
  const categories = Object.entries(catMap)
    .map(([category, d]) => ({ category, ...d, total: d.receitas + d.despesas }))
    .sort((a, b) => b.total - a.total);

  const currSum = calcSummary(curr);
  const prevSum = calcSummary(prev);
  const pct = (c, p) => (p === 0 ? null : Math.round(((c - p) / p) * 100));

  return {
    weekly: weeks,
    categories,
    comparison: {
      current: currSum,
      previous: prevSum,
      receitasPct: pct(currSum.receitas, prevSum.receitas),
      despesasPct: pct(currSum.despesas, prevSum.despesas),
      saldoPct: pct(currSum.saldo, prevSum.saldo),
    },
  };
}

// ─── getUpcoming ──────────────────────────────────────────────────────────────

export async function getUpcoming(userId) {
  const in30 = new Date();
  in30.setDate(in30.getDate() + 30);
  return prisma.transaction.findMany({
    where: { userId, status: "pendente", dueDate: { not: null, lte: in30 } },
    include: INCLUDE,
    orderBy: { dueDate: "asc" },
  });
}

// ─── create ───────────────────────────────────────────────────────────────────

export async function create(userId, data) {
  const count = data.installments ? Number(data.installments) : 1;
  const patientId = await resolvePatientId(data);

  // Taxa da maquininha: só para receita paga no cartão, calculada sobre o total.
  const fee = data.type === "receita"
    ? await computeFee(userId, {
        paymentMethod: data.paymentMethod,
        cardBrand: data.cardBrand,
        installments: count,
        amount: Number(data.amount),
      })
    : null;

  // Rateio proporcional da taxa por parcela (último absorve o arredondamento).
  const feeForShare = (share, isLast, sumSoFar) => {
    if (!fee) return {};
    const feeAmount = isLast
      ? Math.round((fee.feeAmount - sumSoFar) * 100) / 100
      : Math.round(share * (fee.feePercent / 100) * 100) / 100;
    return {
      cardBrand: fee.cardBrand,
      feePercent: fee.feePercent,
      feeAmount,
      netAmount: Math.round((share - feeAmount) * 100) / 100,
    };
  };

  if (count > 1) {
    const groupId = randomUUID();
    const total = Number(data.amount);
    const base = Math.round((total / count) * 100) / 100;
    const lastAmt = Math.round((total - base * (count - 1)) * 100) / 100;
    const firstDue = data.dueDate ? new Date(data.dueDate) : new Date();

    let feeSum = 0;
    const ops = Array.from({ length: count }, (_, i) => {
      const dueDate = new Date(firstDue);
      dueDate.setMonth(dueDate.getMonth() + i);
      const isLast = i === count - 1;
      const share = isLast ? lastAmt : base;
      const feeFields = feeForShare(share, isLast, feeSum);
      if (feeFields.feeAmount) feeSum += feeFields.feeAmount;
      return prisma.transaction.create({
        data: {
          type: data.type,
          status: "pendente",
          description: `${data.description} (${i + 1}/${count})`,
          amount: share,
          category: data.category || null,
          paymentMethod: data.paymentMethod || null,
          notes: data.notes || null,
          dueDate,
          installments: count,
          installmentNumber: i + 1,
          installmentGroupId: groupId,
          patientId,
          appointmentId: i === 0 ? (data.appointmentId || null) : null,
          budgetId: i === 0 ? (data.budgetId || null) : null,
          userId,
          ...feeFields,
        },
      });
    });

    const results = await prisma.$transaction(ops);
    return { installmentGroup: groupId, count, first: results[0] };
  }

  const amount = Number(data.amount);
  return prisma.transaction.create({
    data: {
      type: data.type,
      status: "confirmado",
      description: data.description,
      amount,
      category: data.category || null,
      paymentMethod: data.paymentMethod || null,
      notes: data.notes || null,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      isRecurring: !!data.isRecurring,
      recurringDay: data.recurringDay ? Number(data.recurringDay) : null,
      installments: 1,
      installmentNumber: 1,
      patientId,
      appointmentId: data.appointmentId || null,
      budgetId: data.budgetId || null,
      paidAt: new Date(),
      userId,
      ...feeForShare(amount, true, 0),
    },
    include: INCLUDE,
  });
}

export async function createPending(userId, data) {
  if (data.appointmentId) {
    const existing = await prisma.transaction.findUnique({ where: { appointmentId: data.appointmentId } });
    if (existing) return existing;
  }

  const count = data.installments ? Number(data.installments) : 1;

  if (count > 1) {
    const groupId = randomUUID();
    const total = Number(data.amount ?? 0);
    const base = Math.round((total / count) * 100) / 100;
    const lastAmt = Math.round((total - base * (count - 1)) * 100) / 100;
    const firstDue = data.dueDate ? new Date(data.dueDate) : new Date();

    const ops = Array.from({ length: count }, (_, i) => {
      const dueDate = new Date(firstDue);
      dueDate.setMonth(dueDate.getMonth() + i);
      return prisma.transaction.create({
        data: {
          type: "receita",
          status: "pendente",
          description: `${data.description} (${i + 1}/${count})`,
          amount: i === count - 1 ? lastAmt : base,
          category: data.category || "Procedimento",
          paymentMethod: data.paymentMethod || null,
          notes: data.notes || null,
          dueDate,
          installments: count,
          installmentNumber: i + 1,
          installmentGroupId: groupId,
          appointmentId: i === 0 ? (data.appointmentId || null) : null,
          budgetId: i === 0 ? (data.budgetId || null) : null,
          patientId: data.patientId || null,
          userId,
        },
      });
    });

    return prisma.$transaction(ops);
  }

  return prisma.transaction.create({
    data: {
      type: "receita",
      status: "pendente",
      description: data.description,
      amount: Number(data.amount ?? 0),
      category: data.category || "Procedimento",
      paymentMethod: data.paymentMethod || null,
      notes: data.notes || null,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      installments: 1,
      installmentNumber: 1,
      appointmentId: data.appointmentId || null,
      budgetId: data.budgetId || null,
      patientId: data.patientId || null,
      userId,
    },
  });
}

// ─── update ───────────────────────────────────────────────────────────────────

export async function update(id, userId, data) {
  const tx = await prisma.transaction.findFirst({ where: { id, userId } });
  if (!tx) throw new Error("Transação não encontrada");

  return prisma.transaction.update({
    where: { id },
    data: {
      description: data.description ?? tx.description,
      amount: data.amount !== undefined ? Number(data.amount) : tx.amount,
      category: data.category ?? tx.category,
      paymentMethod: data.paymentMethod ?? tx.paymentMethod,
      notes: data.notes !== undefined ? (data.notes || null) : tx.notes,
      dueDate: data.dueDate ? new Date(data.dueDate) : tx.dueDate,
      isRecurring: data.isRecurring !== undefined ? !!data.isRecurring : tx.isRecurring,
      recurringDay: data.recurringDay !== undefined ? Number(data.recurringDay) : tx.recurringDay,
      type: data.type ?? tx.type,
    },
    include: INCLUDE,
  });
}

// ─── approve ─────────────────────────────────────────────────────────────────

export async function approve(id, userId, data) {
  const tx = await prisma.transaction.findFirst({ where: { id, userId, status: "pendente" } });
  if (!tx) throw new Error("Transação não encontrada ou já confirmada");

  const amount = data.amount !== undefined ? Number(data.amount) : tx.amount;
  const paymentMethod = data.paymentMethod || null;

  // Recalcula a taxa da maquininha ao confirmar (método definido agora).
  const fee = tx.type === "receita"
    ? await computeFee(userId, {
        paymentMethod,
        cardBrand: data.cardBrand || tx.cardBrand,
        installments: tx.installments || 1,
        amount,
      })
    : null;

  return prisma.transaction.update({
    where: { id },
    data: {
      status: "confirmado",
      amount,
      paymentMethod,
      paidAt: new Date(),
      cardBrand: fee ? fee.cardBrand : null,
      feePercent: fee ? fee.feePercent : null,
      feeAmount: fee ? fee.feeAmount : null,
      netAmount: fee ? fee.netAmount : null,
    },
    include: INCLUDE,
  });
}

// ─── cancel / remove ─────────────────────────────────────────────────────────

export async function cancel(id, userId) {
  const tx = await prisma.transaction.findFirst({ where: { id, userId } });
  if (!tx) throw new Error("Transação não encontrada");
  return prisma.transaction.update({ where: { id }, data: { status: "cancelado" } });
}

export async function remove(id, userId) {
  const tx = await prisma.transaction.findFirst({ where: { id, userId } });
  if (!tx) throw new Error("Transação não encontrada");
  return prisma.transaction.delete({ where: { id } });
}
