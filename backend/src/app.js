import "dotenv/config";
import express from "express";
import cors from "cors";
import { authRoutes } from "./modules/auth/auth.routes.js";
import { authMiddleware } from "./middlewares/auth.middleware.js";
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
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.resolve(__dirname, "../uploads");

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use("/uploads", express.static(uploadsDir));
app.use("/auth", authRoutes);
app.use("/patients", patientsRoutes);
app.use("/appointments", appointmentRoutes);
app.use("/evolutions", evolutionRoutes);
app.use("/procedures", procedureRoutes);
app.use("/products", productRoutes);
app.use("/dashboard", dashboardRoutes);
app.use("/financial", transactionRoutes);
app.use("/club", clubRoutes);
app.use("/procedure-maps", procedureMapRoutes);
app.use("/ai", aiRoutes);
app.use("/documents", documentRoutes);
app.use("/budgets", budgetRoutes);
app.use("/reports", reportsRoutes);
app.use("/photos", photoRoutes);
app.use("/automations", automationRoutes);
app.use("/billing", billingRoutes);

app.get("/", (req, res) => {
  res.json({
    ok: true,
  });
});

app.get(
  "/me",
  authMiddleware,
  (req, res) => {
    return res.json(req.user);
  }
);

export { app };
