import { prisma } from "../../config/prisma.js";
import * as stockRequestService from "../products/stockRequest.service.js";

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
        name: data.name,
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

  const stockItems = (data.materialsUsed || []).filter(
    (m) => m.productId && Number(m.quantity) > 0
  );
  for (const item of stockItems) {
    await stockRequestService.create(userId, {
      type: "saida",
      productId: item.productId,
      quantity: item.quantity,
      reason: `Evolução — ${patient.name}${data.procedure ? ` (${data.procedure})` : ""}`,
    }).catch(() => null);
  }

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