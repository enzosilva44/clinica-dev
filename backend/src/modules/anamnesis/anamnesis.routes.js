import { Router } from "express";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { prisma } from "../../config/prisma.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { saveFile } from "../../providers/storage/index.js";
import { buildStorageKey } from "../../providers/storage/storageKey.js";
import { DEFAULT_ANAMNESIS_QUESTIONS, DEFAULT_TEMPLATE_NAME } from "./defaultTemplate.js";

const router = Router();
router.use(authMiddleware);

/* ─── TEMPLATES ─────────────────────────────────────────────────────────── */

// Lista templates da clínica. Se não houver nenhum, cria o padrão automaticamente.
router.get("/templates", async (req, res) => {
  try {
    let templates = await prisma.anamnesisTemplate.findMany({
      where: { userId: req.user.id, isActive: true },
      orderBy: { createdAt: "asc" },
    });

    if (templates.length === 0) {
      const created = await prisma.anamnesisTemplate.create({
        data: {
          name: DEFAULT_TEMPLATE_NAME,
          questions: DEFAULT_ANAMNESIS_QUESTIONS,
          userId: req.user.id,
        },
      });
      templates = [created];
    }

    res.json(templates);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.post("/templates", async (req, res) => {
  try {
    const { name, questions } = req.body;
    if (!name || !Array.isArray(questions)) {
      return res.status(400).json({ error: "Nome e perguntas são obrigatórios." });
    }
    const template = await prisma.anamnesisTemplate.create({
      data: { name, questions, userId: req.user.id },
    });
    res.status(201).json(template);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.put("/templates/:id", async (req, res) => {
  try {
    const { name, questions } = req.body;
    const existing = await prisma.anamnesisTemplate.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!existing) return res.status(404).json({ error: "Template não encontrado." });

    const data = {};
    if (name !== undefined) data.name = name;
    if (questions !== undefined) data.questions = questions;

    const updated = await prisma.anamnesisTemplate.update({
      where: { id: req.params.id },
      data,
    });
    res.json(updated);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.delete("/templates/:id", async (req, res) => {
  try {
    const existing = await prisma.anamnesisTemplate.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!existing) return res.status(404).json({ error: "Template não encontrado." });
    // Soft delete pra não quebrar respostas já vinculadas.
    await prisma.anamnesisTemplate.update({
      where: { id: req.params.id },
      data: { isActive: false },
    });
    res.json({ ok: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

/* ─── RESPOSTAS (anamnese preenchida do paciente) ───────────────────────── */

// Lista respostas de um paciente
router.get("/responses/patient/:patientId", async (req, res) => {
  try {
    const responses = await prisma.anamnesisResponse.findMany({
      where: { patientId: req.params.patientId, userId: req.user.id },
      include: { template: { select: { name: true, questions: true } } },
      orderBy: { updatedAt: "desc" },
    });
    res.json(responses);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// Cria/atualiza rascunho (auto-save). Reusa o rascunho existente do par paciente+template.
router.post("/responses", async (req, res) => {
  try {
    const { templateId, patientId, answers, responseId } = req.body;
    if (!templateId || !patientId) {
      return res.status(400).json({ error: "templateId e patientId são obrigatórios." });
    }

    if (responseId) {
      const existing = await prisma.anamnesisResponse.findFirst({
        where: { id: responseId, userId: req.user.id, status: "draft" },
      });
      if (existing) {
        const updated = await prisma.anamnesisResponse.update({
          where: { id: responseId },
          data: { answers: answers ?? {} },
        });
        return res.json(updated);
      }
    }

    const created = await prisma.anamnesisResponse.create({
      data: {
        templateId, patientId, userId: req.user.id,
        answers: answers ?? {}, status: "draft",
      },
    });
    res.status(201).json(created);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// Finaliza: gera PDF, anexa nos documentos do paciente e marca como finalizada
router.post("/responses/:id/finalize", async (req, res) => {
  try {
    const response = await prisma.anamnesisResponse.findFirst({
      where: { id: req.params.id, userId: req.user.id },
      include: { template: true, patient: true },
    });
    if (!response) return res.status(404).json({ error: "Anamnese não encontrada." });

    // Permite atualizar respostas no momento de finalizar
    const answers = req.body.answers ?? response.answers ?? {};
    // forSignature=true → documento entra PENDENTE, pra ser assinado pelo paciente.
    // Caso contrário mantém o comportamento antigo (arquiva já como assinado pelo profissional).
    const forSignature = req.body.forSignature === true;

    const pdfBytes = await buildAnamnesisPdf({
      patientName: response.patient.name,
      templateName: response.template.name,
      questions: response.template.questions,
      answers,
      clinicName: req.user.clinicName || req.user.name,
    });

    const filePath = buildStorageKey({
      type: "anamnesis",
      clinicId: req.user.id,
      patientId: response.patientId,
      originalName: `anamnese-${response.template.name}.pdf`,
      defaultExt: ".pdf",
    });
    await saveFile(Buffer.from(pdfBytes), filePath, "application/pdf");

    // Anexa nos documentos do paciente (Document + PatientDocument finalizado)
    const doc = await prisma.document.create({
      data: {
        name: `Anamnese — ${response.template.name}`,
        type: "anamnese",
        fileName: `anamnese-${response.patient.name}.pdf`,
        filePath,
        fileSize: pdfBytes.length,
        userId: req.user.id,
      },
    });
    await prisma.patientDocument.create({
      data: {
        documentId: doc.id,
        patientId: response.patientId,
        userId: req.user.id,
        ...(forSignature
          ? { status: "pending" }
          : { status: "signed", signedFilePath: filePath }),
      },
    });

    const updated = await prisma.anamnesisResponse.update({
      where: { id: response.id },
      data: { answers, status: "finalized", documentPath: filePath, finalizedAt: new Date() },
    });

    res.json({ ...updated, documentId: doc.id });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

/* ─── PDF ────────────────────────────────────────────────────────────────── */

function answerToText(question, value) {
  if (value === undefined || value === null || value === "") return "—";
  if (question.type === "boolean") return value === true || value === "sim" ? "Sim" : "Não";
  return String(value);
}

async function buildAnamnesisPdf({ patientName, templateName, questions, answers, clinicName }) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const green = rgb(0, 0.44, 0.29);
  const dark = rgb(0.08, 0.08, 0.08);
  const gray = rgb(0.4, 0.4, 0.4);

  let page = pdf.addPage([595, 842]); // A4
  const margin = 50;
  let y = 800;

  page.drawText("Anamnese", { x: margin, y, size: 22, font: fontBold, color: green });
  y -= 24;
  page.drawText(templateName, { x: margin, y, size: 11, font, color: gray });
  y -= 28;
  page.drawText(`Paciente: ${patientName}`, { x: margin, y, size: 12, font: fontBold, color: dark });
  y -= 16;
  page.drawText(`Clínica: ${clinicName}`, { x: margin, y, size: 10, font, color: gray });
  y -= 14;
  page.drawText(`Emitido em: ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`, { x: margin, y, size: 9, font, color: gray });
  y -= 24;
  page.drawLine({ start: { x: margin, y }, end: { x: 545, y }, thickness: 1, color: rgb(0.9, 0.88, 0.82) });
  y -= 24;

  questions.forEach((q, i) => {
    if (y < 70) { page = pdf.addPage([595, 842]); y = 800; }
    const label = `${i + 1}. ${q.label}`;
    page.drawText(label, { x: margin, y, size: 10, font: fontBold, color: dark, maxWidth: 320 });
    const ans = answerToText(q, answers?.[q.id]);
    page.drawText(ans, { x: 390, y, size: 10, font, color: green, maxWidth: 155 });
    y -= 22;
  });

  return pdf.save();
}

export default router;
