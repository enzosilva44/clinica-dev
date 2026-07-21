import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { requireFeature } from "../../middlewares/feature.middleware.js";
import { connect, status, disconnect } from "./whatsappEmbed.controller.js";

const router = Router();
router.use(authMiddleware, requireFeature("whatsapp"));

router.post("/connect", connect);
router.get("/status", status);
router.post("/disconnect", disconnect);

export default router;
