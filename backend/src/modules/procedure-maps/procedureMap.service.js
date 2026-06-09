import { prisma } from "../../config/prisma.js";

const EXTRA_FIELDS = [
  "productName","applicationDate","dilutionDate","dilutionVolume",
  "lotNumber","expiryDate","vialPresentation","clinicalNotes","backgroundPhotoId","baseImage",
];

function pickExtras(data, existing = {}) {
  const out = {};
  for (const f of EXTRA_FIELDS) {
    if (f in data) {
      const v = data[f];
      if (f === "applicationDate" || f === "dilutionDate" || f === "expiryDate") {
        out[f] = v ? new Date(v) : null;
      } else if (f === "dilutionVolume") {
        out[f] = v !== "" && v != null ? parseFloat(v) : null;
      } else {
        out[f] = v !== "" ? (v ?? null) : null;
      }
    } else if (existing[f] !== undefined) {
      out[f] = existing[f];
    }
  }
  return out;
}

export async function findByPatient(patientId, userId) {
  return prisma.procedureMap.findMany({
    where: { patientId, userId },
    orderBy: { date: "desc" },
  });
}

export async function findById(id, userId) {
  const map = await prisma.procedureMap.findFirst({ where: { id, userId } });
  if (!map) throw new Error("Mapa não encontrado");
  return map;
}

export async function create(patientId, userId, data) {
  return prisma.procedureMap.create({
    data: {
      title: data.title || null,
      date: data.date ? new Date(data.date) : new Date(),
      markers: data.markers ?? [],
      ...pickExtras(data),
      patientId,
      userId,
    },
  });
}

export async function update(id, userId, data) {
  const map = await prisma.procedureMap.findFirst({ where: { id, userId } });
  if (!map) throw new Error("Mapa não encontrado");

  return prisma.procedureMap.update({
    where: { id },
    data: {
      title: data.title ?? map.title,
      date: data.date ? new Date(data.date) : map.date,
      markers: data.markers ?? map.markers,
      ...pickExtras(data, map),
    },
  });
}

export async function remove(id, userId) {
  const map = await prisma.procedureMap.findFirst({ where: { id, userId } });
  if (!map) throw new Error("Mapa não encontrado");
  return prisma.procedureMap.delete({ where: { id } });
}
