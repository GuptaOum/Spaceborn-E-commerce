import { Cart } from "../models/cart.model.js";
import { Product } from "../models/product.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// Fetch current user's cart
const getCart = asyncHandler(async (req, res) => {
  let cart = await Cart.findOne({ user: req.user._id }).populate(
    "items.product",
    "name price images stock category"
  );

  if (!cart) {
    cart = await Cart.create({ user: req.user._id, items: [] });
  }

  return res
    .status(200)
    .json(new ApiResponse(200, cart, "Cart fetched successfully"));
});

// Add or update an item quantity in cart
const addToCart = asyncHandler(async (req, res) => {
  const { productId, quantity = 1 } = req.body;

  if (!productId || quantity <= 0) {
    throw new ApiError(400, "Valid product ID and positive quantity are required");
  }

  const product = await Product.findById(productId);
  if (!product) {
    throw new ApiError(404, "Robotics component not found");
  }

  if (product.stock < quantity) {
    throw new ApiError(400, `Insufficient stock. Only ${product.stock} units available`);
  }

  let cart = await Cart.findOne({ user: req.user._id });

  if (!cart) {
    cart = new Cart({ user: req.user._id, items: [] });
  }

  const itemIndex = cart.items.findIndex(
    (item) => item.product.toString() === productId
  );

  if (itemIndex > -1) {
    const updatedQuantity = cart.items[itemIndex].quantity + Number(quantity);
    if (product.stock < updatedQuantity) {
      throw new ApiError(
        400,
        `Insufficient stock. Only ${product.stock} units available`
      );
    }
    cart.items[itemIndex].quantity = updatedQuantity;
  } else {
    cart.items.push({ product: productId, quantity: Number(quantity) });
  }

  await cart.save();
  await cart.populate("items.product", "name price images stock category");

  return res
    .status(200)
    .json(new ApiResponse(200, cart, "Item added to cart successfully"));
});

// Remove item from cart
const removeFromCart = asyncHandler(async (req, res) => {
  const { productId } = req.params;

  let cart = await Cart.findOne({ user: req.user._id });
  if (!cart) {
    throw new ApiError(404, "Cart not found");
  }

  cart.items = cart.items.filter(
    (item) => item.product.toString() !== productId
  );

  await cart.save();
  await cart.populate("items.product", "name price images stock category");

  return res
    .status(200)
    .json(new ApiResponse(200, cart, "Item removed from cart"));
});

export { getCart, addToCart, removeFromCart };
