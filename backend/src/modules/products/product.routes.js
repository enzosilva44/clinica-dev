import { Router } from "express";
import * as productController from "./product.controller.js";
import * as movementController from "./movement.controller.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";

const router = Router();
router.use(authMiddleware);

router.get("/", productController.findAll);
router.post("/", productController.create);
router.put("/:id", productController.update);
router.delete("/:id", productController.remove);

router.get("/:id/movements", movementController.findByProduct);
router.post("/:id/movements", movementController.create);

export default router;
