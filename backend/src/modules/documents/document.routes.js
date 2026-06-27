import { Router } from "express";
import multer from "multer";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { prisma } from "../../config/prisma.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { requireFeature } from "../../middlewares/feature.middleware.js";
import { getFeatures } from "../../config/features.js";
import { requestOtp, validateOtp } from "../signature/otp.service.js";
import { deleteFile, fileExists, getFile, saveFile } from "../../providers/storage/index.js";
import { buildStorageKey } from "../../providers/storage/storageKey.js";

const router = Router();

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

const documentsAccess = [authMiddleware, requireFeature("documents")];

async function userHasDocumentsAccess(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, plan: true, featureOverrides: true },
  });
  if (!user) return false;
  if (user.role === "ADMIN") return true;

  const features = {
    ...getFeatures(user.plan),
    ...(user.featureOverrides ?? {}),
  };
  return Boolean(features.documents);
}

async function generateSignedPdf({ patientDocument, fields, fieldValues, audit }) {
  if (!(await fileExists(patientDocument.document.filePath))) {
    throw new Error("Arquivo original não encontrado");
  }

  const originalBytes = await getFile(patientDocument.document.filePath);
  const originalHash = sha256(originalBytes);
  const pdfDoc = await PDFDocument.load(originalBytes);
  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const pages = pdfDoc.getPages();

  // Se não tiver campos configurados, adiciona posições padrão na última página
  const effectiveFields = [...fields];
  const lastPageIdx = pages.length;
  if (!effectiveFields.some((f) => f.type === "patient_sig")) {
    effectiveFields.push({ id: "_default_pat", type: "patient_sig",  page: lastPageIdx, x: 30, y: 88 });
  }
  if (audit.professionalSignature && !effectiveFields.some((f) => f.type === "professional_sig")) {
    effectiveFields.push({ id: "_default_pro", type: "professional_sig", page: lastPageIdx, x: 70, y: 88 });
  }

  const professionalSignatureBytes = dataUrlToBytes(audit.professionalSignature);
  const patientSignatureBytes = dataUrlToBytes(audit.patientSignature);
  const professionalSignatureImage = professionalSignatureBytes
    ? await pdfDoc.embedPng(professionalSignatureBytes)
    : null;
  const patientSignatureImage = patientSignatureBytes
    ? await pdfDoc.embedPng(patientSignatureBytes)
    : null;

  for (const field of effectiveFields) {
    const page = pages[(field.page ?? 1) - 1];
    if (!page) continue;

    const { width, height } = page.getSize();
    const centerX = ((field.x ?? 50) / 100) * width;
    const centerY = height - ((field.y ?? 50) / 100) * height;
    const isSignature = field.type === "professional_sig" || field.type === "patient_sig";

    if (isSignature) {
      const image = field.type === "professional_sig" ? professionalSignatureImage : patientSignatureImage;
      const label = field.type === "professional_sig" ? "Assinatura do profissional" : "Assinatura do paciente";
      const sigWidth  = 180;
      const sigHeight = 55;
      const labelH    = 14;

      // Só a imagem da assinatura, sem fundo nem borda
      if (image) {
        page.drawImage(image, {
          x:      centerX - sigWidth / 2,
          y:      centerY - sigHeight / 2 + labelH,
          width:  sigWidth,
          height: sigHeight,
        });
      }

      // Linha separadora fina abaixo da assinatura
      page.drawLine({
        start: { x: centerX - sigWidth / 2,     y: centerY - sigHeight / 2 + labelH },
        end:   { x: centerX + sigWidth / 2,     y: centerY - sigHeight / 2 + labelH },
        thickness: 0.4,
        color: rgb(0.6, 0.6, 0.6),
        opacity: 0.5,
      });

      // Legenda discreta abaixo da linha
      page.drawText(label, {
        x:    centerX - sigWidth / 2,
        y:    centerY - sigHeight / 2 + 3,
        size: 6,
        font: regularFont,
        color: rgb(0.4, 0.4, 0.4),
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

  const geoLine = audit.geolocationConsent && audit.latitude
    ? `Lat: ${audit.latitude}, Lng: ${audit.longitude}`
    : audit.geolocationConsent ? "Localização autorizada mas indisponível" : "GEOLOCATION_DENIED";

  const lines = [
    ["Certificado de Evidências — Assinatura Eletrônica Avançada", true],
    ["", false],
    ["DADOS DO ASSINANTE", true],
    [`Nome: ${audit.signerName || "-"}`],
    [`CPF: ${audit.signerCpf || "-"}`],
    [`E-mail: ${audit.signerEmail || "-"}`],
    [`Telefone: ${audit.signerPhone || "-"}`],
    ["", false],
    ["DADOS DA ASSINATURA", true],
    [`Documento: ${patientDocument.document.name}`],
    [`Paciente: ${patientDocument.patient.name}`],
    [`Profissional responsável: ${patientDocument.user.name} (${patientDocument.user.email})`],
    [`Aceite dos termos: ${audit.acceptedTerms ? "SIM" : "NÃO"} — ${audit.acceptedAt ? new Date(audit.acceptedAt).toISOString() : "-"}`],
    [`Data/Hora UTC: ${audit.signedAt.toISOString()}`],
    [`Fuso horário do assinante: ${audit.signerTimezone || "-"}`],
    [`Método OTP: ${audit.otpMethod || "-"} — validado em: ${audit.otpValidatedAt ? new Date(audit.otpValidatedAt).toISOString() : "-"}`],
    ["", false],
    ["EVIDÊNCIAS TÉCNICAS", true],
    [`IP: ${audit.signerIp || "-"}`],
    [`Navegador/Dispositivo: ${(audit.signerUserAgent || "-").slice(0, 90)}`],
    [`Geolocalização: ${geoLine}`],
    ["", false],
    ["INTEGRIDADE", true],
    [`Hash SHA-256 do documento original: ${originalHash}`],
    ["", false],
    ["DECLARAÇÃO", true],
    [`Este documento foi assinado eletronicamente através do sistema Iasoclin utilizando`],
    [`mecanismos de autenticação e auditoria compatíveis com assinatura eletrônica avançada`],
    [`para documentos privados (Lei 14.063/2020).`],
  ];

  auditPage.drawText("Iasoclin", {
    x: 48,
    y,
    size: 18,
    font: boldFont,
    color: rgb(0.19, 0.3, 0.24),
  });
  y -= 36;

  for (const entry of lines) {
    const [line, isTitle] = Array.isArray(entry) ? entry : [entry, false];
    if (!line) { y -= 10; continue; }
    auditPage.drawText(line, {
      x: 48,
      y,
      size: isTitle ? 10 : 8,
      font: isTitle ? boldFont : regularFont,
      color: isTitle ? rgb(0.19, 0.3, 0.24) : rgb(0.1, 0.1, 0.1),
      maxWidth: width - 96,
    });
    y -= isTitle ? 20 : 14;
    if (y < 48) break;
  }

  const signedBytes = await pdfDoc.save();
  const signedBuffer = Buffer.from(signedBytes);
  const signedHash = sha256(signedBuffer);
  const signedFilePath = buildStorageKey({
    type: "signed",
    clinicId: patientDocument.userId,
    patientId: patientDocument.patientId,
    originalName: `${sanitizeFileName(patientDocument.document.name)}.pdf`,
    defaultExt: ".pdf",
  });
  await saveFile(signedBuffer, signedFilePath, "application/pdf");

  return {
    originalHash,
    signedHash,
    signedFilePath,
    signedFileSize: signedBuffer.length,
  };
}

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, cb) => {
    const isPdf = file.mimetype === "application/pdf" || /\.pdf$/i.test(file.originalname);
    if (isPdf) cb(null, true);
    else cb(new Error("Apenas PDFs são permitidos"), false);
  },
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
});

function handlePdfUpload(req, res, next) {
  upload.single("file")(req, res, (error) => {
    if (!error) return next();

    const message =
      error.code === "LIMIT_FILE_SIZE"
        ? "Arquivo excede o limite de 20 MB"
        : error.message || "Erro ao processar arquivo";

    return res.status(400).json({ error: message });
  });
}

function documentStorageKey({ userId, originalName }) {
  // Documento-modelo não tem paciente vinculado, então sem patientId no path.
  return buildStorageKey({
    type: "documents",
    clinicId: userId,
    originalName,
    defaultExt: ".pdf",
  });
}

// --- Pasta Sanitária ---

router.get("/", ...documentsAccess, async (req, res) => {
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

router.post("/upload", ...documentsAccess, handlePdfUpload, async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Arquivo obrigatório" });
    const { name, type } = req.body;
    const filePath = documentStorageKey({ userId: req.user.id, originalName: req.file.originalname });
    await saveFile(req.file.buffer, filePath, "application/pdf");
    const doc = await prisma.document.create({
      data: {
        name: name || req.file.originalname.replace(/\.pdf$/i, ""),
        type: type || "termo",
        fileName: req.file.originalname,
        filePath,
        fileSize: req.file.size,
        userId: req.user.id,
      },
    });
    res.status(201).json(doc);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put("/:id", ...documentsAccess, async (req, res) => {
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

router.delete("/:id", ...documentsAccess, async (req, res) => {
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
      await deleteFile(patientDoc.signedFilePath);
    }
    await deleteFile(doc.filePath);
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
    if (!(await userHasDocumentsAccess(userId))) {
      return res.status(403).json({ error: "Recurso não disponível no plano atual." });
    }

    const doc = await prisma.document.findFirst({
      where: { id: req.params.id, userId },
    });
    if (!doc) return res.status(404).json({ error: "Not found" });
    if (!(await fileExists(doc.filePath))) return res.status(404).json({ error: "Arquivo não encontrado" });
    const buffer = await getFile(doc.filePath);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${doc.fileName}"`);
    res.end(buffer);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- Patient Documents ---

router.get("/patient/:patientId", ...documentsAccess, async (req, res) => {
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
    if (!(await userHasDocumentsAccess(userId))) {
      return res.status(403).json({ error: "Recurso não disponível no plano atual." });
    }

    const pd = await prisma.patientDocument.findFirst({
      where: { id: req.params.id, userId },
      include: { document: true },
    });
    if (!pd) return res.status(404).json({ error: "Not found" });
    if (!pd.signedFilePath) return res.status(404).json({ error: "PDF assinado não encontrado" });

    if (!(await fileExists(pd.signedFilePath))) return res.status(404).json({ error: "Arquivo assinado não encontrado" });
    const buffer = await getFile(pd.signedFilePath);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="assinado-${pd.document.fileName}"`);
    res.end(buffer);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/send", ...documentsAccess, async (req, res) => {
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

router.put("/patient-doc/:id/sign", ...documentsAccess, async (req, res) => {
  try {
    const pd = await prisma.patientDocument.findFirst({
      where: { id: req.params.id, userId: req.user.id },
      include: { document: true, patient: true, user: true },
    });
    if (!pd) return res.status(404).json({ error: "Not found" });

    // Verificar OTP validado (janela de 15 minutos)
    const OTP_WINDOW_MS = 15 * 60 * 1000;
    if (!pd.otpValidatedAt || Date.now() - new Date(pd.otpValidatedAt).getTime() > OTP_WINDOW_MS) {
      return res.status(403).json({ error: "Validação OTP expirada. Solicite um novo código." });
    }

    const {
      fieldValues = {},
      professionalSignature = null,
      patientSignature = null,
      signerName,
      signerCpf,
      signerEmail,
      signerPhone,
      signerTimezone,
      acceptedTerms = false,
      acceptedAt,
      latitude,
      longitude,
      geolocationConsent = false,
    } = req.body;

    if (!signerName || !signerCpf) {
      return res.status(400).json({ error: "Nome e CPF do assinante são obrigatórios" });
    }
    if (!acceptedTerms) {
      return res.status(400).json({ error: "O assinante deve aceitar os termos antes de assinar." });
    }

    const fields = pd.document.fields ?? [];
    if (Array.isArray(fields) && fields.some((f) => f.type === "professional_sig") && !professionalSignature) {
      return res.status(400).json({ error: "Assinatura do profissional é obrigatória" });
    }
    if (Array.isArray(fields) && fields.some((f) => f.type === "patient_sig") && !patientSignature) {
      return res.status(400).json({ error: "Assinatura do paciente é obrigatória" });
    }

    const signedAt      = new Date();
    const signerIp      = getClientIp(req);
    const signerUserAgent = req.headers["user-agent"] ?? null;

    const audit = {
      event: "patient_document_signed",
      patientDocumentId: pd.id,
      documentId: pd.documentId,
      patientId: pd.patientId,
      userId: pd.userId,
      signerName,
      signerCpf,
      signerEmail: signerEmail ?? pd.signerEmail,
      signerPhone: signerPhone ?? pd.signerPhone,
      signerTimezone,
      signerIp,
      signerUserAgent,
      acceptedTerms,
      acceptedAt: acceptedAt ?? signedAt.toISOString(),
      otpMethod: pd.otpMethod,
      otpValidatedAt: pd.otpValidatedAt,
      latitude,
      longitude,
      geolocationConsent,
      signedAt,
      fieldsCount: Array.isArray(fields) ? fields.length : 0,
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
      ...audit,
      signedAt: signedAt.toISOString(),
      originalHash: signedPdf.originalHash,
      signedHash: signedPdf.signedHash,
      signedFilePath: signedPdf.signedFilePath,
    };
    delete auditTrail.professionalSignature;
    delete auditTrail.patientSignature;

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
        signerEmail: signerEmail ?? pd.signerEmail,
        signerPhone: signerPhone ?? pd.signerPhone,
        signerTimezone,
        signerIp,
        signerUserAgent,
        acceptedTerms,
        acceptedAt: acceptedAt ? new Date(acceptedAt) : signedAt,
        otpMethod: pd.otpMethod,
        latitude:  latitude  ?? null,
        longitude: longitude ?? null,
        geolocationConsent,
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

router.delete("/patient-doc/:id", ...documentsAccess, async (req, res) => {
  try {
    const pd = await prisma.patientDocument.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!pd) return res.status(404).json({ error: "Not found" });
    if (pd.signedFilePath) {
      await deleteFile(pd.signedFilePath);
    }
    await prisma.patientDocument.delete({ where: { id: pd.id } });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── OTP: Solicitar código ─────────────────────────────────────────────────────
router.post("/patient-doc/:id/request-otp", ...documentsAccess, async (req, res) => {
  try {
    const pd = await prisma.patientDocument.findFirst({
      where: { id: req.params.id, userId: req.user.id },
      include: { document: true },
    });
    if (!pd) return res.status(404).json({ error: "Not found" });

    const { method = "email", email, phone } = req.body;
    const target = method === "email" ? email : phone;
    if (!target) return res.status(400).json({ error: `${method === "email" ? "E-mail" : "Telefone"} é obrigatório` });

    const result = await requestOtp({
      context:      pd.id,
      method,
      target,
      documentName: pd.document.name,
      clinicUserId: req.user.id,
    });

    // Persiste email/telefone informado para auditoria
    await prisma.patientDocument.update({
      where: { id: pd.id },
      data: {
        signerEmail: method === "email"     ? email : pd.signerEmail,
        signerPhone: method !== "email"     ? phone : pd.signerPhone,
        otpMethod:   method,
      },
    });

    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// ── OTP: Validar código ───────────────────────────────────────────────────────
router.post("/patient-doc/:id/validate-otp", ...documentsAccess, async (req, res) => {
  try {
    const pd = await prisma.patientDocument.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!pd) return res.status(404).json({ error: "Not found" });

    const { code } = req.body;
    if (!code) return res.status(400).json({ error: "Código é obrigatório" });

    await validateOtp({ context: pd.id, code });

    await prisma.patientDocument.update({
      where: { id: pd.id },
      data:  { otpValidatedAt: new Date() },
    });

    res.json({ valid: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

export default router;
