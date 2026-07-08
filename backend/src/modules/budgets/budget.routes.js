import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import * as budgetController from "./budget.controller.js";

const router = Router();

router.use(authMiddleware);

router.get("/patient/:patientId", budgetController.findByPatient);
router.post("/", budgetController.create);
router.patch("/:id/status", budgetController.updateStatus);
router.delete("/:id", budgetController.remove);

// Sessões (pacotes de orçamento aprovado)
router.post("/items/:itemId/sessions", budgetController.registerSession);
router.delete("/sessions/:id", budgetController.removeSession);

export default router;
