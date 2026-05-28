import { Router } from "express";
import * as mapController from "./procedureMap.controller.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";

const router = Router();
router.use(authMiddleware);

router.get("/patient/:patientId", mapController.findByPatient);
router.get("/:id", mapController.findById);
router.post("/patient/:patientId", mapController.create);
router.put("/:id", mapController.update);
router.delete("/:id", mapController.remove);

export default router;
