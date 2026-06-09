import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { prisma } from "../../config/prisma.js";

const router = Router();
router.use(authMiddleware);

function requireAdmin(req, res, next) {
  if (req.user.role !== "ADMIN") return res.status(403).json({ error: "Acesso negado." });
  next();
}
router.use(requireAdmin);

// ── lista todas as clínicas ────────────────────────────────────────────────────
router.get("/clinics", async (req, res) => {
  try {
    const clinics = await prisma.user.findMany({
      where: { role: "PROFESSIONAL" },
      select: {
        id: true, name: true, email: true, plan: true, featureOverrides: true,
        createdAt: true, authProvider: true,
        _count: { select: { patients: true, appointments: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(clinics);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ── atualiza plano / dados de uma clínica ─────────────────────────────────────
router.patch("/clinics/:id", async (req, res) => {
  try {
    const { plan, name, featureOverrides } = req.body;
    const data = {};
    if (plan !== undefined) data.plan = plan;
    if (name !== undefined) data.name = name;
    if (featureOverrides !== undefined) data.featureOverrides = featureOverrides;
    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data,
      select: { id: true, name: true, email: true, plan: true, featureOverrides: true },
    });
    res.json(updated);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ── stats gerais ──────────────────────────────────────────────────────────────
router.get("/stats", async (req, res) => {
  try {
    const [total, byPlan] = await Promise.all([
      prisma.user.count({ where: { role: "PROFESSIONAL" } }),
      prisma.user.groupBy({
        by: ["plan"],
        where: { role: "PROFESSIONAL" },
        _count: { _all: true },
      }),
    ]);
    res.json({ total, byPlan });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

export default router;
