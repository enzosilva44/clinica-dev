import { Router } from "express";
import * as transactionController from "./transaction.controller.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";

const router = Router();
router.use(authMiddleware);

router.get("/", transactionController.findAll);
router.get("/summary", transactionController.getSummary);
router.post("/", transactionController.create);
router.patch("/:id/approve", transactionController.approve);
router.patch("/:id/cancel", transactionController.cancel);
router.delete("/:id", transactionController.remove);

export default router;
