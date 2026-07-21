import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { prisma } from "../../config/prisma.js";
import {
  generatePatientSummary,
  generateEvolutionDraft,
  generateReturnSuggestions,
  chatHelp,
  chatReports,
  analyzeFinancialHealth,
  analyzeProductHealth,
  generateDailyInsight,
} from "./ai.service.js";
import { aiDemo } from "./ai.demo.js";

const router = Router();
router.use(authMiddleware);

// Contas demo NUNCA batem no Claude: respondem com mocks chumbados.
// Este interceptor roda antes de todos os handlers de IA.
router.use(async (req, res, next) => {
  try {
    const u = await prisma.user.findUnique({ where: { id: req.user.id }, select: { plan: true } });
    if (u?.plan !== "demo") return next();
  } catch {
    return next(); // em caso de erro, deixa o fluxo normal decidir
  }

  const p = req.path;
  // GET de resumo salvo continua normal (lê do banco, não gera).
  if (req.method === "GET" && p.startsWith("/patient-summary/")) return next();

  if (req.method === "POST" && p.startsWith("/patient-summary/")) {
    const summary = aiDemo.patientSummary();
    await prisma.patient.updateMany({
      where: { id: req.params.patientId ?? p.split("/").pop(), userId: req.user.id },
      data: { aiSummary: summary, aiSummaryAt: new Date() },
    }).catch(() => {});
    return res.json({ summary });
  }
  if (p === "/evolution-draft") return res.json({ draft: aiDemo.evolutionDraft() });
  if (p === "/return-suggestions") return res.json({ suggestions: await aiDemo.returnSuggestions(req.user.id) });
  if (p === "/chat") return res.json({ reply: aiDemo.chat() });
  if (p === "/chat-reports") return res.json({ reply: aiDemo.chatReports() });
  if (p === "/financial-health") return res.json(aiDemo.financialHealth());
  if (p === "/product-health") return res.json(aiDemo.productHealth());
  if (p === "/daily-insight") return res.json({ phrase: aiDemo.dailyInsight() });

  return next();
});

function sendAiError(res, error, context) {
  const message = error?.message || "Erro ao processar IA.";
  const status = message.includes("ANTHROPIC_API_KEY")
    ? 500
    : message.startsWith("Falha na IA")
      ? 502
      : 400;

  console.error(`[ai:${context}]`, {
    status,
    message,
  });

  return res.status(status).json({ error: message });
}

// 1. Resumo do histórico do paciente — gera, salva e retorna
router.post("/patient-summary/:patientId", async (req, res) => {
  try {
    const { prisma } = await import("../../config/prisma.js");
    const summary = await generatePatientSummary(req.params.patientId, req.user.id);
    await prisma.patient.updateMany({
      where: { id: req.params.patientId, userId: req.user.id },
      data: { aiSummary: summary, aiSummaryAt: new Date() },
    });
    res.json({ summary });
  } catch (error) {
    sendAiError(res, error, "patient-summary:create");
  }
});

// 1b. Busca resumo salvo sem gerar novo
router.get("/patient-summary/:patientId", async (req, res) => {
  try {
    const { prisma } = await import("../../config/prisma.js");
    const patient = await prisma.patient.findFirst({
      where: { id: req.params.patientId, userId: req.user.id },
      select: { aiSummary: true, aiSummaryAt: true },
    });
    res.json({ summary: patient?.aiSummary ?? null, updatedAt: patient?.aiSummaryAt ?? null });
  } catch (error) {
    sendAiError(res, error, "patient-summary:get");
  }
});

// 2. Geração de rascunho de evolução
router.post("/evolution-draft", async (req, res) => {
  try {
    const draft = await generateEvolutionDraft(req.body);
    res.json({ draft });
  } catch (error) {
    sendAiError(res, error, "evolution-draft");
  }
});

// 3. Sugestões de retorno de pacientes
router.get("/return-suggestions", async (req, res) => {
  try {
    const suggestions = await generateReturnSuggestions(req.user.id);
    res.json({ suggestions });
  } catch (error) {
    sendAiError(res, error, "return-suggestions");
  }
});

// 4. Chat de ajuda
router.post("/chat", async (req, res) => {
  try {
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "messages obrigatório" });
    }
    const reply = await chatHelp(messages);
    res.json({ reply });
  } catch (error) {
    sendAiError(res, error, "chat");
  }
});

// 5. Guardião Financeiro
router.get("/financial-health", async (req, res) => {
  try {
    const result = await analyzeFinancialHealth(req.user.id);
    res.json(result);
  } catch (error) {
    sendAiError(res, error, "financial-health");
  }
});

// 5b. Guardião de Produtos
router.get("/product-health", async (req, res) => {
  try {
    const result = await analyzeProductHealth(req.user.id);
    res.json(result);
  } catch (error) {
    sendAiError(res, error, "product-health");
  }
});

// 6. Chat de relatórios com tool use
router.post("/chat-reports", async (req, res) => {
  try {
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "messages obrigatório" });
    }
    const reply = await chatReports(req.user.id, messages);
    res.json({ reply });
  } catch (error) {
    sendAiError(res, error, "chat-reports");
  }
});

// 7. Frase motivacional diária
router.get("/daily-insight", async (req, res) => {
  try {
    const phrase = await generateDailyInsight(req.user.id);
    res.json({ phrase });
  } catch (error) {
    sendAiError(res, error, "daily-insight");
  }
});

export default router;
