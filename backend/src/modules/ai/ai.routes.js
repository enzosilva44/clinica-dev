import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import {
  generatePatientSummary,
  generateEvolutionDraft,
  generateReturnSuggestions,
  chatHelp,
  chatReports,
  analyzeFinancialHealth,
  generateDailyInsight,
} from "./ai.service.js";

const router = Router();
router.use(authMiddleware);

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
