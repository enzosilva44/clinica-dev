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

        alertLevel:
          data.alertLevel || "none",

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

// Mapeia a opção de ordenação escolhida na UI para o orderBy do Prisma.
// Default "recent" preserva o comportamento antigo (mais recentes primeiro).
const SORT_OPTIONS = {
  recent:    { createdAt: "desc" },
  oldest:    { createdAt: "asc" },
  name_asc:  { name: "asc" },
  name_desc: { name: "desc" },
};

export async function findAll({
  userId,
  page,
  search,
  status,
  sortBy = "recent",
}) {
  const limit = 10;

  const skip = (page - 1) * limit;

  const orderBy = SORT_OPTIONS[sortBy] || SORT_OPTIONS.recent;

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

        orderBy,
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
      alertLevel: data.alertLevel || "none",
    },
  });
}

function normName(str) {
  return String(str ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z\s]/g, "")
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

function nameSimilarity(a, b) {
  const ta = normName(a);
  const tb = normName(b);
  if (ta.length === 0 || tb.length === 0) return 0;
  const intersection = ta.filter((t) => tb.includes(t));
  return intersection.length / Math.min(ta.length, tb.length);
}

function normField(v) {
  return String(v ?? "").replace(/\D/g, "").trim();
}

export async function checkImport(patients, userId) {
  const existing = await prisma.patient.findMany({
    where: { userId, isActive: true },
    select: { id: true, name: true, cpf: true, phone: true, email: true },
  });

  const seenInFile = new Map(); // normName key → first index in patients array

  const result = patients.map((p, idx) => {
    const nameKey = normName(p.name).join(" ");
    const cpfKey  = normField(p.cpf);
    const phoneKey = normField(p.phone);

    // Within-file duplicate
    const prevIdx = seenInFile.get(nameKey);
    if (prevIdx !== undefined) {
      return { ...p, _idx: idx, status: "duplicate_file", _duplicateOf: prevIdx };
    }
    seenInFile.set(nameKey, idx);

    // Exact match in DB
    const exactMatch = existing.find((e) => {
      if (cpfKey && normField(e.cpf) === cpfKey) return true;
      if (phoneKey && normField(e.phone) === phoneKey) return true;
      if (p.email && e.email && p.email.trim().toLowerCase() === e.email.trim().toLowerCase()) return true;
      if (normName(e.name).join(" ") === nameKey) return true;
      return false;
    });
    if (exactMatch) {
      return { ...p, _idx: idx, status: "exists", _matchedWith: { id: exactMatch.id, name: exactMatch.name, phone: exactMatch.phone } };
    }

    // Similar name in DB
    const similar = existing.find((e) => nameSimilarity(e.name, p.name) >= 0.8);
    if (similar) {
      return { ...p, _idx: idx, status: "similar", _matchedWith: { id: similar.id, name: similar.name, phone: similar.phone } };
    }

    return { ...p, _idx: idx, status: "new" };
  });

  return result;
}

export async function importBulk(patients, userId) {
  const results = { created: 0, skipped: 0, errors: [] };

  for (const row of patients) {
    try {
      if (!row.name?.trim()) {
        results.skipped++;
        continue;
      }
      await prisma.patient.create({
        data: {
          name: row.name.trim(),
          email: row.email?.trim() || null,
          phone: row.phone?.trim() || "",
          birthDate: (() => { const d = row.birthDate ? new Date(row.birthDate) : null; return d && !isNaN(d) ? d : null; })(),
          cpf: row.cpf?.trim() || null,
          rg: row.rg?.trim() || null,
          street: row.street?.trim() || null,
          city: row.city?.trim() || null,
          state: row.state?.trim() || null,
          zipCode: row.zipCode?.trim() || null,
          observations: row.observations?.trim() || null,
          user: { connect: { id: userId } },
        },
      });
      results.created++;
    } catch (err) {
      results.errors.push({ name: row.name, error: err.message });
    }
  }

  return results;
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