import { Router } from "express";
import { prisma } from "../../config/prisma.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";

const router = Router();
router.use(authMiddleware);

router.get("/stats", async (req, res) => {
  try {
    const userId = req.user.id;

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
    const weekEnd = new Date(todayStart.getTime() + 7 * 24 * 60 * 60 * 1000);
    const currentMonth = now.getMonth() + 1;

    const weekStart = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalPatients,
      todayAppointmentsCount,
      weekAppointmentsCount,
      totalProcedures,
      todaySchedule,
      nextAppointments,
      allBirthdays,
      pastWeekAppointments,
      todayRevenueTransactions,
    ] = await Promise.all([
      prisma.patient.count({ where: { userId, isActive: true } }),
      prisma.appointment.count({
        where: { userId, startsAt: { gte: todayStart, lt: todayEnd } },
      }),
      prisma.appointment.count({
        where: { userId, startsAt: { gte: todayStart, lt: weekEnd } },
      }),
      prisma.procedure.count({ where: { userId, isActive: true } }),
      prisma.appointment.findMany({
        where: { userId, startsAt: { gte: todayStart, lt: todayEnd } },
        include: { patient: { select: { name: true } } },
        orderBy: { startsAt: "asc" },
      }),
      prisma.appointment.findMany({
        where: { userId, startsAt: { gte: now } },
        include: { patient: { select: { name: true } } },
        orderBy: { startsAt: "asc" },
        take: 5,
      }),
      prisma.patient.findMany({
        where: { userId, isActive: true, birthDate: { not: null } },
        select: { id: true, name: true, birthDate: true },
      }),
      // últimos 7 dias corridos, para calcular taxa de presença real (concluído vs cancelado)
      prisma.appointment.findMany({
        where: { userId, startsAt: { gte: weekStart, lt: todayStart }, status: { in: ["FINISHED", "CANCELED"] } },
        select: { status: true },
      }),
      prisma.transaction.findMany({
        where: {
          userId,
          type: "receita",
          status: { in: ["pago", "confirmado"] },
          paidAt: { gte: todayStart, lt: todayEnd },
        },
        select: { amount: true, feeAmount: true, netAmount: true },
      }),
    ]);

    const attendedCount = pastWeekAppointments.filter((a) => a.status === "FINISHED").length;
    const attendanceRate = pastWeekAppointments.length > 0
      ? Math.round((attendedCount / pastWeekAppointments.length) * 100)
      : null;

    const todayRevenue = todayRevenueTransactions.reduce(
      (sum, t) => sum + (t.feeAmount != null && t.netAmount != null ? t.netAmount : t.amount),
      0
    );

    const birthdaysThisMonth = allBirthdays
      .filter((p) => new Date(p.birthDate).getMonth() + 1 === currentMonth)
      .map((p) => ({
        id: p.id,
        name: p.name,
        day: new Date(p.birthDate).getDate(),
        isToday: new Date(p.birthDate).getDate() === now.getDate(),
      }))
      .sort((a, b) => a.day - b.day);

    return res.json({
      totalPatients,
      todayAppointments: todayAppointmentsCount,
      weekAppointments: weekAppointmentsCount,
      totalProcedures,
      todaySchedule,
      nextAppointments,
      birthdaysThisMonth,
      attendanceRate,
      todayRevenue,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
