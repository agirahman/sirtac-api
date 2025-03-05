import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { logger } from "./middleware/logger";
import { errorHandler } from "./middleware/error";
import userController from "./app/user/controller";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(logger);

// Route dasar
// app.use("/users", userRoutes);
app.use("/users", userController);

// middleware untuk menangani route yang tidak ditemukan

// middleware untuk menangani error
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server running on port http://localhost:${PORT}`);
});
