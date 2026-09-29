import Razorpay from "razorpay";
import crypto from "crypto";
import { Order } from "../models/order.model.js";
import { Payment } from "../models/payment.model.js";
import { Product } from "../models/product.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const getRazorpayInstance = () => {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    throw new ApiError(500, "Razorpay credentials are not configured");
  }

  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
};

// Creates the pending order and Razorpay order together. Product prices and
// stock are read from MongoDB, never trusted from the browser.
const createCheckoutOrder = asyncHandler(async (req, res) => {
  const { items, shippingAddress, discountPercent = 0, courierOption = "delhivery" } = req.body;
  if (!Array.isArray(items) || items.length === 0 || !shippingAddress?.addressLine1 ||
      !shippingAddress?.city || !shippingAddress?.state || !shippingAddress?.pincode) {
    throw new ApiError(400, "Items and a complete shipping address are required");
  }
  if (![0, 5].includes(Number(discountPercent)) || !["bluedart", "delhivery"].includes(courierOption)) {
    throw new ApiError(400, "Invalid discount or shipping option");
  }

  const orderItems = [];
  let subtotal = 0;
  for (const item of items) {
    const quantity = Number(item.quantity);
    if (!item.sku || !Number.isInteger(quantity) || quantity < 1) {
      throw new ApiError(400, "Each item requires a SKU and positive whole quantity");
    }
    const product = await Product.findOne({ sku: item.sku.toUpperCase(), isAvailable: true });
    if (!product || product.stock < quantity) {
      throw new ApiError(400, `Product unavailable or insufficient stock: ${item.sku}`);
    }
    const tierPricing = product.specs?.get?.("tierPricing") || [];
    const matchedTier = tierPricing
      .filter((tier) => quantity >= tier.minQty)
      .sort((a, b) => b.minQty - a.minQty)[0];
    const unitPrice = matchedTier?.price ?? product.price;
    subtotal += unitPrice * quantity;
    orderItems.push({ product: product._id, name: product.name, price: unitPrice, quantity });
  }

  const shippingCost = courierOption === "bluedart" && subtotal < 999 ? 90 : 0;
  const totalAmount = Number((subtotal * (1 - Number(discountPercent) / 100) + shippingCost).toFixed(2));
  const order = await Order.create({
    user: req.user._id,
    items: orderItems,
    shippingAddress: {
      street: [shippingAddress.addressLine1, shippingAddress.addressLine2].filter(Boolean).join(", "),
      city: shippingAddress.city,
      state: shippingAddress.state,
      pincode: shippingAddress.pincode,
      country: "India",
    },
    totalAmount,
    paymentStatus: "PENDING",
  });

  try {
    const razorpayOrder = await getRazorpayInstance().orders.create({
      amount: Math.round(totalAmount * 100), currency: "INR", receipt: `receipt_${order._id}`,
    });
    await Payment.create({
      order: order._id, user: req.user._id, razorpayOrderId: razorpayOrder.id,
      amount: totalAmount, status: "PENDING",
    });
    return res.status(201).json(new ApiResponse(201, {
      orderId: order._id, razorpayOrderId: razorpayOrder.id, amount: razorpayOrder.amount,
      currency: razorpayOrder.currency, keyId: process.env.RAZORPAY_KEY_ID,
    }, "Razorpay checkout initialized"));
  } catch (error) {
    await Order.findByIdAndDelete(order._id);
    throw error;
  }
});

// 1. Create Razorpay Payment Order
const createRazorpayOrder = asyncHandler(async (req, res) => {
  const { orderId } = req.body;

  const order = await Order.findById(orderId);
  if (!order) {
    throw new ApiError(404, "Order not found");
  }

  if (order.user.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "Unauthorized access to order");
  }

  if (order.paymentStatus === "PAID") {
    throw new ApiError(400, "Order is already paid");
  }

  // Razorpay accepts amount in smallest currency sub-unit (e.g. paise for INR)
  const options = {
    amount: Math.round(order.totalAmount * 100),
    currency: "INR",
    receipt: `receipt_${order._id}`,
  };

  const razorpayOrder = await getRazorpayInstance().orders.create(options);

  if (!razorpayOrder) {
    throw new ApiError(500, "Failed to create Razorpay order");
  }

  // Create or update payment log record
  await Payment.findOneAndUpdate(
    { order: order._id },
    {
      order: order._id,
      user: req.user._id,
      razorpayOrderId: razorpayOrder.id,
      amount: order.totalAmount,
      status: "PENDING",
    },
    { upsert: true, new: true }
  );

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        razorpayOrderId: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        keyId: process.env.RAZORPAY_KEY_ID,
      },
      "Razorpay order initialized successfully"
    )
  );
});

// 2. Verify Razorpay Payment Signature
const verifyPayment = asyncHandler(async (req, res) => {
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature, orderId } = req.body;

  if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature || !orderId) {
    throw new ApiError(400, "Payment verification details are incomplete");
  }

  // Generate expected signature using HMAC-SHA256
  const body = razorpayOrderId + "|" + razorpayPaymentId;
  const payment = await Payment.findOne({ razorpayOrderId, user: req.user._id });
  if (!payment || payment.order.toString() !== orderId) {
    throw new ApiError(404, "Payment order not found");
  }

  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(body.toString())
    .digest("hex");

  const expected = Buffer.from(expectedSignature, "hex");
  const received = Buffer.from(razorpaySignature, "hex");
  const isAuthentic = expected.length === received.length && crypto.timingSafeEqual(expected, received);

  if (!isAuthentic) {
    await Payment.findOneAndUpdate(
      { razorpayOrderId, user: req.user._id },
      { status: "FAILED" }
    );
    throw new ApiError(400, "Payment verification failed. Invalid signature.");
  }

  // Update Payment details
  const order = await Order.findOne({ _id: orderId, user: req.user._id });
  if (!order) throw new ApiError(404, "Order not found");
  if (order.paymentStatus === "PAID") {
    return res.status(200).json(new ApiResponse(200, order, "Payment already verified"));
  }

  const razorpay = getRazorpayInstance();
  const gatewayPayment = await razorpay.payments.fetch(razorpayPaymentId);
  if (gatewayPayment.order_id !== razorpayOrderId) throw new ApiError(400, "Payment does not match this order");
  if (gatewayPayment.status === "authorized") {
    await razorpay.payments.capture(razorpayPaymentId, Math.round(order.totalAmount * 100), "INR");
  } else if (gatewayPayment.status !== "captured") {
    throw new ApiError(400, "Payment has not been captured");
  }

  await Payment.findOneAndUpdate(
    { razorpayOrderId, user: req.user._id },
    {
      razorpayPaymentId,
      razorpaySignature,
      status: "SUCCESS",
    }
  );

  // Update Order status
  for (const item of order.items) {
    const result = await Product.updateOne(
      { _id: item.product, stock: { $gte: item.quantity } },
      { $inc: { stock: -item.quantity } }
    );
    if (result.modifiedCount !== 1) throw new ApiError(409, "Stock changed before payment was completed");
  }
  order.paymentStatus = "PAID";
  order.orderStatus = "PROCESSING";
  const updatedOrder = await order.save();

  return res
    .status(200)
    .json(new ApiResponse(200, updatedOrder, "Payment verified successfully"));
});

export { createCheckoutOrder, createRazorpayOrder, verifyPayment };
