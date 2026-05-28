import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import {
  generatePatientSummary,
  generateEvolutionDraft,
  generateReturnSuggestions,
  chatHelp,
} from "./ai.service.js";

const router = Router();
router.use(authMiddleware);

// 1. Resumo do histórico do paciente
router.post("/patient-summary/:patientId", async (req, res) => {
  try {
    const summary = await generatePatientSummary(
      req.params.patientId,
      req.user.id
    );
    res.json({ summary });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 2. Geração de rascunho de evolução
router.post("/evolution-draft", async (req, res) => {
  try {
    const draft = await generateEvolutionDraft(req.body);
    res.json({ draft });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 3. Sugestões de retorno de pacientes
router.get("/return-suggestions", async (req, res) => {
  try {
    const suggestions = await generateReturnSuggestions(req.user.id);
    res.json({ suggestions });
  } catch (error) {
    res.status(400).json({ error: error.message });
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
    res.status(400).json({ error: error.message });
  }
});

export default router;
