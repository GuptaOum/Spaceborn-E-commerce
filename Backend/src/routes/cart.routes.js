import { Router } from "express";
import {getCart, addToCart, removeFromCart }from "../controller/cart.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.use(verifyJWT); // Secure all cart routes

router.route("/").get(getCart).post(addToCart);
router.route("/:productId").delete(removeFromCart);

export default router;