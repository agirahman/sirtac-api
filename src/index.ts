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
const PORT = process.env.PORT || 5000;

// Middleware
app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
  })
);
app.use(express.json());
app.use(logger);
app.use("/uploads", express.static("uploads"));

// app.use(authenticateJWT);
// Route dasar
// app.use("/users", userRoutes);
app.use("/user", userController);
app.use("/books", bookController);
app.use("/reviews", reviewController);

// middleware untuk menangani route yang tidak ditemukan

// middleware untuk menangani error
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server running on port http://localhost:${PORT}`);
});
