import { Product } from "../models/product.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const PRODUCT_CATEGORIES = [
  "Motors", "Sensors", "Controllers", "Batteries", "Structural", "Accessories",
];

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const positiveInteger = (value, fallback, maximum) => {
  const parsed = Number(value ?? fallback);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > maximum) {
    throw new ApiError(400, `Value must be an integer between 1 and ${maximum}`);
  }
  return parsed;
};

const createProduct = asyncHandler(async (req, res) => {
  const { name, slug, description, price, stock, category, sku, specs, images } = req.body;

  if ([name, slug, description, category, sku].some((field) => !field?.trim())) {
    throw new ApiError(400, "All required product fields must be provided");
  }
  if (!PRODUCT_CATEGORIES.includes(category)) {
    throw new ApiError(400, "Invalid product category");
  }
  if (!Number.isFinite(Number(price)) || Number(price) < 0) {
    throw new ApiError(400, "Price must be a non-negative number");
  }
  if (!Number.isInteger(Number(stock)) || Number(stock) < 0) {
    throw new ApiError(400, "Stock must be a non-negative integer");
  }

  const existingProduct = await Product.findOne({ $or: [{ slug }, { sku }] });
  if (existingProduct) {
    throw new ApiError(409, "Product with this slug or SKU already exists");
  }

  const product = await Product.create({
    name, slug, description, price: Number(price), stock: Number(stock), category, sku,
    specs: specs || {}, images: Array.isArray(images) ? images : [],
  });

  return res.status(201).json(
    new ApiResponse(201, product, "Product created successfully")
  );
});

const updateProduct = asyncHandler(async (req, res) => {
  const { name, slug, description, price, stock, category, sku, specs, images, isAvailable } = req.body;

  if ([name, slug, description, category, sku].some((field) => typeof field !== "string" || !field.trim())) {
    throw new ApiError(400, "Name, slug, description, category, and SKU are required");
  }
  if (!PRODUCT_CATEGORIES.includes(category)) throw new ApiError(400, "Invalid product category");
  if (!Number.isFinite(Number(price)) || Number(price) < 0) throw new ApiError(400, "Price must be a non-negative number");
  if (!Number.isInteger(Number(stock)) || Number(stock) < 0) throw new ApiError(400, "Stock must be a non-negative integer");

  const duplicate = await Product.findOne({
    _id: { $ne: req.params.id },
    $or: [{ slug: slug.trim().toLowerCase() }, { sku: sku.trim().toUpperCase() }],
  });
  if (duplicate) throw new ApiError(409, "Another product already uses this slug or SKU");

  const product = await Product.findByIdAndUpdate(
    req.params.id,
    {
      name: name.trim(), slug: slug.trim().toLowerCase(), description: description.trim(),
      price: Number(price), stock: Number(stock), category, sku: sku.trim().toUpperCase(),
      specs: specs || {}, images: Array.isArray(images) ? images : [],
      isAvailable: isAvailable !== false,
    },
    { new: true, runValidators: true },
  );
  if (!product) throw new ApiError(404, "Product not found");

  return res.status(200).json(new ApiResponse(200, product, "Product updated successfully"));
});

const searchAndFilterProducts = asyncHandler(async (req, res) => {
  const { query, category, minPrice, maxPrice, sortBy = "newest" } = req.query;
  const page = positiveInteger(req.query.page, 1, 100000);
  const limit = positiveInteger(req.query.limit, 10, 100);
  const filter = { isAvailable: true };

  if (query?.trim()) {
    const pattern = new RegExp(escapeRegExp(query.trim()), "i");
    filter.$or = [{ name: pattern }, { description: pattern }];
  }

  if (category) {
    if (!PRODUCT_CATEGORIES.includes(category)) {
      throw new ApiError(400, "Invalid product category");
    }
    filter.category = category;
  }

  if (minPrice !== undefined || maxPrice !== undefined) {
    const minimum = minPrice === undefined ? undefined : Number(minPrice);
    const maximum = maxPrice === undefined ? undefined : Number(maxPrice);
    if ((minimum !== undefined && (!Number.isFinite(minimum) || minimum < 0)) ||
        (maximum !== undefined && (!Number.isFinite(maximum) || maximum < 0)) ||
        (minimum !== undefined && maximum !== undefined && minimum > maximum)) {
      throw new ApiError(400, "Invalid price range");
    }
    filter.price = {};
    if (minimum !== undefined) filter.price.$gte = minimum;
    if (maximum !== undefined) filter.price.$lte = maximum;
  }

  for (const [key, value] of Object.entries(req.query)) {
    if (key.startsWith("spec_") && key.length > 5 && typeof value === "string") {
      filter[`specs.${key.slice(5)}`] = new RegExp(`^${escapeRegExp(value)}$`, "i");
    }
  }

  const sortOptions = {
    newest: { createdAt: -1 },
    price_asc: { price: 1 },
    price_desc: { price: -1 },
  };
  if (!sortOptions[sortBy]) {
    throw new ApiError(400, "sortBy must be newest, price_asc, or price_desc");
  }

  const [products, totalResults] = await Promise.all([
    Product.find(filter).sort(sortOptions[sortBy]).skip((page - 1) * limit).limit(limit),
    Product.countDocuments(filter),
  ]);

  return res.status(200).json(new ApiResponse(200, {
    products,
    pagination: {
      currentPage: page,
      totalPages: Math.ceil(totalResults / limit),
      totalResults,
      limit,
    },
  }, "Products searched and filtered successfully"));
});

const listAdminProducts = asyncHandler(async (_req, res) => {
  const products = await Product.find().sort({ createdAt: -1 });
  return res.status(200).json(new ApiResponse(200, { products }, "Product catalog loaded"));
});

export { createProduct, updateProduct, searchAndFilterProducts, listAdminProducts };
