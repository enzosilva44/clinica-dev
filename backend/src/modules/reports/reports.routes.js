import { Router } from "express";
import { prisma } from "../../config/prisma.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { requireFeature } from "../../middlewares/feature.middleware.js";

const router = Router();
router.use(authMiddleware, requireFeature("analytics"));

router.get("/", async (req, res) => {
  try {
    const userId = req.user.id;
    const { from, to } = req.query;

    const fromDate = from ? new Date(from) : (() => {
      const d = new Date();
      d.setMonth(d.getMonth() - 11);
      d.setDate(1);
      d.setHours(0, 0, 0, 0);
      return d;
    })();
    const toDate = to ? new Date(to) : (() => {
      const d = new Date();
      d.setHours(23, 59, 59, 999);
      return d;
    })();

    const [transactions, appointments, patients, evolutions] = await Promise.all([
      prisma.transaction.findMany({
        where: {
          userId,
          createdAt: { gte: fromDate, lte: toDate },
        },
        select: {
          type: true,
          status: true,
          amount: true,
          paymentMethod: true,
          createdAt: true,
          description: true,
        },
      }),
      prisma.appointment.findMany({
        where: {
          userId,
          startsAt: { gte: fromDate, lte: toDate },
        },
        select: {
          status: true,
          startsAt: true,
          procedureType: true,
          professional: true,
        },
      }),
      prisma.patient.findMany({
        where: {
          userId,
          createdAt: { gte: fromDate, lte: toDate },
        },
        select: { createdAt: true },
      }),
      prisma.evolution.findMany({
        where: {
          createdById: userId,
          createdAt: { gte: fromDate, lte: toDate },
        },
        select: { procedure: true, createdAt: true },
      }),
    ]);

    // ── FINANCIAL ──────────────────────────────────────────
    const revenue = transactions.filter((t) => t.type === "receita");
    const expenses = transactions.filter((t) => t.type === "despesa");

    const totalRevenue = revenue.reduce((s, t) => s + (t.amount ?? 0), 0);
    const totalExpenses = expenses.reduce((s, t) => s + (t.amount ?? 0), 0);
    const netProfit = totalRevenue - totalExpenses;
    const avgTicket = revenue.length > 0 ? totalRevenue / revenue.length : 0;

    // Revenue by month
    const revenueByMonth = buildMonthlyMap(fromDate, toDate);
    const expensesByMonth = buildMonthlyMap(fromDate, toDate);
    for (const t of revenue) {
      const key = monthKey(t.createdAt);
      if (revenueByMonth[key] !== undefined) revenueByMonth[key] += t.amount ?? 0;
    }
    for (const t of expenses) {
      const key = monthKey(t.createdAt);
      if (expensesByMonth[key] !== undefined) expensesByMonth[key] += t.amount ?? 0;
    }
    const revenueChartData = Object.entries(revenueByMonth).map(([month, value]) => ({
      month,
      receita: Math.round(value * 100) / 100,
      despesas: Math.round((expensesByMonth[month] ?? 0) * 100) / 100,
    }));

    // By payment method
    const paymentMap = {};
    for (const t of revenue) {
      const method = t.paymentMethod || "Não informado";
      paymentMap[method] = (paymentMap[method] ?? 0) + (t.amount ?? 0);
    }
    const byPaymentMethod = Object.entries(paymentMap)
      .map(([method, total]) => ({ method, total: Math.round(total * 100) / 100 }))
      .sort((a, b) => b.total - a.total);

    // ── APPOINTMENTS ───────────────────────────────────────
    const totalAppointments = appointments.length;
    const byStatus = {
      SCHEDULED: 0,
      CONFIRMED: 0,
      COMPLETED: 0,
      CANCELED: 0,
    };
    for (const a of appointments) {
      const s = a.status?.toUpperCase();
      if (byStatus[s] !== undefined) byStatus[s]++;
    }
    const completionRate = totalAppointments > 0
      ? Math.round((byStatus.COMPLETED / totalAppointments) * 100)
      : 0;
    const cancellationRate = totalAppointments > 0
      ? Math.round((byStatus.CANCELED / totalAppointments) * 100)
      : 0;

    // By weekday
    const weekdays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    const weekdayCount = Array(7).fill(0);
    for (const a of appointments) {
      if (a.status?.toUpperCase() !== "CANCELED") {
        weekdayCount[new Date(a.startsAt).getDay()]++;
      }
    }
    const byWeekday = weekdays.map((label, i) => ({ label, count: weekdayCount[i] }));

    // Appointments by month
    const apptByMonth = buildMonthlyMap(fromDate, toDate);
    for (const a of appointments) {
      if (a.status?.toUpperCase() !== "CANCELED") {
        const key = monthKey(a.startsAt);
        if (apptByMonth[key] !== undefined) apptByMonth[key]++;
      }
    }
    const appointmentsByMonth = Object.entries(apptByMonth).map(([month, count]) => ({
      month,
      count,
    }));

    // By professional
    const professionalMap = {};
    for (const a of appointments) {
      if (a.status?.toUpperCase() === "COMPLETED") {
        const name = a.professional || "Não informado";
        professionalMap[name] = (professionalMap[name] ?? 0) + 1;
      }
    }
    const byProfessional = Object.entries(professionalMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // ── PROCEDURES ─────────────────────────────────────────
    const procedureMap = {};
    for (const e of evolutions) {
      if (e.procedure) {
        procedureMap[e.procedure] = (procedureMap[e.procedure] ?? 0) + 1;
      }
    }
    // Also count from appointments
    for (const a of appointments) {
      if (a.status?.toUpperCase() === "COMPLETED" && a.procedureType) {
        procedureMap[a.procedureType] = (procedureMap[a.procedureType] ?? 0) + 1;
      }
    }
    const topProcedures = Object.entries(procedureMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    // ── PATIENTS ───────────────────────────────────────────
    const newPatients = patients.length;
    const patientsByMonth = buildMonthlyMap(fromDate, toDate);
    for (const p of patients) {
      const key = monthKey(p.createdAt);
      if (patientsByMonth[key] !== undefined) patientsByMonth[key]++;
    }
    const newPatientsByMonth = Object.entries(patientsByMonth).map(([month, count]) => ({
      month,
      count,
    }));

    const [totalPatients, totalActiveClub] = await Promise.all([
      prisma.patient.count({ where: { userId, isActive: true } }),
      prisma.clubMember.count({ where: { userId, status: "ativo" } }),
    ]);

    res.json({
      period: { from: fromDate, to: toDate },
      financial: {
        totalRevenue,
        totalExpenses,
        netProfit,
        avgTicket,
        revenueChartData,
        byPaymentMethod,
      },
      appointments: {
        total: totalAppointments,
        byStatus,
        completionRate,
        cancellationRate,
        byWeekday,
        byMonth: appointmentsByMonth,
        byProfessional,
      },
      procedures: { top: topProcedures },
      patients: {
        newInPeriod: newPatients,
        totalActive: totalPatients,
        totalActiveClub,
        byMonth: newPatientsByMonth,
      },
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

function monthKey(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function buildMonthlyMap(from, to) {
  const map = {};
  const cursor = new Date(from.getFullYear(), from.getMonth(), 1);
  const end = new Date(to.getFullYear(), to.getMonth(), 1);
  while (cursor <= end) {
    map[`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`] = 0;
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return map;
}

export default router;
