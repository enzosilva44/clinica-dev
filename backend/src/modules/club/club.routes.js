import { Router } from "express";
import * as clubController from "./club.controller.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { requireFeature } from "../../middlewares/feature.middleware.js";

const router = Router();
router.use(authMiddleware, requireFeature("clube"));

// Planos
router.get("/plans", clubController.findAllPlans);
router.post("/plans", clubController.createPlan);
router.put("/plans/:id", clubController.updatePlan);
router.delete("/plans/:id", clubController.deletePlan);

// Membros
router.get("/members", clubController.findAllMembers);
router.post("/members", clubController.createMember);
router.patch("/members/:id/status", clubController.updateMemberStatus);

// Aplicações
router.post("/members/:memberId/applications", clubController.registerApplication);
router.delete("/applications/:id", clubController.removeApplication);

// Alertas
router.get("/alerts", clubController.getAlerts);

export default router;
