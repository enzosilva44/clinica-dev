import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import * as budgetController from "./budget.controller.js";

const router = Router();

router.use(authMiddleware);

router.get("/patient/:patientId", budgetController.findByPatient);
router.post("/", budgetController.create);
router.delete("/:id", budgetController.remove);

export default router;
