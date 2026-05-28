import { Router } from "express";

import * as patientController from "./patient.controller.js";

import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { prisma } from "../../config/prisma.js";

const router = Router();

router.use(authMiddleware);

router.get("/", patientController.findAll);

router.get("/:id/stats", async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const patient = await prisma.patient.findFirst({
      where: { id, userId },
      select: { birthDate: true },
    });
    if (!patient) return res.status(404).json({ error: "Not found" });

    const [appointments, transactions] = await Promise.all([
      prisma.appointment.findMany({
        where: { patientId: id, userId },
        select: { startsAt: true, procedureType: true, status: true },
        orderBy: { startsAt: "asc" },
      }),
      prisma.transaction.findMany({
        where: { patientId: id, userId },
        select: { amount: true, type: true, status: true },
      }),
    ]);

    // Birthday
    let birthday = null;
    if (patient.birthDate) {
      const b = new Date(patient.birthDate);
      const now = new Date();
      let age = now.getFullYear() - b.getFullYear();
      if (now.getMonth() < b.getMonth() || (now.getMonth() === b.getMonth() && now.getDate() < b.getDate())) age--;
      const next = new Date(now.getFullYear(), b.getMonth(), b.getDate());
      if (next < now) next.setFullYear(now.getFullYear() + 1);
      const daysUntil = Math.ceil((next - now) / 86400000);
      birthday = {
        date: patient.birthDate,
        age,
        daysUntil: daysUntil >= 365 ? 0 : daysUntil,
        isToday: b.getDate() === now.getDate() && b.getMonth() === now.getMonth(),
      };
    }

    // Client since
    let clientSince = null;
    if (appointments.length > 0) {
      const start = new Date(appointments[0].startsAt);
      const now = new Date();
      const days = Math.floor((now - start) / 86400000);
      const months = Math.floor(days / 30);
      const years = Math.floor(days / 365);
      clientSince = {
        date: appointments[0].startsAt,
        label:
          years >= 1
            ? `${years} ano${years > 1 ? "s" : ""}`
            : months >= 1
            ? `${months} ${months === 1 ? "mês" : "meses"}`
            : `${days} dia${days !== 1 ? "s" : ""}`,
      };
    }

    // Financial — receita only, exclude canceled
    const revenue = transactions.filter(
      (t) => t.type?.toLowerCase().includes("receita") && t.status?.toLowerCase() !== "cancelado"
    );
    const totalSpent = revenue.reduce((s, t) => s + (t.amount || 0), 0);
    const avgTicket = revenue.length > 0 ? totalSpent / revenue.length : 0;

    // Weekday distribution
    const DAYS_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    const weekdays = [0, 0, 0, 0, 0, 0, 0];
    appointments.forEach((a) => { weekdays[new Date(a.startsAt).getDay()]++; });
    const weekdayDistribution = DAYS_LABELS.map((label, i) => ({ day: i, label, count: weekdays[i] }));

    // Top procedures
    const procCount = {};
    appointments.forEach((a) => {
      if (a.procedureType) procCount[a.procedureType] = (procCount[a.procedureType] || 0) + 1;
    });
    const topProcedures = Object.entries(procCount)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return res.json({
      birthday,
      clientSince,
      totalAppointments: appointments.length,
      totalSpent,
      avgTicket,
      weekdayDistribution,
      topProcedures,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// router.get("/:id", patientController.findById);

router.get("/:id", patientController.findOne);

router.post("/", patientController.create);

router.put("/:id", patientController.update);

router.delete("/:id", patientController.remove);

export default router;