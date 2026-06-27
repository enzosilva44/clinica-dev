import { Router } from "express";
import multer from "multer";
import jwt from "jsonwebtoken";
import { prisma } from "../../config/prisma.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { deleteFile, fileExists, getFile, saveFile } from "../../providers/storage/index.js";
import { buildStorageKey } from "../../providers/storage/storageKey.js";

const router = Router();

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_TYPES.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Apenas imagens são permitidas (JPG, PNG, WebP)"), false);
  },
  limits: { fileSize: 15 * 1024 * 1024 }, // 15 MB
});

function storageKey({ userId, patientId, originalName }) {
  return buildStorageKey({
    type: "photos",
    clinicId: userId,
    patientId,
    originalName,
    defaultExt: ".jpg",
  });
}

// List photos for a patient
router.get("/patient/:patientId", authMiddleware, async (req, res) => {
  try {
    const photos = await prisma.patientPhoto.findMany({
      where: { patientId: req.params.patientId, userId: req.user.id },
      orderBy: { createdAt: "desc" },
    });
    res.json(photos);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Upload photos (up to 10 at once)
router.post("/patient/:patientId", authMiddleware, (req, res, next) => {
  upload.array("photos", 10)(req, res, (err) => {
    if (err) {
      console.error("[photo upload] multer error:", err.message);
      return res.status(400).json({ error: err.message });
    }
    next();
  });
}, async (req, res) => {
  try {
    if (!req.files?.length) return res.status(400).json({ error: "Nenhuma imagem enviada" });

    const created = await Promise.all(
      req.files.map(async (file) => {
        const filePath = storageKey({
          userId: req.user.id,
          patientId: req.params.patientId,
          originalName: file.originalname,
        });
        await saveFile(file.buffer, filePath, file.mimetype);
        return prisma.patientPhoto.create({
          data: {
            fileName: file.originalname,
            filePath,
            fileSize: file.size,
            mimeType: file.mimetype,
            patientId: req.params.patientId,
            userId: req.user.id,
          },
        });
      })
    );
    res.status(201).json(created);
  } catch (e) {
    console.error("[photo upload] db error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

// Serve photo file (token via header or query param)
router.get("/:id/file", async (req, res) => {
  try {
    let userId = null;
    const rawToken = req.headers.authorization?.split(" ")[1] ?? req.query.token;
    if (!rawToken) return res.status(401).json({ error: "Não autorizado" });
    try {
      userId = jwt.verify(rawToken, process.env.JWT_SECRET).id;
    } catch {
      return res.status(401).json({ error: "Token inválido" });
    }

    const photo = await prisma.patientPhoto.findFirst({
      where: { id: req.params.id, userId },
    });
    if (!photo) return res.status(404).json({ error: "Foto não encontrada" });

    if (!(await fileExists(photo.filePath))) return res.status(404).json({ error: "Arquivo não encontrado" });
    const buffer = await getFile(photo.filePath);

    res.setHeader("Content-Type", photo.mimeType || "image/jpeg");
    res.setHeader("Cache-Control", "private, max-age=3600");
    res.end(buffer);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Delete photo
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const photo = await prisma.patientPhoto.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!photo) return res.status(404).json({ error: "Foto não encontrada" });

    await deleteFile(photo.filePath);

    await prisma.patientPhoto.delete({ where: { id: photo.id } });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
