import { Router } from "express";
import {
  createProduct,
  searchAndFilterProducts,
  updateProduct,
  listAdminProducts,
} from "../controller/product.controller.js";
import { verifyAdmin, verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.get("/", searchAndFilterProducts);
router.get("/manage", verifyJWT, verifyAdmin, listAdminProducts);
router.post("/", verifyJWT, verifyAdmin, createProduct);
router.patch("/:id", verifyJWT, verifyAdmin, updateProduct);

export default router;
