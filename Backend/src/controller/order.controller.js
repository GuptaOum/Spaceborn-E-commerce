import { Order } from "../models/order.model.js";
import { Cart } from "../models/cart.model.js";
import { Product } from "../models/product.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// Place order from active cart
const createOrder = asyncHandler(async (req, res) => {
  const { shippingAddress } = req.body;

  if (
    !shippingAddress ||
    !shippingAddress.street ||
    !shippingAddress.city ||
    !shippingAddress.state ||
    !shippingAddress.pincode
  ) {
    throw new ApiError(400, "Complete shipping address is required");
  }

  const cart = await Cart.findOne({ user: req.user._id }).populate("items.product");

  if (!cart || cart.items.length === 0) {
    throw new ApiError(400, "Your cart is empty");
  }

  let totalAmount = 0;
  const orderItems = [];

  // Verify stock availability and prepare order snapshot
  for (const item of cart.items) {
    const product = item.product;

    if (!product) {
      throw new ApiError(404, "One or more products in your cart no longer exist");
    }

    if (product.stock < item.quantity) {
      throw new ApiError(
        400,
        `Not enough stock for ${product.name}. Available: ${product.stock}`
      );
    }

    totalAmount += product.price * item.quantity;
    orderItems.push({
      product: product._id,
      name: product.name,
      price: product.price,
      quantity: item.quantity,
    });
  }

  // Create Order document
  const order = await Order.create({
    user: req.user._id,
    items: orderItems,
    shippingAddress,
    totalAmount,
  });

  // Deduct inventory stock for each purchased product
  for (const item of cart.items) {
    await Product.findByIdAndUpdate(item.product._id, {
      $inc: { stock: -item.quantity },
    });
  }

  // Clear user's cart
  cart.items = [];
  await cart.save();

  return res
    .status(201)
    .json(new ApiResponse(201, order, "Order placed successfully"));
});

// Fetch user order history
const getMyOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 });

  return res
    .status(200)
    .json(new ApiResponse(200, orders, "Order history retrieved successfully"));
});

export { createOrder, getMyOrders };