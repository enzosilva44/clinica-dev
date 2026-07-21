import { Router } from "express";
import bcrypt from "bcryptjs";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { prisma } from "../../config/prisma.js";
import { getMetrics, getCost, getBackups, INFRA_IDS } from "../../providers/infra/aws.infra.js";

const router = Router();
router.use(authMiddleware);

// Único usuário autorizado a excluir clínicas (proprietário da conta).
const OWNER_EMAIL = "enzo.silva@codebit.com.br";
function isOwner(user) {
  return user?.email?.toLowerCase() === OWNER_EMAIL;
}

// Clínicas isentas de pagamento (nunca entram no MRR/cobrança).
const EXEMPT_EMAILS = [
  "eurianebiomedica@gmail.com",
  "dra.fernandabecari@gmail.com",
];
function isExempt(email) {
  return EXEMPT_EMAILS.includes((email ?? "").toLowerCase());
}

// Registra uma ação de admin na auditoria (best-effort, nunca quebra a request)
async function audit(req, { action, targetType, targetId, targetName, detail }) {
  try {
    let actorName = null;
    try {
      const actor = await prisma.user.findUnique({ where: { id: req.user.id }, select: { name: true } });
      actorName = actor?.name ?? null;
    } catch { /* ignore */ }
    await prisma.adminAuditLog.create({
      data: { actorId: req.user.id, actorName, action, targetType, targetId, targetName, detail },
    });
  } catch { /* auditoria não deve interromper a operação */ }
}

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
    if (plan !== undefined) {
      await audit(req, { action: "clinic.plan", targetType: "clinic", targetId: updated.id, targetName: updated.name, detail: { plan } });
    }
    if (featureOverrides !== undefined) {
      await audit(req, { action: "clinic.features", targetType: "clinic", targetId: updated.id, targetName: updated.name, detail: { featureOverrides } });
    }
    res.json(updated);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ── exclui uma clínica (apenas o proprietário) ────────────────────────────────
router.delete("/clinics/:id", async (req, res) => {
  try {
    // Confirma que o admin autenticado é o proprietário (email não vem no JWT).
    const actor = await prisma.user.findUnique({
      where: { id: req.user.id }, select: { email: true },
    });
    if (!isOwner(actor)) {
      return res.status(403).json({ error: "Apenas o proprietário pode excluir clínicas." });
    }

    const userId = req.params.id;
    const target = await prisma.user.findUnique({
      where: { id: userId }, select: { id: true, role: true, name: true, email: true },
    });
    if (!target) return res.status(404).json({ error: "Clínica não encontrada." });
    if (target.role !== "PROFESSIONAL") {
      return res.status(400).json({ error: "Só é possível excluir contas de clínica." });
    }

    // Remove todas as relações diretas da clínica; filhos com onDelete:Cascade
    // (BudgetItem, ProtocolSession, etc.) são removidos automaticamente.
    await prisma.$transaction([
      prisma.automationLog.deleteMany({ where: { userId } }),
      prisma.automationTemplate.deleteMany({ where: { userId } }),
      prisma.productMovement.deleteMany({ where: { userId } }),
      prisma.stockRequest.deleteMany({ where: { userId } }),
      prisma.transaction.deleteMany({ where: { userId } }),
      prisma.clubMember.deleteMany({ where: { userId } }),
      prisma.clubPlan.deleteMany({ where: { userId } }),
      prisma.portfolioCase.deleteMany({ where: { userId } }),
      prisma.anamnesisResponse.deleteMany({ where: { userId } }),
      prisma.anamnesisTemplate.deleteMany({ where: { userId } }),
      prisma.documentVersion.deleteMany({ where: { createdBy: userId } }),
      prisma.document.deleteMany({ where: { userId } }),
      prisma.documentFolder.deleteMany({ where: { userId } }),
      prisma.patientDocument.deleteMany({ where: { userId } }),
      prisma.patientPhoto.deleteMany({ where: { userId } }),
      prisma.evolution.deleteMany({ where: { createdById: userId } }),
      prisma.procedureMap.deleteMany({ where: { userId } }),
      prisma.budget.deleteMany({ where: { userId } }),
      prisma.protocol.deleteMany({ where: { userId } }),
      prisma.appointment.deleteMany({ where: { userId } }),
      // ProcedureProduct referencia Procedure e Product sem cascade → apagar antes
      prisma.procedureProduct.deleteMany({ where: { procedure: { userId } } }),
      prisma.procedure.deleteMany({ where: { userId } }),
      prisma.product.deleteMany({ where: { userId } }),
      prisma.cardFee.deleteMany({ where: { userId } }),
      prisma.patient.deleteMany({ where: { userId } }),
      prisma.user.delete({ where: { id: userId } }),
    ]);

    await audit(req, { action: "clinic.delete", targetType: "clinic", targetId: userId, targetName: target.name, detail: { email: target.email } });
    res.json({ ok: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ── AUDITORIA (logs de ações do admin) ────────────────────────────────────────
router.get("/audit", async (req, res) => {
  try {
    const { action, take } = req.query;
    const where = {};
    if (action) where.action = action;
    const logs = await prisma.adminAuditLog.findMany({
      where, orderBy: { createdAt: "desc" }, take: Math.min(Number(take) || 100, 300),
    });
    res.json(logs);
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

// ── SAÚDE DO SISTEMA (Tecnologia) ─────────────────────────────────────────────
router.get("/health", async (req, res) => {
  const checks = {};

  // Banco: SELECT 1 com latência + contagem de registros
  try {
    const t0 = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const latencyMs = Date.now() - t0;
    checks.database = {
      status: latencyMs > 800 ? "comprometido" : "up",
      latencyMs,
    };
  } catch (e) {
    checks.database = { status: "down", error: e.message };
  }

  // Contagens rápidas (indicam que as tabelas respondem)
  try {
    const [clinics, tasks, leads] = await Promise.all([
      prisma.user.count({ where: { role: "PROFESSIONAL" } }),
      prisma.adminTask.count(),
      prisma.lead.count(),
    ]);
    checks.counts = { clinics, tasks, leads };
  } catch { checks.counts = null; }

  const mem = process.memoryUsage();
  checks.server = {
    status: "up",
    uptimeSec: Math.round(process.uptime()),
    nodeVersion: process.version,
    memoryMB: Math.round(mem.rss / 1024 / 1024),
    heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
    env: process.env.NODE_ENV ?? "development",
  };

  res.json({ checkedAt: new Date().toISOString(), ...checks });
});

// ── INFRAESTRUTURA (AWS: métricas EC2+RDS, custo, backups) ────────────────────
router.get("/infra/metrics", async (req, res) => {
  try {
    const data = await getMetrics();
    res.json(data);
  } catch (e) { res.status(502).json({ error: `Falha ao ler métricas AWS: ${e.message}`, ids: INFRA_IDS }); }
});

router.get("/infra/cost", async (req, res) => {
  try {
    const data = await getCost();
    res.json(data);
  } catch (e) { res.status(502).json({ error: `Falha ao ler custo AWS: ${e.message}` }); }
});

router.get("/infra/backups", async (req, res) => {
  try {
    const data = await getBackups(Number(req.query.days) || 3);
    res.json(data);
  } catch (e) { res.status(502).json({ error: `Falha ao ler backups AWS: ${e.message}` }); }
});

// ── DASHBOARD (visão geral por usuário) ───────────────────────────────────────
router.get("/dashboard", async (req, res) => {
  const now = Date.now();
  const day = 86400000;
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  // ── Saúde: servidor (respondeu = up) + banco (SELECT 1 com latência) ─────────
  let db = { status: "up", latencyMs: null };
  try {
    const t0 = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const latencyMs = Date.now() - t0;
    db = { status: latencyMs > 800 ? "comprometido" : "up", latencyMs };
  } catch {
    db = { status: "down", latencyMs: null };
  }
  const health = {
    server: { status: "up", uptimeSec: Math.round(process.uptime()) },
    database: db,
  };

  try {
    const [me, clinics, leads, myTasks] = await Promise.all([
      prisma.user.findUnique({ where: { id: req.user.id }, select: { id: true, name: true } }),
      prisma.user.findMany({
        where: { role: "PROFESSIONAL" },
        select: {
          id: true, name: true, email: true, plan: true, billingCycle: true,
          createdAt: true, canceledAt: true, lastLoginAt: true,
          _count: { select: { patients: true, appointments: true } },
        },
      }),
      prisma.lead.findMany({ select: { status: true, value: true, createdAt: true } }),
      prisma.adminTask.findMany({
        where: { status: { not: "concluido" } },
        select: { id: true, number: true, title: true, priority: true, status: true, dueDate: true, assignees: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    // ── Financeiro ──────────────────────────────────────────────────────────
    const active = clinics.filter((c) => !c.canceledAt);
    const paying = active.filter((c) => !isExempt(c.email));
    const mrr = paying
      .filter((c) => c.billingCycle !== "anual")
      .reduce((s, c) => s + (PLAN_MRR[c.plan] ?? 0), 0);
    const arr = paying
      .filter((c) => c.billingCycle === "anual")
      .reduce((s, c) => s + (PLAN_ARR[c.plan] ?? 0), 0);
    const newThisMonth = clinics.filter((c) => new Date(c.createdAt) >= startOfMonth).length;
    const exemptCount  = active.filter((c) => isExempt(c.email)).length;

    // Caixa (receitas − despesas pagas/aprovadas registradas)
    const entries = await prisma.adminFinancialEntry.findMany({
      where: { recorrente: false }, select: { type: true, amount: true, status: true },
    });
    let receitas = 0, despesas = 0;
    entries.forEach((e) => {
      if (e.status === "rejeitado") return;
      if (e.type === "receita") receitas += e.amount ?? 0;
      else if (e.type === "despesa") despesas += e.amount ?? 0;
    });
    const financial = {
      mrr, arr, newThisMonth, exemptCount,
      activeClinics: active.length,
      caixa: receitas - despesas,
      receitas, despesas,
    };

    // ── Customer Success: score por clínica (top 5 / piores 5) ───────────────
    const scored = active.map((c) => {
      const daysSinceCreate = Math.floor((now - new Date(c.createdAt)) / day);
      const daysSinceLogin  = c.lastLoginAt ? Math.floor((now - new Date(c.lastLoginAt)) / day) : 999;
      if (daysSinceCreate < 7) return null; // muito nova, fora do score

      let score;
      if (daysSinceCreate <= 30) {
        score = 60;
        if (c._count.patients >= 1)     score += 15;
        if (c._count.appointments >= 1) score += 15;
        if (daysSinceLogin <= 7)        score += 10;
      } else {
        score = 100;
        if (daysSinceLogin > 30)      score -= 30;
        else if (daysSinceLogin > 14) score -= 15;
        if (c._count.appointments === 0) score -= 40;
      }
      score = Math.max(0, Math.min(100, score));
      return { id: c.id, name: c.name, plan: c.plan, score };
    }).filter(Boolean);

    const byScore = [...scored].sort((a, b) => b.score - a.score);
    const cs = {
      total: scored.length,
      avgScore: scored.length ? Math.round(scored.reduce((s, x) => s + x.score, 0) / scored.length) : null,
      atRisk: scored.filter((x) => x.score < 40).length,
      top5:    byScore.slice(0, 5),
      bottom5: byScore.slice(-5).reverse(),
    };

    // ── Comercial (leads) ────────────────────────────────────────────────────
    const byStatus = {};
    let pipelineValue = 0;
    leads.forEach((l) => {
      const st = l.status ?? "novo";
      byStatus[st] = (byStatus[st] ?? 0) + 1;
      if (st !== "ganho" && st !== "perdido") pipelineValue += l.value ?? 0;
    });
    const commercial = {
      total: leads.length,
      byStatus,
      pipelineValue,
      newThisMonth: leads.filter((l) => new Date(l.createdAt) >= startOfMonth).length,
    };

    // ── Minhas tasks (atribuídas ao usuário logado, mais antigas primeiro) ────
    const mine = myTasks.filter((t) => {
      const as = Array.isArray(t.assignees) ? t.assignees : [];
      return as.some((a) => a?.id === me?.id || a?.name === me?.name);
    }).map((t) => ({
      id: t.id, number: t.number, title: t.title, priority: t.priority,
      status: t.status, dueDate: t.dueDate, createdAt: t.createdAt,
      overdue: t.dueDate ? new Date(t.dueDate) < new Date() : false,
    }));

    res.json({
      user: me,
      health,
      financial,
      cs,
      commercial,
      myTasks: { total: mine.length, items: mine.slice(0, 6) },
    });
  } catch (e) {
    res.status(400).json({ error: e.message, health });
  }
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

// Sócios e proporção do rateio de despesas (conciliação de sociedade)
const SOCIOS = [
  { key: "enzo",      name: "Enzo",       share: 0.60 },
  { key: "euriane",   name: "Euriane",    share: 0.25 },
  { key: "gean",      name: "Gean",       share: 0.10 },
  { key: "anaflavia", name: "Ana Flávia", share: 0.05 },
];

router.get("/financial", async (req, res) => {
  try {
    const [allClinics, newThisMonth, newLastMonth, churnedThisMonth] = await Promise.all([
      prisma.user.findMany({
        where: { role: "PROFESSIONAL" },
        select: { plan: true, billingCycle: true, email: true },
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

    // Clínicas isentas não entram no MRR/ARR
    const billableClinics = allClinics.filter((c) => !isExempt(c.email));

    // MRR: apenas clínicas mensais (valor mensal confirmado)
    const mrr = billableClinics
      .filter((c) => c.billingCycle !== "anual")
      .reduce((sum, c) => sum + (PLAN_MRR[c.plan] ?? 0), 0);

    // ARR: apenas clínicas anuais (valor anual contratado/comprovado)
    const arr = billableClinics
      .filter((c) => c.billingCycle === "anual")
      .reduce((sum, c) => sum + (PLAN_ARR[c.plan] ?? 0), 0);

    // mrrProjected: projeção de todos os mensais × 12 (separado, para referência)
    const mrrProjected = mrr * 12;

    // Breakdown por plano
    const planMap = {};
    allClinics.forEach((c) => {
      if (!planMap[c.plan]) planMap[c.plan] = { plan: c.plan, count: 0, mensal: 0, anual: 0, mrr: 0, arr: 0 };
      planMap[c.plan].count++;
      const exempt = isExempt(c.email); // isentas contam, mas não somam receita
      if (c.billingCycle === "anual") {
        planMap[c.plan].anual++;
        if (!exempt) planMap[c.plan].arr += PLAN_ARR[c.plan] ?? 0;
      } else {
        planMap[c.plan].mensal++;
        if (!exempt) planMap[c.plan].mrr += PLAN_MRR[c.plan] ?? 0;
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
      const exempt   = isExempt(c.email);
      const expected = exempt ? 0 : (isAnual ? (PLAN_ARR_VAL[c.plan] ?? 0) : (PLAN_MRR_VAL[c.plan] ?? 0));
      const paid     = paidMap[c.id] ?? null;
      const method   = c.cardBrand && c.cardLast4
        ? `${c.cardBrand} ****${c.cardLast4}`
        : null;

      return {
        id: c.id, name: display, email: c.email,
        plan: c.plan, billingCycle: c.billingCycle ?? "mensal", expected, paid,
        exempt,
        paymentMethod: method,
        cardHolderName: c.cardHolderName,
        cardExpiry: c.cardExpiry,
        since: c.createdAt,
        status: (exempt || expected === 0) ? "isento" : paid ? "pago" : "pendente",
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
    } else if (freq === "trimestral") {
      const q = Math.floor(now.getMonth() / 3);          // 0..3
      windowStart = new Date(now.getFullYear(), q * 3, 1);
      windowEnd   = new Date(now.getFullYear(), q * 3 + 3, 0, 23, 59, 59);
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

// ── CONCILIAÇÃO DE SOCIEDADE ──────────────────────────────────────────────────
// Enquanto o faturamento não cobre as despesas, os sócios rateiam o que falta.
router.get("/financial/conciliacao", async (req, res) => {
  try {
    const entries = await prisma.adminFinancialEntry.findMany({
      where: { recorrente: false },
      orderBy: { createdAt: "desc" },
    });

    let receitas = 0, despesasPagas = 0;
    entries.forEach((e) => {
      if (e.status === "rejeitado") return;
      if (e.type === "receita") receitas += e.amount ?? 0;
      else if (e.type === "despesa") despesasPagas += e.amount ?? 0;
    });
    const caixa = receitas - despesasPagas;

    // Despesas em aberto = ainda não acertadas entre os sócios
    const despesas = entries.filter((e) => e.type === "despesa" && e.status !== "rejeitado");
    const abertas  = despesas.filter((e) => !e.societySettled);

    const totalDividaAberta = abertas.reduce((s, e) => s + (e.amount ?? 0), 0);
    // Quanto o caixa cobre; o que sobra é o que os sócios precisam ratear
    const cobertoPorCaixa = Math.max(0, Math.min(totalDividaAberta, caixa > 0 ? caixa : 0));
    const faltaRatear     = Math.max(0, totalDividaAberta - cobertoPorCaixa);

    // Rateio por sócio sobre o que falta
    const porSocio = SOCIOS.map((s) => ({
      ...s,
      devido: Math.round(faltaRatear * s.share * 100) / 100,
    }));

    // Detalhe por despesa
    const despesasDetalhe = despesas.map((e) => ({
      id: e.id,
      description: e.description,
      amount: e.amount,
      category: e.category,
      createdAt: e.createdAt,
      societySettled: e.societySettled,
      societySettledAt: e.societySettledAt,
      societyPaid: e.societyPaid ?? {},
      rateio: SOCIOS.map((s) => ({
        key: s.key, name: s.name, share: s.share,
        valor: Math.round((e.amount ?? 0) * s.share * 100) / 100,
      })),
    }));

    res.json({
      socios: SOCIOS,
      resumo: {
        receitas, despesasPagas, caixa,
        totalDivida: despesas.reduce((s, e) => s + (e.amount ?? 0), 0),
        totalDividaAberta, cobertoPorCaixa, faltaRatear,
      },
      porSocio,
      despesas: despesasDetalhe,
    });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// Marca/desmarca uma despesa como acertada entre os sócios (ou registra quanto cada um cobriu)
router.patch("/financial/entries/:id/society", async (req, res) => {
  try {
    const { societySettled, societyPaid } = req.body;
    const data = {};
    if (societySettled !== undefined) {
      data.societySettled = !!societySettled;
      data.societySettledAt = societySettled ? new Date() : null;
    }
    if (societyPaid !== undefined) data.societyPaid = societyPaid;
    const entry = await prisma.adminFinancialEntry.update({
      where: { id: req.params.id }, data,
    });
    res.json(entry);
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
