import { prisma } from "../../config/prisma.js";
import { createPending } from "../financial/transaction.service.js";

export async function create(data, user) {
  const category = data.category || "consulta";
  // Lembrete e compromisso pessoal podem não ter paciente vinculado.
  const requiresPatient = category === "consulta" || category === "retorno";

  if (data.patientId) {
    const patientExists = await prisma.patient.findFirst({
      where: { id: data.patientId, userId: user.id, isActive: true },
    });
    if (!patientExists) throw new Error("Paciente não encontrado");
  } else if (requiresPatient) {
    throw new Error("Paciente é obrigatório para consultas e retornos.");
  }

  const startsAt = new Date(data.startsAt);
  const endsAt = new Date(data.endsAt);
  const idempotencyKey = data.idempotencyKey || null;

  // Se já existe um appointment com essa idempotencyKey, retorna ele (request repetida)
  if (idempotencyKey) {
    const existing = await prisma.appointment.findUnique({
      where: { idempotencyKey },
      include: { patient: true },
    });
    if (existing) return existing;
  }

  let appointment;
  try {
    appointment = await prisma.appointment.create({
      data: {
        title: data.title,
        description: data.description,
        startsAt,
        endsAt,
        professional: data.professional,
        procedureType: data.procedureType,
        notes: data.notes,
        status: data.status || "SCHEDULED",
        color: data.color,
        idempotencyKey,
        category,
        isAllDay: data.isAllDay ?? false,
        recurrenceRule: data.recurrenceRule || null,
        parentAppointmentId: data.parentAppointmentId || null,
        ...(data.patientId ? { patient: { connect: { id: data.patientId } } } : {}),
        user: { connect: { id: user.id } },
      },
      include: { patient: true },
    });
  } catch (error) {
    // P2002 = violação de constraint única (race condition: outra request criou primeiro)
    if (error.code === "P2002" && idempotencyKey) {
      const existing = await prisma.appointment.findUnique({
        where: { idempotencyKey },
        include: { patient: true },
      });
      if (existing) return existing;
    }
    throw error;
  }

  // Lembrete e compromisso pessoal não geram cobrança.
  if (!requiresPatient) {
    return appointment;
  }

  // busca preço do procedimento para já preencher o valor + dados de retorno
  let amount = 0;
  let suggestedReturn = null;
  if (appointment.procedureType) {
    const procedure = await prisma.procedure.findFirst({
      where: { name: appointment.procedureType, userId: user.id },
    });
    if (procedure?.price) amount = procedure.price;
    // Se o procedimento exige retorno, sugere uma data (data do agend. + returnDays)
    if (procedure?.requiresReturn && category !== "retorno") {
      const days = procedure.returnDays ?? 0;
      const returnDate = new Date(startsAt);
      returnDate.setDate(returnDate.getDate() + days);
      suggestedReturn = { date: returnDate.toISOString(), days, procedureName: procedure.name };
    }
  }

  await createPending(user.id, {
    appointmentId: appointment.id,
    patientId: appointment.patientId,
    description: appointment.procedureType || appointment.title,
    amount: data.txAmount !== undefined ? Number(data.txAmount) : amount,
    paymentMethod: data.txPaymentMethod || null,
    installments: data.txInstallments ? Number(data.txInstallments) : 1,
    dueDate: data.txDueDate || null,
    notes: data.txNotes || `Agendamento criado em ${new Date(appointment.startsAt).toLocaleDateString("pt-BR")} com ${appointment.professional || "profissional não informado"}.`,
    settlementType: data.txSettlementType || null,
  });

  return { ...appointment, suggestedReturn };
}

export async function findAll(user) {
  const appointments = await prisma.appointment.findMany({
    where: {
      userId: user.id,
    },

    include: {
      patient: true,
      transaction: true,
    },

    orderBy: {
      startsAt: "asc",
    },
  });

  return appointments;
}

// Cores por categoria de agendamento / tipo financeiro
const CALENDAR_COLORS = {
  consulta:    "#00704A",
  retorno:     "#2E6FA8",
  lembrete:    "#CBA258",
  compromisso: "#6F7F73",
  bloqueio:    "#8A8A8A",
  receivable:  "#1E9E5A",
  payable:     "#D9534F",
};

// Calendário unificado: agendamentos + itens financeiros (a receber / a pagar)
// types: lista de categorias/tipos a incluir. Se vazio, inclui tudo.
export async function getCalendar(user, { from, to, types } = {}) {
  const range = {};
  if (from) range.gte = new Date(from);
  if (to) range.lte = new Date(to);
  const hasRange = from || to;

  const include = (t) => !types || types.length === 0 || types.includes(t);
  const events = [];

  // ── Agendamentos ──
  const apptCategories = ["consulta", "retorno", "lembrete", "compromisso", "bloqueio"].filter(include);
  if (apptCategories.length > 0) {
    const appointments = await prisma.appointment.findMany({
      where: {
        userId: user.id,
        category: { in: apptCategories },
        ...(hasRange ? { startsAt: range } : {}),
      },
      include: { patient: true },
      orderBy: { startsAt: "asc" },
    });
    for (const a of appointments) {
      events.push({
        id: a.id,
        kind: "appointment",
        category: a.category,
        title: a.title || a.patient?.name || a.procedureType || "Agendamento",
        patientName: a.patient?.name ?? null,
        start: a.startsAt,
        end: a.endsAt,
        isAllDay: a.isAllDay,
        color: a.color || CALENDAR_COLORS[a.category] || CALENDAR_COLORS.consulta,
        status: a.status,
      });
    }
  }

  // ── Financeiro (a receber / a pagar) — plotado pela dueDate ──
  const wantReceivable = include("receivable");
  const wantPayable = include("payable");
  if (wantReceivable || wantPayable) {
    const txTypes = [];
    if (wantReceivable) txTypes.push("receita");
    if (wantPayable) txTypes.push("despesa");
    const transactions = await prisma.transaction.findMany({
      where: {
        userId: user.id,
        type: { in: txTypes },
        dueDate: hasRange ? range : { not: null },
      },
      include: { patient: true },
      orderBy: { dueDate: "asc" },
    });
    for (const t of transactions) {
      const isReceivable = t.type === "receita";
      // Transação só tem data (dueDate), guardada como meia-noite UTC. Lemos os
      // componentes em UTC e plotamos ao meio-dia UTC (09h no horário do Brasil)
      // para o item cair no DIA CORRETO da grade, sem deslocamento por fuso.
      const due = new Date(t.dueDate);
      const start = new Date(Date.UTC(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate(), 12, 0, 0));
      const end = new Date(start.getTime() + 30 * 60 * 1000);
      events.push({
        id: `tx-${t.id}`,
        kind: isReceivable ? "receivable" : "payable",
        category: isReceivable ? "receivable" : "payable",
        title: `${isReceivable ? "A receber" : "A pagar"}: ${t.description}`,
        patientName: t.patient?.name ?? null,
        start,
        end,
        isAllDay: false,
        color: CALENDAR_COLORS[isReceivable ? "receivable" : "payable"],
        amount: t.amount,
        status: t.status,
        transactionId: t.id,
      });
    }
  }

  return events;
}

export async function findById(id, user) {
  const appointment = await prisma.appointment.findFirst({
    where: {
      id,
      userId: user.id,
    },

    include: {
      patient: true,
    },
  });

  if (!appointment) {
    throw new Error("Agendamento não encontrado");
  }

  return appointment;
}

export async function findByPatient(patientId, userId) {
  return prisma.appointment.findMany({
    where: { patientId, userId },
    orderBy: { startsAt: "desc" },
  });
}

export async function update(
  appointmentId,
  userId,
  data
) {
  const appointment =
    await prisma.appointment.findFirst({
      where: {
        id: appointmentId,

        userId,
      },
    });

  if (!appointment) {
    throw new Error(
      "Agendamento não encontrado"
    );
  }

  const updated = await prisma.appointment.update({
    where: { id: appointmentId },
    data: {
      title: data.title,
      startsAt: data.startsAt ? new Date(data.startsAt) : undefined,
      endsAt: data.endsAt ? new Date(data.endsAt) : undefined,
      professional: data.professional,
      procedureType: data.procedureType,
      notes: data.notes,
      status: data.status,
      category: data.category,
      description: data.description,
      recurrenceRule: data.recurrenceRule,
    },
    include: { patient: true },
  });

  // Ao concluir, cria transação pendente no financeiro (se ainda não existir)
  if (data.status === "COMPLETED" || data.status === "FINISHED") {
    let amount = 0;
    if (updated.procedureType) {
      const procedure = await prisma.procedure.findFirst({
        where: { name: updated.procedureType, userId },
      });
      if (procedure?.price) amount = procedure.price;
    }

    await createPending(userId, {
      appointmentId: updated.id,
      patientId: updated.patientId,
      description: updated.procedureType || updated.title,
      amount,
    });
  }

  return updated;
}
