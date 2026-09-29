import mongoose, { Schema } from "mongoose";

const productSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },
    description: {
      type: String,
      required: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    stock: {
      type: Number,
      required: true,
      default: 0,
    },
    category: {
      type: String,
      required: true,
      enum: ["Motors", "Sensors", "Controllers", "Batteries", "Structural", "Accessories"],
    },
    images: [
      {
        type: String,
      },
    ],
    // Dynamic technical parameters (e.g. voltage: "12V", torque: "2.5Nm", protocol: "I2C")
    specs: {
      type: Map,
      of: Schema.Types.Mixed,
      default: {},
    },
    sku: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
    },
    isAvailable: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

export const Product = mongoose.model("Product", productSchema);