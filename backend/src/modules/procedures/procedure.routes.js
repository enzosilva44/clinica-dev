import { Router } from "express";

import * as procedureController from "./procedure.controller.js";

import { authMiddleware } from "../../middlewares/auth.middleware.js";

const router = Router();

router.use(authMiddleware);

router.get(
  "/",
  procedureController.findAll
);

router.post(
  "/",
  procedureController.create
);

router.delete(
  "/:id",
  procedureController.remove
);

router.put(
  "/:id",
  procedureController.update
);

export default router;