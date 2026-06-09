import { prisma } from "../../config/prisma.js";
import { triggerWelcome } from "../automations/automation.service.js";

export async function create(
  data,
  userId
) {
  const patient =
    await prisma.patient.create({
      data: {
        name: data.name,

        email: data.email,

        phone: data.phone,

        birthDate:
          data.birthDate &&
          data.birthDate !== ""
            ? new Date(
                data.birthDate
              )
            : null,

        cpf: data.cpf,

        rg: data.rg,

        street: data.street,

        city: data.city,

        state: data.state,

        country: data.country,

        zipCode: data.zipCode,

        observations:
          data.observations,

        user: {
          connect: {
            id: userId,
          },
        },
      },
    });

  triggerWelcome(userId, patient).catch(() => {});
  return patient;
}

export async function findAll({
  userId,
  page,
  search,
  status,
}) {
  const limit = 10;

  const skip = (page - 1) * limit;

  const where = {
    userId,

    isActive:
      status === "removed"
        ? false
        : true,

    OR: [
      {
        name: {
          contains: search,
          mode: "insensitive",
        },
      },

      {
        phone: {
          contains: search,
        },
      },

      {
        cpf: {
          contains: search,
        },
      },
    ],
  };

  const [patients, total] =
    await Promise.all([
      prisma.patient.findMany({
        where,

        skip,

        take: limit,

        include: {
          appointments: {
            orderBy: {
              startsAt: "desc",
            },

            take: 1,
          },
        },

        orderBy: {
          createdAt: "desc",
        },
      }),

      prisma.patient.count({
        where,
      }),
    ]);

  const formattedPatients =
    patients.map((patient) => ({
      ...patient,

      lastAppointment:
        patient.appointments[0]
          ?.startsAt || null,
    }));

  return {
    data: formattedPatients,

    page,

    total,

    totalPages: Math.ceil(
      total / limit
    ),
  };
}

export async function findOne(
  patientId,
  userId
) {
  const patient =
    await prisma.patient.findFirst({
      where: {
        id: patientId,

        userId,

        isActive: true,
      },
    });

  if (!patient) {
    throw new Error(
      "Paciente não encontrado"
    );
  }

  return patient;
}

export async function update(patientId, data, userId) {
  const patient = await prisma.patient.findFirst({
    where: { id: patientId, userId },
  });
  if (!patient) throw new Error("Paciente não encontrado");

  return prisma.patient.update({
    where: { id: patientId },
    data: {
      name: data.name,
      email: data.email || null,
      phone: data.phone,
      birthDate: data.birthDate && data.birthDate !== "" ? new Date(data.birthDate) : null,
      cpf: data.cpf || null,
      rg: data.rg || null,
      street: data.street || null,
      city: data.city || null,
      state: data.state || null,
      country: data.country || null,
      zipCode: data.zipCode || null,
      observations: data.observations || null,
    },
  });
}

export async function remove(patientId, userId) {
  const patient = await prisma.patient.findFirst({
    where: { id: patientId, userId, isActive: true },
  });
  if (!patient) throw new Error("Paciente não encontrado");

  return prisma.patient.update({
    where: { id: patientId },
    data: { isActive: false },
  });
}