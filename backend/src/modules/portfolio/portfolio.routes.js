import { Router } from "express";
import { prisma } from "../../config/prisma.js";

// authMiddleware + requireFeature("portfolio") são aplicados no app.js.
const router = Router();

// Vitrine: lista os cases salvos (favoritos primeiro, depois mais recentes).
router.get("/", async (req, res) => {
  try {
    const cases = await prisma.portfolioCase.findMany({
      where: { userId: req.user.id },
      orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
      include: { patient: { select: { id: true, name: true } } },
    });
    res.json(cases);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Cria um case a partir de um par de fotos antes/depois.
router.post("/", async (req, res) => {
  try {
    const { patientId, beforePhotoId, afterPhotoId, devicePhotoId, title, procedureName, caption, featured } = req.body;
    if (!patientId || !beforePhotoId || !afterPhotoId) {
      return res.status(400).json({ error: "Paciente e as duas fotos (antes/depois) são obrigatórios." });
    }
    // Garante que as fotos pertencem a esse usuário/paciente.
    const photos = await prisma.patientPhoto.findMany({
      where: { id: { in: [beforePhotoId, afterPhotoId] }, userId: req.user.id, patientId },
      select: { id: true },
    });
    if (photos.length !== 2) {
      return res.status(400).json({ error: "Fotos inválidas para este paciente." });
    }
    const created = await prisma.portfolioCase.create({
      data: {
        patientId,
        beforePhotoId,
        afterPhotoId,
        devicePhotoId: devicePhotoId || null,
        title: title?.trim() || null,
        procedureName: procedureName?.trim() || null,
        caption: caption?.trim() || null,
        featured: featured === true,
        userId: req.user.id,
      },
      include: { patient: { select: { id: true, name: true } } },
    });
    res.status(201).json(created);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Atualiza metadados do case (título, legenda, procedimento, destaque).
router.put("/:id", async (req, res) => {
  try {
    const existing = await prisma.portfolioCase.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!existing) return res.status(404).json({ error: "Case não encontrado." });

    const { title, procedureName, caption, featured } = req.body;
    const updated = await prisma.portfolioCase.update({
      where: { id: req.params.id },
      data: {
        ...(title !== undefined ? { title: title?.trim() || null } : {}),
        ...(procedureName !== undefined ? { procedureName: procedureName?.trim() || null } : {}),
        ...(caption !== undefined ? { caption: caption?.trim() || null } : {}),
        ...(featured !== undefined ? { featured: featured === true } : {}),
      },
      include: { patient: { select: { id: true, name: true } } },
    });
    res.json(updated);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const existing = await prisma.portfolioCase.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!existing) return res.status(404).json({ error: "Case não encontrado." });
    await prisma.portfolioCase.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

export default router;
