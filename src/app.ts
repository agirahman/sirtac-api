import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { logger } from "./middleware/logger";
import { errorHandler } from "./middleware/error";
import userController from "./app/user/controller";
import bookController from "./app/book/controller";
import reviewController from "./app/review/controller";
import path from "path";
import "./jobs/corn";

dotenv.config();

const app = express();

// Middleware
app.use(
  cors({
    origin: process.env.NODE_ENV === "production" ? "https://your-production-domain.com" : "http://localhost:3000",
    credentials: true,
  })
);
app.use(express.json());
app.use(logger);
app.use("/uploads", express.static("uploads"));

// Routes
app.use("/user", userController);
app.use("/books", bookController);
app.use("/reviews", reviewController);

// Middleware for error handling
app.use(errorHandler);

export default app;
