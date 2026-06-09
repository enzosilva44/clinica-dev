import { Router } from "express";
import bcrypt from "bcryptjs";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { prisma } from "../../config/prisma.js";

const router = Router();
router.use(authMiddleware);

// ── busca perfil completo ─────────────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true, name: true, email: true, role: true, plan: true,
        nickname: true, gender: true, phone: true,
        cpf: true, cnpj: true, rg: true, birthDate: true, personType: true,
        clinicName: true, specialty: true, professionalId: true,
        street: true, addressNumber: true, complement: true,
        neighborhood: true, city: true, state: true, zipCode: true,
        cardBrand: true, cardLast4: true, cardHolderName: true, cardExpiry: true,
        avatarUrl: true, authProvider: true, createdAt: true,
      },
    });
    if (!user) return res.status(404).json({ error: "Usuário não encontrado." });
    res.json(user);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── atualiza dados pessoais / clínica / endereço ──────────────────────────────
router.patch("/", async (req, res) => {
  try {
    const allowed = [
      "name", "nickname", "gender", "phone",
      "cpf", "cnpj", "rg", "birthDate", "personType",
      "clinicName", "specialty", "professionalId",
      "street", "addressNumber", "complement",
      "neighborhood", "city", "state", "zipCode",
      "cardBrand", "cardLast4", "cardHolderName", "cardExpiry",
    ];
    const data = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        data[key] = key === "birthDate" && req.body[key]
          ? new Date(req.body[key])
          : req.body[key] || null;
      }
    }
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data,
      select: {
        id: true, name: true, nickname: true, gender: true, phone: true,
        clinicName: true, specialty: true, plan: true,
      },
    });
    res.json(user);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── troca de senha ────────────────────────────────────────────────────────────
router.patch("/password", async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword)
      return res.status(400).json({ error: "Informe a senha atual e a nova." });
    if (newPassword.length < 6)
      return res.status(400).json({ error: "Nova senha deve ter ao menos 6 caracteres." });

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    const match = await bcrypt.compare(currentPassword, user.password);
    if (!match) return res.status(400).json({ error: "Senha atual incorreta." });

    const hash = await bcrypt.hash(newPassword, 8);
    await prisma.user.update({ where: { id: req.user.id }, data: { password: hash } });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;
