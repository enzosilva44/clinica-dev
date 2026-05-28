import { Router } from "express";

import * as appointmentController from "./appointment.controller.js";

import { authMiddleware } from "../../middlewares/auth.middleware.js";

const router = Router();

router.use(authMiddleware);

router.get("/", appointmentController.findAll);
router.get("/patient/:patientId", appointmentController.findByPatient);
router.get("/:id", appointmentController.findById);
router.put("/:id", appointmentController.update);
router.post("/", appointmentController.create);

export default router;