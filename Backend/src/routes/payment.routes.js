import { Router } from "express";
import {
  createCheckoutOrder,
  createRazorpayOrder,
  verifyPayment,
} from "../controller/payment.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.use(verifyJWT); // Secure payment routes

router.post("/checkout-order", createCheckoutOrder);
router.post("/create-order", createRazorpayOrder);
router.post("/verify", verifyPayment);

export default router;
