import { Router } from "express";
import * as protocolController from "./protocol.controller.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";

const router = Router();
router.use(authMiddleware);

router.get("/", protocolController.findAll);
router.get("/:id", protocolController.findById);
router.post("/", protocolController.create);
router.put("/:id", protocolController.update);
router.delete("/:id", protocolController.remove);

export default router;
