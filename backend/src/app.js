import "dotenv/config";
import express from "express";
import cors from "cors";
import { authRoutes } from "./modules/auth/auth.routes.js";
import { prisma } from "./config/prisma.js";
import { authMiddleware } from "./middlewares/auth.middleware.js";
import { requireFeature } from "./middlewares/feature.middleware.js";
import { blockOverdue } from "./middlewares/billing.middleware.js";
import patientsRoutes from "./modules/patients/patient.routes.js";
import appointmentRoutes from "./modules/appointments/appointment.routes.js";
import evolutionRoutes from "./modules/evolutions/evolution.routes.js";
import procedureRoutes from "./modules/procedures/procedure.routes.js";
import productRoutes from "./modules/products/product.routes.js";
import dashboardRoutes from "./modules/dashboard/dashboard.routes.js";
import transactionRoutes from "./modules/financial/transaction.routes.js";
import clubRoutes from "./modules/club/club.routes.js";
import procedureMapRoutes from "./modules/procedure-maps/procedureMap.routes.js";
import aiRoutes from "./modules/ai/ai.routes.js";
import documentRoutes from "./modules/documents/document.routes.js";
import budgetRoutes from "./modules/budgets/budget.routes.js";
import reportsRoutes from "./modules/reports/reports.routes.js";
import photoRoutes from "./modules/photos/photo.routes.js";
import automationRoutes from "./modules/automations/automation.routes.js";
import billingRoutes from "./modules/billing/billing.routes.js";
import adminRoutes from "./modules/admin/admin.routes.js";
import profileRoutes from "./modules/profile/profile.routes.js";
import anamnesisRoutes from "./modules/anamnesis/anamnesis.routes.js";
import portfolioRoutes from "./modules/portfolio/portfolio.routes.js";
import packagesRoutes from "./modules/packages/packages.routes.js";
import protocolRoutes from "./modules/protocols/protocol.routes.js";
import whatsappEmbedRoutes from "./modules/whatsapp-embed/whatsappEmbed.routes.js";
import { verifyWebhook, receiveWebhook } from "./modules/whatsapp-embed/whatsappWebhook.js";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.resolve(__dirname, "../uploads");

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(
  express.json({
    // Guarda o corpo bruto para validar a assinatura HMAC do webhook do WhatsApp.
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use("/uploads", express.static(uploadsDir));
// Bloqueio global por inadimplência (após carência). Isenta /auth /billing
// /profile para a clínica conseguir logar e regularizar o pagamento.
app.use(blockOverdue);
app.use("/auth", authRoutes);
app.use("/patients", patientsRoutes);
app.use("/appointments", appointmentRoutes);
app.use("/evolutions", evolutionRoutes);
app.use("/procedures", procedureRoutes);
app.use("/products", authMiddleware, requireFeature("stock"), productRoutes);
app.use("/dashboard", dashboardRoutes);
app.use("/financial", authMiddleware, requireFeature("financial"), transactionRoutes);
app.use("/club", authMiddleware, requireFeature("clube"), clubRoutes);
app.use("/procedure-maps", authMiddleware, requireFeature("procedureMap"), procedureMapRoutes);
app.use("/ai", authMiddleware, requireFeature("aiAssistant"), aiRoutes);
app.use("/documents", documentRoutes);
app.use("/budgets", budgetRoutes);
app.use("/packages", packagesRoutes);
app.use("/protocols", protocolRoutes);
app.use("/reports", authMiddleware, requireFeature("analytics"), reportsRoutes);
app.use("/photos", photoRoutes);
app.use("/portfolio", authMiddleware, requireFeature("portfolio"), portfolioRoutes);
app.use("/automations", authMiddleware, requireFeature("whatsapp"), automationRoutes);
// Webhook público da Meta (sem authMiddleware — a Meta chama sem nosso token).
app.get("/whatsapp/webhook", verifyWebhook);
app.post("/whatsapp/webhook", receiveWebhook);
// Rotas autenticadas do Embedded Signup (connect/status/disconnect).
app.use("/whatsapp", whatsappEmbedRoutes);
app.use("/billing", billingRoutes);
app.use("/admin", adminRoutes);
app.use("/profile", profileRoutes);
app.use("/anamnesis", anamnesisRoutes);

app.get("/", (req, res) => {
  res.json({
    ok: true,
  });
});

app.get("/health", async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return res.json({ status: "ok", db: "ok" });
  } catch (err) {
    return res.status(503).json({ status: "error", db: "down", message: err.message });
  }
});

app.get(
  "/me",
  authMiddleware,
  (req, res) => {
    return res.json(req.user);
  }
);

export { app };
