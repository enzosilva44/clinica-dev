import { Router } from "express";
import * as packagesController from "./packages.controller.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";

const router = Router();
router.use(authMiddleware);

router.get("/overview", packagesController.getOverview);

export default router;
