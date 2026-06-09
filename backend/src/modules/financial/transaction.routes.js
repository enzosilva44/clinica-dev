import { Router } from "express";
import * as transactionController from "./transaction.controller.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";

const router = Router();
router.use(authMiddleware);

router.get("/summary",   transactionController.getSummary);
router.get("/analytics", transactionController.getAnalytics);
router.get("/upcoming",  transactionController.getUpcoming);
router.get("/",          transactionController.findAll);
router.post("/",         transactionController.create);
router.put("/:id",       transactionController.update);
router.patch("/:id/approve", transactionController.approve);
router.patch("/:id/cancel",  transactionController.cancel);
router.delete("/:id",    transactionController.remove);

export default router;
