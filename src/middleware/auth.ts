import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
const SECRET_KEY = process.env.JWT_SECRET || "secretkey";

const prisma = new PrismaClient();

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; role: string };
    }
  }
}

export const authenticateJWT = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, SECRET_KEY) as {
      id: string;
      role: string;
    };

    const refreshToken = await prisma.refreshToken.findUnique({
      where: { userId: decoded.id },
    });

    if (!refreshToken) {
      res.status(401).json({ error: "Session expired. Please login again." });
      return;
    }

    req.user = { id: decoded.id, role: decoded.role || "user" };
    next();
  } catch (error) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }
};
