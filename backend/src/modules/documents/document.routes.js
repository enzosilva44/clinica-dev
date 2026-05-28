import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { prisma } from "../../config/prisma.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";

const router = Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.resolve(__dirname, "../../../uploads");
const signedUploadsDir = path.join(uploadsDir, "signed");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
if (!fs.existsSync(signedUploadsDir)) fs.mkdirSync(signedUploadsDir, { recursive: true });

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0].trim();
  }
  return req.socket?.remoteAddress ?? req.ip ?? null;
}

function dataUrlToBytes(dataUrl) {
  if (!dataUrl || typeof dataUrl !== "string") return null;
  const [, base64] = dataUrl.split(",");
  if (!base64) return null;
  return Buffer.from(base64, "base64");
}

function sanitizeFileName(value) {
  return String(value ?? "documento")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function formatDateTime(date) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium",
    timeZone: "UTC",
  }).format(date);
}

async function generateSignedPdf({ patientDocument, fields, fieldValues, audit }) {
  const originalPath = path.join(uploadsDir, patientDocument.document.filePath);
  if (!fs.existsSync(originalPath)) {
    throw new Error("Arquivo original não encontrado");
  }

  const originalBytes = fs.readFileSync(originalPath);
  const originalHash = sha256(originalBytes);
  const pdfDoc = await PDFDocument.load(originalBytes);
  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const pages = pdfDoc.getPages();

  const professionalSignatureBytes = dataUrlToBytes(audit.professionalSignature);
  const patientSignatureBytes = dataUrlToBytes(audit.patientSignature);
  const professionalSignatureImage = professionalSignatureBytes
    ? await pdfDoc.embedPng(professionalSignatureBytes)
    : null;
  const patientSignatureImage = patientSignatureBytes
    ? await pdfDoc.embedPng(patientSignatureBytes)
    : null;

  for (const field of fields) {
    const page = pages[(field.page ?? 1) - 1];
    if (!page) continue;

    const { width, height } = page.getSize();
    const centerX = ((field.x ?? 50) / 100) * width;
    const centerY = height - ((field.y ?? 50) / 100) * height;
    const isSignature = field.type === "professional_sig" || field.type === "patient_sig";

    if (isSignature) {
      const image = field.type === "professional_sig" ? professionalSignatureImage : patientSignatureImage;
      const label = field.type === "professional_sig" ? "Assinatura profissional" : "Assinatura paciente";
      const sigWidth = 190;
      const sigHeight = 70;

      page.drawRectangle({
        x: centerX - sigWidth / 2,
        y: centerY - sigHeight / 2,
        width: sigWidth,
        height: sigHeight,
        borderColor: rgb(0.2, 0.3, 0.24),
        borderWidth: 0.5,
        color: rgb(1, 1, 1),
        opacity: 0.85,
      });

      if (image) {
        page.drawImage(image, {
          x: centerX - sigWidth / 2 + 6,
          y: centerY - sigHeight / 2 + 10,
          width: sigWidth - 12,
          height: sigHeight - 20,
        });
      }

      page.drawText(label, {
        x: centerX - sigWidth / 2 + 6,
        y: centerY - sigHeight / 2 + 3,
        size: 6,
        font: regularFont,
        color: rgb(0.25, 0.25, 0.25),
      });
      continue;
    }

    const value = fieldValues?.[field.id];
    if (!value) continue;

    page.drawText(String(value), {
      x: centerX - 60,
      y: centerY - 5,
      size: 10,
      font: regularFont,
      color: rgb(0.1, 0.1, 0.1),
      maxWidth: 150,
    });
  }

  const footer = `Assinado eletronicamente em ${formatDateTime(audit.signedAt)} UTC | Hash original: ${originalHash.slice(0, 24)}...`;
  for (const page of pages) {
    page.drawText(footer, {
      x: 28,
      y: 18,
      size: 7,
      font: regularFont,
      color: rgb(0.35, 0.35, 0.35),
      maxWidth: page.getWidth() - 56,
    });
  }

  const auditPage = pdfDoc.addPage();
  const { width, height } = auditPage.getSize();
  let y = height - 56;
  const lines = [
    ["Registro de Auditoria de Assinatura Eletrônica", true],
    [`Documento: ${patientDocument.document.name}`],
    [`Paciente: ${patientDocument.patient.name}`],
    [`Nome informado: ${audit.signerName || "-"}`],
    [`CPF informado: ${audit.signerCpf || "-"}`],
    [`Profissional/usuário: ${patientDocument.user.name} (${patientDocument.user.email})`],
    [`Data/Hora UTC: ${audit.signedAt.toISOString()}`],
    [`IP: ${audit.signerIp || "-"}`],
    [`User-Agent: ${audit.signerUserAgent || "-"}`],
    [`Hash SHA-256 do PDF original: ${originalHash}`],
    [`Método: assinatura eletrônica interna com imagem biométrica desenhada em tela e trilha de auditoria.`],
  ];

  auditPage.drawText("Iasoclin", {
    x: 48,
    y,
    size: 18,
    font: boldFont,
    color: rgb(0.19, 0.3, 0.24),
  });
  y -= 36;

  for (const [line, isTitle] of lines) {
    auditPage.drawText(line, {
      x: 48,
      y,
      size: isTitle ? 13 : 9,
      font: isTitle ? boldFont : regularFont,
      color: isTitle ? rgb(0.19, 0.3, 0.24) : rgb(0.1, 0.1, 0.1),
      maxWidth: width - 96,
    });
    y -= isTitle ? 28 : 18;
  }

  const signedBytes = await pdfDoc.save();
  const signedBuffer = Buffer.from(signedBytes);
  const signedHash = sha256(signedBuffer);
  const signedFileName = `signed-${patientDocument.id}-${Date.now()}-${sanitizeFileName(patientDocument.document.name)}.pdf`;
  const signedFilePath = path.join("signed", signedFileName);
  fs.writeFileSync(path.join(uploadsDir, signedFilePath), signedBuffer);

  return {
    originalHash,
    signedHash,
    signedFilePath,
    signedFileSize: signedBuffer.length,
  };
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "application/pdf") cb(null, true);
    else cb(new Error("Apenas PDFs são permitidos"), false);
  },
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
});

// --- Pasta Sanitária ---

router.get("/", authMiddleware, async (req, res) => {
  try {
    const docs = await prisma.document.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: "desc" },
    });
    res.json(docs);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/upload", authMiddleware, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Arquivo obrigatório" });
    const { name, type } = req.body;
    const doc = await prisma.document.create({
      data: {
        name: name || req.file.originalname.replace(/\.pdf$/i, ""),
        type: type || "termo",
        fileName: req.file.originalname,
        filePath: req.file.filename,
        fileSize: req.file.size,
        userId: req.user.id,
      },
    });
    res.status(201).json(doc);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put("/:id", authMiddleware, async (req, res) => {
  try {
    const doc = await prisma.document.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!doc) return res.status(404).json({ error: "Not found" });
    const updated = await prisma.document.update({
      where: { id: doc.id },
      data: {
        name: req.body.name ?? doc.name,
        type: req.body.type ?? doc.type,
        fields: req.body.fields ?? doc.fields,
      },
    });
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const doc = await prisma.document.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!doc) return res.status(404).json({ error: "Not found" });
    const patientDocs = await prisma.patientDocument.findMany({
      where: { documentId: doc.id, userId: req.user.id },
      select: { signedFilePath: true },
    });
    for (const patientDoc of patientDocs) {
      if (!patientDoc.signedFilePath) continue;
      const signedPath = path.join(uploadsDir, patientDoc.signedFilePath);
      if (fs.existsSync(signedPath)) fs.unlinkSync(signedPath);
    }
    const filePath = path.join(uploadsDir, doc.filePath);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    await prisma.document.delete({ where: { id: doc.id } });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/:id/file", async (req, res) => {
  try {
    let userId = null;
    const authHeader = req.headers.authorization;
    const queryToken = req.query.token;
    const rawToken = authHeader ? authHeader.split(" ")[1] : queryToken;
    if (!rawToken) return res.status(401).json({ error: "Não autorizado" });
    try {
      const decoded = jwt.verify(rawToken, process.env.JWT_SECRET);
      userId = decoded.id;
    } catch {
      return res.status(401).json({ error: "Token inválido" });
    }

    const doc = await prisma.document.findFirst({
      where: { id: req.params.id, userId },
    });
    if (!doc) return res.status(404).json({ error: "Not found" });
    const filePath = path.join(uploadsDir, doc.filePath);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: "Arquivo não encontrado" });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${doc.fileName}"`);
    fs.createReadStream(filePath).pipe(res);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- Patient Documents ---

router.get("/patient/:patientId", authMiddleware, async (req, res) => {
  try {
    const docs = await prisma.patientDocument.findMany({
      where: { patientId: req.params.patientId, userId: req.user.id },
      include: { document: true },
      orderBy: { createdAt: "desc" },
    });
    res.json(docs);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/patient-doc/:id/file", async (req, res) => {
  try {
    let userId = null;
    const authHeader = req.headers.authorization;
    const queryToken = req.query.token;
    const rawToken = authHeader ? authHeader.split(" ")[1] : queryToken;
    if (!rawToken) return res.status(401).json({ error: "Não autorizado" });
    try {
      const decoded = jwt.verify(rawToken, process.env.JWT_SECRET);
      userId = decoded.id;
    } catch {
      return res.status(401).json({ error: "Token inválido" });
    }

    const pd = await prisma.patientDocument.findFirst({
      where: { id: req.params.id, userId },
      include: { document: true },
    });
    if (!pd) return res.status(404).json({ error: "Not found" });
    if (!pd.signedFilePath) return res.status(404).json({ error: "PDF assinado não encontrado" });

    const filePath = path.join(uploadsDir, pd.signedFilePath);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: "Arquivo assinado não encontrado" });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="assinado-${pd.document.fileName}"`);
    fs.createReadStream(filePath).pipe(res);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/send", authMiddleware, async (req, res) => {
  try {
    const { patientId, documentId } = req.body;
    const existing = await prisma.patientDocument.findFirst({
      where: { patientId, documentId, userId: req.user.id, status: "pending" },
    });
    if (existing) return res.status(409).json({ error: "Documento já enviado para este paciente" });
    const pd = await prisma.patientDocument.create({
      data: { patientId, documentId, userId: req.user.id },
      include: { document: true },
    });
    res.status(201).json(pd);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put("/patient-doc/:id/sign", authMiddleware, async (req, res) => {
  try {
    const pd = await prisma.patientDocument.findFirst({
      where: { id: req.params.id, userId: req.user.id },
      include: { document: true, patient: true, user: true },
    });
    if (!pd) return res.status(404).json({ error: "Not found" });

    const signedAt = new Date();
    const fieldValues = req.body.fieldValues ?? {};
    const professionalSignature = req.body.professionalSignature ?? null;
    const patientSignature = req.body.patientSignature ?? null;
    const signerName = req.body.signerName ?? null;
    const signerCpf = req.body.signerCpf ?? null;
    const signerIp = getClientIp(req);
    const signerUserAgent = req.headers["user-agent"] ?? null;
    const fields = pd.document.fields ?? [];
    if (!signerName || !signerCpf) {
      return res.status(400).json({ error: "Nome e CPF do assinante são obrigatórios" });
    }
    if (Array.isArray(fields) && fields.some((field) => field.type === "professional_sig") && !professionalSignature) {
      return res.status(400).json({ error: "Assinatura do profissional é obrigatória" });
    }
    if (Array.isArray(fields) && fields.some((field) => field.type === "patient_sig") && !patientSignature) {
      return res.status(400).json({ error: "Assinatura do paciente é obrigatória" });
    }

    const audit = {
      event: "patient_document_signed",
      patientDocumentId: pd.id,
      documentId: pd.documentId,
      patientId: pd.patientId,
      userId: pd.userId,
      signerName,
      signerCpf,
      signerIp,
      signerUserAgent,
      signedAt,
      fieldsCount: Array.isArray(fields) ? fields.length : 0,
      fieldValueIds: Object.keys(fieldValues),
      hasProfessionalSignature: Boolean(professionalSignature),
      hasPatientSignature: Boolean(patientSignature),
      professionalSignature,
      patientSignature,
    };

    const signedPdf = await generateSignedPdf({
      patientDocument: pd,
      fields: Array.isArray(fields) ? fields : [],
      fieldValues,
      audit,
    });

    const auditTrail = {
      event: audit.event,
      patientDocumentId: audit.patientDocumentId,
      documentId: audit.documentId,
      patientId: audit.patientId,
      userId: audit.userId,
      signerName,
      signerCpf,
      signerIp,
      signerUserAgent,
      signedAt: signedAt.toISOString(),
      fieldsCount: audit.fieldsCount,
      fieldValueIds: audit.fieldValueIds,
      hasProfessionalSignature: audit.hasProfessionalSignature,
      hasPatientSignature: audit.hasPatientSignature,
      originalHash: signedPdf.originalHash,
      signedHash: signedPdf.signedHash,
      signedFilePath: signedPdf.signedFilePath,
    };

    const updated = await prisma.patientDocument.update({
      where: { id: pd.id },
      data: {
        status: "signed",
        signedAt,
        fieldValues,
        professionalSignature,
        patientSignature,
        signerName,
        signerCpf,
        signerIp,
        signerUserAgent,
        originalHash: signedPdf.originalHash,
        signedHash: signedPdf.signedHash,
        signedFilePath: signedPdf.signedFilePath,
        signedFileSize: signedPdf.signedFileSize,
        auditTrail,
      },
      include: { document: true },
    });
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete("/patient-doc/:id", authMiddleware, async (req, res) => {
  try {
    const pd = await prisma.patientDocument.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!pd) return res.status(404).json({ error: "Not found" });
    if (pd.signedFilePath) {
      const signedPath = path.join(uploadsDir, pd.signedFilePath);
      if (fs.existsSync(signedPath)) fs.unlinkSync(signedPath);
    }
    await prisma.patientDocument.delete({ where: { id: pd.id } });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
