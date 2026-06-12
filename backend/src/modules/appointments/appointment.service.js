import { prisma } from "../../config/prisma.js";
import { createPending } from "../financial/transaction.service.js";

export async function create(data, user) {
  const patientExists = await prisma.patient.findFirst({
    where: {
      id: data.patientId,
      userId: user.id,
      isActive: true,
    },
  });

  if (!patientExists) {
    throw new Error("Paciente não encontrado");
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
        patient: { connect: { id: data.patientId } },
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

  // busca preço do procedimento para já preencher o valor
  let amount = 0;
  if (appointment.procedureType) {
    const procedure = await prisma.procedure.findFirst({
      where: { name: appointment.procedureType, userId: user.id },
    });
    if (procedure?.price) amount = procedure.price;
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
  });

  return appointment;
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
