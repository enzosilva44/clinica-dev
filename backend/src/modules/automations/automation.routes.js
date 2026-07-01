import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { requireFeature } from "../../middlewares/feature.middleware.js";
import { getTemplates, saveTemplate, getLogs, triggerManual, notifyCustom, getWhatsappConfig, saveWhatsappConfig, testWhatsapp, getUsageStats } from "./automation.controller.js";

const router = Router();
router.use(authMiddleware, requireFeature("whatsapp"));

router.get("/templates", getTemplates);
router.put("/templates/:type", saveTemplate);
router.get("/logs", getLogs);
router.post("/trigger/:type", triggerManual);
router.post("/notify", notifyCustom);
router.get("/whatsapp-config", getWhatsappConfig);
router.put("/whatsapp-config", saveWhatsappConfig);
router.post("/whatsapp-test", testWhatsapp);
router.get("/usage-stats", getUsageStats);

export default router;
