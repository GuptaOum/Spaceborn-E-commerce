import { Router } from "express";
import { createOrder, getMyOrders } from "../controller/order.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.use(verifyJWT); // Secure all order routes

router.route("/").post(createOrder).get(getMyOrders);

export default router;