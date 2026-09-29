import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { ApiError } from "./utils/ApiError.js";

const app = express();

app.get("/health", (_req, res) => {
  res.status(200).json({ success: true, message: "Service is running" });
});

// 1. Common Middlewares
app.use(
  cors({
    // A wildcard cannot be used with credentialed browser requests. Reflect the
    // requesting origin in development when CORS_ORIGIN is set to "*".
    origin: process.env.CORS_ORIGIN === "*" ? true : process.env.CORS_ORIGIN,
    credentials: true,
  })
);

app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(express.static("public"));
app.use(cookieParser());

// 2. Import Central Router
import apiRouter from "./routes/index.js";

// 3. Mount Routes
app.use("/api/v1", apiRouter);

app.use((req, _res, next) => {
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));
});

// 4. Import & Register Global Error Middleware (MUST be last)
import { errorHandler } from "./middlewares/error.middleware.js";

app.use(errorHandler);

export { app };
