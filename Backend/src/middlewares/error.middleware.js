import mongoose from "mongoose";
import { ApiError } from "../utils/ApiError.js";

const errorHandler = (err, req, res, next) => {
  let error = err;

  // If the error isn't an instance of our custom ApiError, standardize it
  if (!(error instanceof ApiError)) {
    const statusCode =
      error.statusCode || (error instanceof mongoose.Error ? 400 : 500);

    const message = error.message || "Something went wrong on the server";

    error = new ApiError(
      statusCode,
      message,
      error?.errors || [],
      err.stack
    );
  }

  // Build uniform error payload
  const response = {
    statusCode: error.statusCode,
    message: error.message,
    errors: error.errors,
    data: null,
    success: false,
    ...(process.env.NODE_ENV === "development" && { stack: error.stack }),
  };

  return res.status(error.statusCode).json(response);
};

export { errorHandler };