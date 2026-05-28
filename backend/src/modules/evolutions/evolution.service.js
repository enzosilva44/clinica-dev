import { prisma } from "../../config/prisma.js";

export async function create(
  data,
  userId
) {
  const patient =
    await prisma.patient.findFirst({
      where: {
        id: data.patientId,
        userId,
        isActive: true,
      },
    });

  if (!patient) {
    throw new Error(
      "Paciente não encontrado"
    );
  }

  const evolution =
    await prisma.evolution.create({
      data: {
        description: data.description,
        procedure: data.procedure,
        materials: data.materials,
        ...(data.materialsUsed && { materialsUsed: data.materialsUsed }),
        ...(data.procedureId && {
          procedureRelation: { connect: { id: data.procedureId } },
        }),
        patient: { connect: { id: data.patientId } },
        createdBy: { connect: { id: userId } },
      },
      include: {
        procedureRelation: true,
      },
    });

  return evolution;
}

export async function findByPatient(
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

  return prisma.evolution.findMany({
    where: {
      patientId,
    },

    orderBy: {
      createdAt: "desc",
    },
  });
}