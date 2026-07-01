import { Router } from "express";
import * as productController from "./product.controller.js";
import * as movementController from "./movement.controller.js";
import * as stockRequestController from "./stockRequest.controller.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { requireFeature } from "../../middlewares/feature.middleware.js";

const router = Router();
router.use(authMiddleware, requireFeature("stock"));

router.get("/", productController.findAll);
router.post("/", productController.create);
router.put("/:id", productController.update);
router.delete("/:id", productController.remove);

// rotas especiais antes de /:id para não conflitar
router.get("/low-stock", productController.findLowStock);

// extrato global (antes das rotas /:id para não conflitar)
router.get("/movements/all", movementController.findAll);

// solicitações de estoque
router.get("/stock-requests", stockRequestController.findAll);
router.post("/stock-requests", stockRequestController.create);
router.patch("/stock-requests/:id/approve", stockRequestController.approve);
router.patch("/stock-requests/:id/reject", stockRequestController.reject);

// movimentações por produto
router.get("/:id/movements", movementController.findByProduct);
router.post("/:id/movements", movementController.create);

export default router;
