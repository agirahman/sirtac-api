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

export const generateEmailVerificationToken = (
  userId: string,
  email: string
) => {
  return jwt.sign(
    { userId, email, purpose: "email_verification" },
    SECRET_KEY,
    { expiresIn: "15m" }
  );
};

export const verifyEmailVerificationToken = (token: string) => {
  try {
    const payload = jwt.verify(token, SECRET_KEY) as {
      userId: string;
      email: string;
      purpose: string;
    };

    if (payload.purpose !== "email_verification") {
      throw new Error("Invalid token purpose");
    }

    return payload;
  } catch (err) {
    throw new Error("Invalid or expired email verification token");
  }
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

export const validateRefreshToken = async (userId: string, token: string) => {
  const existing = await prisma.refreshToken.findUnique({
    where: { userId },
  });
  if (!existing || existing.token !== token) return false;
  if (existing.expiresAt < new Date()) return false;
  return true;
};
