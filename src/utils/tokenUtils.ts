import { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";

const prisma = new PrismaClient();
const SECRET_KEY = process.env.JWT_SECRET || "secretkey";

export const generateAccessToken = (
  userId: string,
  email: string,
  role: string
) => {
  return jwt.sign({ id: userId, email, role }, SECRET_KEY, {
    expiresIn: "15m",
  });
};

export const generateRefreshToken = async (userId: string) => {
  const token = uuidv4();
  await prisma.refreshToken.create({
    data: {
      userId,
      token,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });
  return token;
};

export const replaceRefreshToken = async (userId: string) => {
  await prisma.refreshToken.deleteMany({ where: { userId } });
  return generateRefreshToken(userId);
};
