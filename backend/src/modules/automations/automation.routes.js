import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { getTemplates, saveTemplate, getLogs, triggerManual, notifyCustom } from "./automation.controller.js";

const router = Router();
router.use(authMiddleware);

router.get("/templates", getTemplates);
router.put("/templates/:type", saveTemplate);
router.get("/logs", getLogs);
router.post("/trigger/:type", triggerManual);
router.post("/notify", notifyCustom);

export default router;
