import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { requireFeature } from "../../middlewares/feature.middleware.js";
import { listConversations, getConversation, markRead } from "./conversation.controller.js";

const router = Router();
router.use(authMiddleware, requireFeature("whatsapp"));

router.get("/", listConversations);
router.get("/:id", getConversation);
router.post("/:id/read", markRead);

export default router;
