import { Router } from "express";

import * as evolutionController from "./evolution.controller.js";

import { authMiddleware } from "../../middlewares/auth.middleware.js";

const router = Router();

router.use(authMiddleware);

router.post(
  "/",
  evolutionController.create
);

router.get(
  "/patient/:patientId",
  evolutionController.findByPatient
);

export default router;