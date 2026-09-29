import { Router } from "express";
import authRouter from "./auth.routes.js";
import productRouter from "./product.routes.js";
import cartRouter from "./cart.routes.js";
import orderRouter from "./order.routes.js";
import paymentRouter from "./payment.routes.js";

const router = Router();

router.use("/auth", authRouter);
router.use("/products", productRouter);
router.use("/cart", cartRouter);
router.use("/orders", orderRouter);
router.use("/payment", paymentRouter);

export default router;