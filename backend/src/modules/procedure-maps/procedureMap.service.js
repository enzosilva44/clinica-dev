import { prisma } from "../../config/prisma.js";

const EXTRA_FIELDS = [
  "productName","applicationDate","dilutionDate","dilutionVolume",
  "lotNumber","expiryDate","vialPresentation","vialQuantity","vialUnit",
  "clinicalNotes","backgroundPhotoId","baseImage",
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
      products: data.products ?? [],
      appointmentId: data.appointmentId || null,
      parentMapId: data.parentMapId || null,
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
      products: data.products ?? map.products,
      // appointmentId é opcional; só atualiza se veio no payload (undefined = mantém)
      ...(data.appointmentId !== undefined ? { appointmentId: data.appointmentId || null } : {}),
      ...pickExtras(data, map),
    },
  });
}

// Cria um mapa de RETORNO replicando os pontos/produtos do mapa de origem.
// Os marcadores copiados ganham novos ids e a flag `inherited` para aparecerem
// como "fantasma" (referência) no front, permitindo marcar sobrepontos por cima.
export async function createRetorno(parentId, userId, data = {}) {
  const parent = await prisma.procedureMap.findFirst({ where: { id: parentId, userId } });
  if (!parent) throw new Error("Mapa não encontrado");

  // Cada retorno empurra os marcadores existentes uma "geração" para trás.
  // gen=0 → atendimento atual (círculo). gen=1 → retorno anterior imediato,
  // gen=2 → o anterior a esse, etc. O front escolhe a FORMA por geração.
  // origin guarda a data do mapa de onde o ponto veio, p/ a legenda.
  const srcMarkers = Array.isArray(parent.markers) ? parent.markers : [];
  const inheritedMarkers = srcMarkers.map((m) => ({
    ...m,
    id: `inh_${Math.random().toString(36).slice(2, 10)}`,
    inherited: true,
    gen: (Number(m.gen) || 0) + 1,
    origin: m.origin || parent.date, // 1ª herança carimba a data do mapa-mãe
  }));

  return prisma.procedureMap.create({
    data: {
      title: data.title?.trim() || `${parent.title || "Mapa"} — Retorno`,
      date: new Date(),
      markers: inheritedMarkers,
      products: parent.products ?? [],
      baseImage: parent.baseImage,
      backgroundPhotoId: parent.backgroundPhotoId,
      parentMapId: parent.id,
      appointmentId: data.appointmentId || null,
      patientId: parent.patientId,
      userId,
    },
  });
}

export async function remove(id, userId) {
  const map = await prisma.procedureMap.findFirst({ where: { id, userId } });
  if (!map) throw new Error("Mapa não encontrado");
  return prisma.procedureMap.delete({ where: { id } });
}
