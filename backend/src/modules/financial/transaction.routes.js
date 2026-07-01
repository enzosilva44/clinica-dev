import { Router } from "express";
import * as transactionController from "./transaction.controller.js";
import * as cardFeeController from "./cardFee.controller.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { requireFeature } from "../../middlewares/feature.middleware.js";

const router = Router();
router.use(authMiddleware, requireFeature("financial"));

// Taxas de maquininha de cartão
router.get("/card-fees",        cardFeeController.list);
router.post("/card-fees",       cardFeeController.create);
router.put("/card-fees/:id",    cardFeeController.update);
router.delete("/card-fees/:id", cardFeeController.remove);

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
