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

  const appointment = await prisma.appointment.create({
    data: {
      title: data.title,
      description: data.description,
      startsAt: new Date(data.startsAt),
      endsAt: new Date(data.endsAt),
      professional: data.professional,
      procedureType: data.procedureType,
      notes: data.notes,
      status: data.status || "SCHEDULED",
      color: data.color,
      patient: { connect: { id: data.patientId } },
      user: { connect: { id: user.id } },
    },
    include: { patient: true },
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