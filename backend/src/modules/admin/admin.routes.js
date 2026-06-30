import { Router } from "express";
import bcrypt from "bcryptjs";
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

// ── cria uma nova clínica (onboarding manual pelo admin) ──────────────────────
router.post("/clinics", async (req, res) => {
  try {
    const { name, email, password, plan, clinicName } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: "Nome, e-mail e senha são obrigatórios." });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "A senha deve ter ao menos 6 caracteres." });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      return res.status(409).json({ error: "Já existe uma conta com este e-mail." });
    }

    const passwordHash = await bcrypt.hash(password, 8);

    const clinic = await prisma.user.create({
      data: {
        name,
        email: normalizedEmail,
        password: passwordHash,
        plan: plan || "solo",
        clinicName: clinicName || null,
        role: "PROFESSIONAL",
        mustChangePassword: true,
      },
      select: { id: true, name: true, email: true, plan: true, createdAt: true },
    });

    res.status(201).json(clinic);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
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

// ── TEAM (admin users) ────────────────────────────────────────────────────────
router.get("/team", async (req, res) => {
  try {
    const team = await prisma.user.findMany({
      where: { role: "ADMIN" },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    });
    res.json(team);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ── TASKS ─────────────────────────────────────────────────────────────────────
router.get("/tasks", async (req, res) => {
  try {
    const { area, status, priority } = req.query;
    const where = {};
    if (area)     where.area     = area;
    if (status)   where.status   = status;
    if (priority) where.priority = priority;
    const tasks = await prisma.adminTask.findMany({
      where,
      include: { comments: { orderBy: { createdAt: "asc" } } },
      orderBy: { createdAt: "desc" },
    });
    res.json(tasks);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.get("/tasks/:id", async (req, res) => {
  try {
    const task = await prisma.adminTask.findUnique({
      where: { id: req.params.id },
      include: { comments: { orderBy: { createdAt: "asc" } } },
    });
    if (!task) return res.status(404).json({ error: "Task não encontrada." });
    res.json(task);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.post("/tasks", async (req, res) => {
  try {
    const { title, description, priority, status, area, clinicId, dueDate, reminderAt, assignees } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: "Título obrigatório." });
    const task = await prisma.adminTask.create({
      data: {
        title, description, priority, status, area, clinicId,
        dueDate:    dueDate    ? new Date(dueDate)    : null,
        reminderAt: reminderAt ? new Date(reminderAt) : null,
        assignees:  assignees  ?? [],
      },
      include: { comments: true },
    });
    res.status(201).json(task);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.patch("/tasks/:id", async (req, res) => {
  try {
    const fields = ["title","description","priority","status","area","clinicId","assignees"];
    const data = {};
    fields.forEach((f) => { if (req.body[f] !== undefined) data[f] = req.body[f]; });
    if (req.body.dueDate    !== undefined) data.dueDate    = req.body.dueDate    ? new Date(req.body.dueDate)    : null;
    if (req.body.reminderAt !== undefined) data.reminderAt = req.body.reminderAt ? new Date(req.body.reminderAt) : null;
    const task = await prisma.adminTask.update({
      where: { id: req.params.id },
      data,
      include: { comments: { orderBy: { createdAt: "asc" } } },
    });
    res.json(task);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.delete("/tasks/:id", async (req, res) => {
  try {
    await prisma.adminTask.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ── TASK COMMENTS ──────────────────────────────────────────────────────────────
router.post("/tasks/:id/comments", async (req, res) => {
  try {
    const { content, author, type } = req.body;
    if (!content?.trim() || !author?.trim()) return res.status(400).json({ error: "content e author obrigatórios." });
    const comment = await prisma.adminTaskComment.create({
      data: { taskId: req.params.id, content, author, type: type ?? "comment" },
    });

    // Detect @mentions and create notifications
    if ((type ?? "comment") === "comment") {
      const mentions = [...content.matchAll(/@([\wÀ-ÿ][^\s@]*(?:\s[\wÀ-ÿ][^\s@]*)?)/g)].map((m) => m[1].trim());
      if (mentions.length > 0) {
        const task = await prisma.adminTask.findUnique({ where: { id: req.params.id }, select: { title: true } });
        const team = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true, name: true } });
        for (const mention of mentions) {
          const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
          const match = team.find((u) => norm(u.name).startsWith(norm(mention)) && norm(u.name) !== norm(author));
          if (match) {
            await prisma.adminNotification.create({
              data: {
                userId:    match.id,
                taskId:    req.params.id,
                taskTitle: task?.title,
                content:   `${author} mencionou você em "${task?.title}"`,
                author,
              },
            });
          }
        }
      }
    }

    res.status(201).json(comment);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.delete("/tasks/:taskId/comments/:commentId", async (req, res) => {
  try {
    await prisma.adminTaskComment.delete({ where: { id: req.params.commentId } });
    res.json({ ok: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ── NOTIFICATIONS ─────────────────────────────────────────────────────────────
router.get("/notifications", async (req, res) => {
  try {
    const notifs = await prisma.adminNotification.findMany({
      where:   { userId: req.user.id },
      orderBy: { createdAt: "desc" },
      take:    50,
    });
    res.json(notifs);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.patch("/notifications/read-all", async (req, res) => {
  try {
    await prisma.adminNotification.updateMany({ where: { userId: req.user.id, read: false }, data: { read: true } });
    res.json({ ok: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.patch("/notifications/:id/read", async (req, res) => {
  try {
    const n = await prisma.adminNotification.update({ where: { id: req.params.id }, data: { read: true } });
    res.json(n);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ── LEADS / COMERCIAL ─────────────────────────────────────────────────────────
router.get("/leads", async (req, res) => {
  try {
    const leads = await prisma.lead.findMany({ orderBy: { createdAt: "desc" } });
    res.json(leads);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.post("/leads", async (req, res) => {
  try {
    const { name, email, phone, clinicName, source, status, value, notes, nextFollowUp } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: "Nome obrigatório." });
    const lead = await prisma.lead.create({
      data: { name, email, phone, clinicName, source, status, value: value ? Number(value) : null,
              notes, nextFollowUp: nextFollowUp ? new Date(nextFollowUp) : null },
    });
    res.status(201).json(lead);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.patch("/leads/:id", async (req, res) => {
  try {
    const fields = ["name","email","phone","clinicName","source","status","value","notes","nextFollowUp"];
    const data = {};
    fields.forEach((f) => { if (req.body[f] !== undefined) data[f] = req.body[f]; });
    if (data.value) data.value = Number(data.value);
    if (data.nextFollowUp) data.nextFollowUp = new Date(data.nextFollowUp);
    const lead = await prisma.lead.update({ where: { id: req.params.id }, data });
    res.json(lead);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.delete("/leads/:id", async (req, res) => {
  try {
    await prisma.lead.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ── FINANCEIRO ────────────────────────────────────────────────────────────────
const PLAN_MRR = { solo: 97,   clinica: 197,   enterprise: 497,   dev: 0 };
const PLAN_ARR = { solo: 970,  clinica: 1970,  enterprise: 4970,  dev: 0 }; // valor contratado anual

router.get("/financial", async (req, res) => {
  try {
    const [allClinics, newThisMonth, newLastMonth, churnedThisMonth] = await Promise.all([
      prisma.user.findMany({
        where: { role: "PROFESSIONAL" },
        select: { plan: true, billingCycle: true },
      }),
      prisma.user.count({
        where: { role: "PROFESSIONAL", createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) } },
      }),
      prisma.user.count({
        where: { role: "PROFESSIONAL", createdAt: {
          gte: new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1),
          lt:  new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        }},
      }),
      prisma.user.count({
        where: {
          role: "PROFESSIONAL",
          createdAt: { lt: new Date(Date.now() - 60 * 86400000) },
          appointments: { none: { createdAt: { gte: new Date(Date.now() - 30 * 86400000) } } },
        },
      }),
    ]);

    // MRR: apenas clínicas mensais (valor mensal confirmado)
    const mrr = allClinics
      .filter((c) => c.billingCycle !== "anual")
      .reduce((sum, c) => sum + (PLAN_MRR[c.plan] ?? 0), 0);

    // ARR: apenas clínicas anuais (valor anual contratado/comprovado)
    const arr = allClinics
      .filter((c) => c.billingCycle === "anual")
      .reduce((sum, c) => sum + (PLAN_ARR[c.plan] ?? 0), 0);

    // mrrProjected: projeção de todos os mensais × 12 (separado, para referência)
    const mrrProjected = mrr * 12;

    // Breakdown por plano
    const planMap = {};
    allClinics.forEach((c) => {
      if (!planMap[c.plan]) planMap[c.plan] = { plan: c.plan, count: 0, mensal: 0, anual: 0, mrr: 0, arr: 0 };
      planMap[c.plan].count++;
      if (c.billingCycle === "anual") {
        planMap[c.plan].anual++;
        planMap[c.plan].arr += PLAN_ARR[c.plan] ?? 0;
      } else {
        planMap[c.plan].mensal++;
        planMap[c.plan].mrr += PLAN_MRR[c.plan] ?? 0;
      }
    });
    const planBreakdown = Object.values(planMap);

    // Growth last 6 months
    const growth = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(); d.setMonth(d.getMonth() - i);
      const count = await prisma.user.count({
        where: { role: "PROFESSIONAL", createdAt: { lte: new Date(d.getFullYear(), d.getMonth() + 1, 0) } },
      });
      growth.push({ month: d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }), count });
    }

    res.json({ mrr, arr, mrrProjected, newThisMonth, newLastMonth, churnedThisMonth, planBreakdown, growth });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ── BILLING (faturamento esperado por cliente) ────────────────────────────────
const PLAN_MRR_VAL = { solo: 97,  clinica: 197,  enterprise: 497,  dev: 0 };
const PLAN_ARR_VAL = { solo: 970, clinica: 1970, enterprise: 4970, dev: 0 };

router.patch("/financial/billing/:id/cycle", async (req, res) => {
  try {
    const { billingCycle } = req.body;
    if (!["mensal","anual"].includes(billingCycle))
      return res.status(400).json({ error: "billingCycle deve ser 'mensal' ou 'anual'." });
    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data: { billingCycle },
      select: { id: true, billingCycle: true },
    });
    res.json(updated);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.get("/financial/billing", async (req, res) => {
  try {
    const clinics = await prisma.user.findMany({
      where: { role: "PROFESSIONAL" },
      select: {
        id: true, name: true, clinicName: true, email: true,
        plan: true, billingCycle: true, createdAt: true,
        cardBrand: true, cardLast4: true, cardHolderName: true, cardExpiry: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // For each clinic, check if there's already a confirmed receita this month
    const now  = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    const to   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const paidThisMonth = await prisma.adminFinancialEntry.findMany({
      where: {
        type:      "receita",
        status:    "aprovado",
        clinicId:  { in: clinics.map((c) => c.id) },
        createdAt: { gte: from, lte: to },
      },
      select: { clinicId: true, amount: true, paidAt: true, paymentMethod: true, createdAt: true },
    });

    const paidMap = {};
    paidThisMonth.forEach((p) => { paidMap[p.clinicId] = p; });

    const result = clinics.map((c) => {
      const display  = c.clinicName || c.name;
      const isAnual  = c.billingCycle === "anual";
      const expected = isAnual ? (PLAN_ARR_VAL[c.plan] ?? 0) : (PLAN_MRR_VAL[c.plan] ?? 0);
      const paid     = paidMap[c.id] ?? null;
      const method   = c.cardBrand && c.cardLast4
        ? `${c.cardBrand} ****${c.cardLast4}`
        : null;

      return {
        id: c.id, name: display, email: c.email,
        plan: c.plan, billingCycle: c.billingCycle ?? "mensal", expected, paid,
        paymentMethod: method,
        cardHolderName: c.cardHolderName,
        cardExpiry: c.cardExpiry,
        since: c.createdAt,
        status: expected === 0 ? "isento" : paid ? "pago" : "pendente",
      };
    });

    res.json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ── FINANCIAL ENTRIES ─────────────────────────────────────────────────────────
// Helper: gera lançamentos recorrentes pendentes para o período atual
async function processRecurrence() {
  const now     = new Date();
  const templates = await prisma.adminFinancialEntry.findMany({
    where: {
      recorrente: true,
      OR: [
        { recorrenciaFim: null },
        { recorrenciaFim: { gte: now } },
      ],
    },
  });

  const created = [];
  for (const t of templates) {
    // Determine the window for "this period"
    let windowStart, windowEnd;
    const freq = t.recorrencia ?? "mensal";
    if (freq === "mensal") {
      windowStart = new Date(now.getFullYear(), now.getMonth(), 1);
      windowEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    } else if (freq === "quinzenal") {
      const day = now.getDate();
      if (day <= 15) {
        windowStart = new Date(now.getFullYear(), now.getMonth(), 1);
        windowEnd   = new Date(now.getFullYear(), now.getMonth(), 15, 23, 59, 59);
      } else {
        windowStart = new Date(now.getFullYear(), now.getMonth(), 16);
        windowEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      }
    } else if (freq === "semanal") {
      const day   = now.getDay();
      const start = new Date(now); start.setDate(now.getDate() - day); start.setHours(0,0,0,0);
      const end   = new Date(start); end.setDate(start.getDate() + 6); end.setHours(23,59,59,999);
      windowStart = start; windowEnd = end;
    } else if (freq === "anual") {
      windowStart = new Date(now.getFullYear(), 0, 1);
      windowEnd   = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
    } else {
      windowStart = new Date(now.getFullYear(), now.getMonth(), 1);
      windowEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    }

    // Only create if the template was created before this window
    if (new Date(t.createdAt) >= windowStart) continue;

    // Check if already generated for this period
    const existing = await prisma.adminFinancialEntry.findFirst({
      where: {
        recorrenciaRef: t.id,
        createdAt: { gte: windowStart, lte: windowEnd },
      },
    });
    if (existing) continue;

    const entry = await prisma.adminFinancialEntry.create({
      data: {
        type:          t.type,
        description:   t.description,
        amount:        t.amount,
        category:      t.category,
        notes:         t.notes,
        clinicId:      t.clinicId,
        clinicName:    t.clinicName,
        planType:      t.planType,
        paymentMethod: t.paymentMethod,
        createdBy:     t.createdBy,
        recorrenciaRef: t.id,
        status:        "pendente",
      },
    });
    created.push(entry);
  }
  return created;
}

router.get("/financial/entries", async (req, res) => {
  try {
    // Auto-generate recurrent entries for current period
    await processRecurrence();

    const { type, status, month } = req.query;
    const where = { recorrenciaRef: null, recorrente: false }; // only leaf entries + non-template
    // Actually show all non-template entries
    const whereAll = {};
    if (type)   whereAll.type   = type;
    if (status) whereAll.status = status;
    if (month) {
      const [y, m] = month.split("-").map(Number);
      whereAll.createdAt = { gte: new Date(y, m - 1, 1), lt: new Date(y, m, 1) };
    }
    // Exclude templates (recorrente=true) from the main list — they show in a separate section
    whereAll.recorrente = false;
    const entries = await prisma.adminFinancialEntry.findMany({
      where: whereAll, orderBy: { createdAt: "desc" },
    });
    res.json(entries);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.get("/financial/recorrentes", async (req, res) => {
  try {
    const templates = await prisma.adminFinancialEntry.findMany({
      where: { recorrente: true },
      orderBy: { createdAt: "desc" },
    });
    res.json(templates);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.post("/financial/entries", async (req, res) => {
  try {
    const { type, description, amount, category, dueDate, notes,
            clinicId, clinicName, planType, paymentMethod, status,
            recorrente, recorrencia, recorrenciaFim } = req.body;
    if (!description?.trim()) return res.status(400).json({ error: "Descrição obrigatória." });
    if (!amount || isNaN(amount)) return res.status(400).json({ error: "Valor inválido." });
    const entry = await prisma.adminFinancialEntry.create({
      data: {
        type:          type ?? "despesa",
        description,
        amount:        Number(amount),
        category,
        notes,
        clinicId,
        clinicName,
        planType,
        paymentMethod,
        recorrente:     !!recorrente,
        recorrencia:    recorrente ? (recorrencia ?? "mensal") : null,
        recorrenciaFim: recorrente && recorrenciaFim ? new Date(recorrenciaFim) : null,
        dueDate:        dueDate ? new Date(dueDate) : null,
        createdBy:      req.user.name ?? "Admin",
        // Recurring templates are always "aprovado" — the generated copies start as "pendente"
        status:         recorrente ? "aprovado" : (status ?? "pendente"),
        approvedBy:     (status === "aprovado" || recorrente) ? (req.user.name ?? "Admin") : null,
        approvedAt:     (status === "aprovado" || recorrente) ? new Date() : null,
        paidAt:         status === "aprovado" ? new Date() : null,
      },
    });
    res.status(201).json(entry);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.patch("/financial/entries/:id", async (req, res) => {
  try {
    const { status, description, amount, category, dueDate, paidAt, notes } = req.body;
    const data = {};
    if (description !== undefined) data.description = description;
    if (amount      !== undefined) data.amount      = Number(amount);
    if (category    !== undefined) data.category    = category;
    if (notes       !== undefined) data.notes       = notes;
    if (dueDate     !== undefined) data.dueDate     = dueDate ? new Date(dueDate) : null;
    if (paidAt      !== undefined) data.paidAt      = paidAt  ? new Date(paidAt)  : null;
    if (status !== undefined) {
      data.status = status;
      if (status === "aprovado") {
        data.approvedBy = req.user.name ?? "Admin";
        data.approvedAt = new Date();
      } else if (status === "rejeitado") {
        data.approvedBy = req.user.name ?? "Admin";
        data.approvedAt = new Date();
      } else if (status === "pendente") {
        data.approvedBy = null;
        data.approvedAt = null;
      }
    }
    const entry = await prisma.adminFinancialEntry.update({
      where: { id: req.params.id }, data,
    });
    res.json(entry);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.delete("/financial/entries/:id", async (req, res) => {
  try {
    await prisma.adminFinancialEntry.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ── CUSTOMER SUCCESS ──────────────────────────────────────────────────────────
router.get("/cs", async (req, res) => {
  try {
    const clinics = await prisma.user.findMany({
      where: { role: "PROFESSIONAL" },
      select: {
        id: true, name: true, email: true, plan: true, createdAt: true, canceledAt: true,
        lastLoginAt: true, loginCount: true,
        _count: { select: { patients: true, appointments: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const now      = Date.now();
    const day      = 86400000;
    const ago30    = new Date(now - 30 * day);
    const ago60    = new Date(now - 60 * day);

    const enriched = await Promise.all(clinics.map(async (c) => {
      const daysSinceCreate = Math.floor((now - new Date(c.createdAt)) / day);

      // < 7 days: completely new, excluded from scoring
      if (daysSinceCreate < 7) {
        const notes = await prisma.csNote.findMany({ where: { clinicId: c.id }, orderBy: { createdAt: "desc" }, take: 5 });
        return { ...c, lastActivityAt: c.createdAt, score: null, riskLevel: "novo", scoreBreakdown: [], notes };
      }

      const [lastAppt, aptsLast30, aptsLast60, lastPatient, notes] = await Promise.all([
        prisma.appointment.findFirst({ where: { userId: c.id }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
        prisma.appointment.count({ where: { userId: c.id, createdAt: { gte: ago30 } } }),
        prisma.appointment.count({ where: { userId: c.id, createdAt: { gte: ago60 } } }),
        prisma.patient.findFirst({ where: { userId: c.id }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
        prisma.csNote.findMany({ where: { clinicId: c.id }, orderBy: { createdAt: "desc" }, take: 5 }),
      ]);

      const daysSinceLogin = c.lastLoginAt ? Math.floor((now - new Date(c.lastLoginAt)) / day) : 999;
      const breakdown = [];
      let score = 100;

      if (daysSinceCreate <= 30) {
        // ── FASE: Early (7–30 dias) ───────────────────────────────────────────
        // Começa em 60 (neutro/atenção) e sobe com atividade
        score = 60;
        if (c._count.patients >= 1)     { score += 15; breakdown.push({ label: "Tem pacientes cadastrados",   pts: +15 }); }
        if (c._count.appointments >= 1) { score += 15; breakdown.push({ label: "Fez agendamentos",            pts: +15 }); }
        if (daysSinceLogin <= 7)        { score += 10; breakdown.push({ label: "Login recente (< 7 dias)",    pts: +10 }); }
      } else {
        // ── FASE: Estabelecida (> 30 dias) ────────────────────────────────────
        if (aptsLast30 === 0)           { score -= 40; breakdown.push({ label: "0 agendamentos em 30 dias",   pts: -40 }); }
        else if (aptsLast30 < 3)        { score -= 20; breakdown.push({ label: "< 3 agendamentos em 30 dias", pts: -20 }); }
        if (aptsLast60 === 0)           { score -= 10; breakdown.push({ label: "0 agendamentos em 60 dias",   pts: -10 }); }
        if (daysSinceLogin > 30)        { score -= 30; breakdown.push({ label: "Sem login há > 30 dias",      pts: -30 }); }
        else if (daysSinceLogin > 14)   { score -= 15; breakdown.push({ label: "Sem login há > 14 dias",      pts: -15 }); }
      }

      score = Math.max(0, Math.min(100, score));
      const riskLevel = score >= 80 ? "saudavel" : score >= 60 ? "regular" : score >= 40 ? "atencao" : "risco";

      return {
        ...c, score, riskLevel, scoreBreakdown: breakdown, notes,
        aptsLast30, aptsLast60, daysSinceLogin,
        lastActivityAt: lastAppt?.createdAt ?? lastPatient?.createdAt ?? c.createdAt,
      };
    }));

    res.json(enriched);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ── CS NOTES ──────────────────────────────────────────────────────────────────
router.post("/cs/notes", async (req, res) => {
  try {
    const { clinicId, content, type } = req.body;
    if (!clinicId || !content?.trim()) return res.status(400).json({ error: "clinicId e content obrigatórios." });
    const note = await prisma.csNote.create({ data: { clinicId, content, type } });
    res.status(201).json(note);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.delete("/cs/notes/:id", async (req, res) => {
  try {
    await prisma.csNote.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ── CLINIC CANCEL / REACTIVATE ────────────────────────────────────────────────
router.patch("/cs/clinics/:id/cancel", async (req, res) => {
  try {
    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data:  { canceledAt: new Date() },
      select: { id: true, canceledAt: true },
    });
    res.json(updated);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.patch("/cs/clinics/:id/reactivate", async (req, res) => {
  try {
    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data:  { canceledAt: null },
      select: { id: true, canceledAt: true },
    });
    res.json(updated);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ── FINANCIAL ESTIMATES (Planejamento Financeiro) ────────────────────────────
router.get("/financial/estimates", async (req, res) => {
  try {
    const estimates = await prisma.financialEstimate.findMany({
      orderBy: { createdAt: "desc" },
    });
    res.json(estimates);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.post("/financial/estimates", async (req, res) => {
  try {
    const { title, premissas } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: "Título obrigatório." });
    if (!premissas || typeof premissas !== "object") return res.status(400).json({ error: "Premissas inválidas." });
    const estimate = await prisma.financialEstimate.create({
      data: { title: title.trim(), author: req.user.name ?? "Admin", premissas },
    });
    res.status(201).json(estimate);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.delete("/financial/estimates/:id", async (req, res) => {
  try {
    await prisma.financialEstimate.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ── PREMISSAS OFICIAIS (compartilhadas entre todos os sócios) ─────────────────
const PREMISSAS_KEY = "planejamento_premissas";

router.get("/financial/premissas", async (req, res) => {
  try {
    const row = await prisma.adminSetting.findUnique({ where: { key: PREMISSAS_KEY } });
    res.json({
      premissas: row?.value ?? null,
      updatedBy: row?.updatedBy ?? null,
      updatedAt: row?.updatedAt ?? null,
    });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.put("/financial/premissas", async (req, res) => {
  try {
    const { premissas } = req.body;
    if (!premissas || typeof premissas !== "object") {
      return res.status(400).json({ error: "Premissas inválidas." });
    }
    const updatedBy = req.user?.name ?? "Admin";
    const row = await prisma.adminSetting.upsert({
      where:  { key: PREMISSAS_KEY },
      update: { value: premissas, updatedBy },
      create: { key: PREMISSAS_KEY, value: premissas, updatedBy },
    });
    res.json({ premissas: row.value, updatedBy: row.updatedBy, updatedAt: row.updatedAt });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

export default router;
