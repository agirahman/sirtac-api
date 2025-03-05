import { PrismaClient } from "@prisma/client";
import { UpdateProfileData, UserDTO } from "./dto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import { NotFoundError } from "../../error/NotFoundError";
import { BadRequestError } from "../../error/BadRequestError";
import nodemailer from "nodemailer";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { s3Client } from "../../utils/s3";

const prisma = new PrismaClient();
const SECRET_KEY = process.env.JWT_SECRET || "secretkey";

export const registerUser = async (
  name: string,
  email: string,
  password: string,
  role: string
) => {
  const hashedPassword = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      name,
      email,
      password: hashedPassword,
      role,
    },
  });
  const token = uuidv4();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24);
  await prisma.refreshToken.create({
    data: {
      token,
      userId: user.id,
      expiresAt,
    },
  });

  // Simulasi kirim email (pakai console.log dulu)
  const verificationLink = `http://localhost:5000/user/verify-email?token=${token}`;
  console.log(`Verification Email Link: ${verificationLink}`);

  return user;
};

export const loginUser = async (email: string, password: string) => {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new BadRequestError("Invalid Email or password");
  }

  const isValidPassword = await bcrypt.compare(password, user.password);
  if (!isValidPassword) {
    throw new BadRequestError("Email atau password salah");
  }

  // Generate Access Token (JWT)
  const accessToken = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    SECRET_KEY,
    {
      expiresIn: "15m", // 15 menit biar lebih aman
    }
  );

  // Generate Refresh Token
  const refreshToken = jwt.sign({ id: user.id }, SECRET_KEY, {
    expiresIn: "7d", // 7 hari
  });

  // Hapus refresh token lama (jika ada)
  await prisma.refreshToken.deleteMany({ where: { userId: user.id } });

  // Simpan refresh token baru
  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      token: refreshToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 hari
    },
  });

  return {
    accessToken,
    refreshToken,
    user: { id: user.id, name: user.name, email: user.email },
  };
};

export const getUser = async () => {
  return await prisma.user.findMany();
};

export const getUserById = async (id: string) => {
  return await prisma.user.findUnique({ where: { id } });
};

export const createUser = async (data: UserDTO) => {
  return await prisma.user.create({ data });
};

export const deleteUser = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new Error("User not found");
  }

  await prisma.user.delete({
    where: { id: userId },
  });

  return { message: "User deleted successfully" };
};

export const logoutUser = async (userId: string) => {
  await prisma.refreshToken.deleteMany({ where: { userId } });
};

export const requestPasswordReset = async (email: string) => {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new NotFoundError("User not found");
  }
  const token = uuidv4();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  await prisma.refreshToken.upsert({
    where: { userId: user.id },
    update: { token, expiresAt },
    create: { userId: user.id, token, expiresAt },
  });

  // Simulasi kirim email
  console.log(
    `Link reset password: http://localhost:5000/user/reset-password?token=${token}`
  );
};

export const resetPassword = async (token: string, newPassword: string) => {
  const resetToken = await prisma.refreshToken.findUnique({ where: { token } });

  if (!resetToken || resetToken.expiresAt < new Date()) {
    throw new BadRequestError("Token expired");
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);

  await prisma.user.update({
    where: { id: resetToken.userId },
    data: { password: hashedPassword },
  });

  // Hapus token setelah digunakan
  await prisma.refreshToken.delete({ where: { token } });
};

export const uploadProfilePicture = async (
  userId: string,
  file: Express.Multer.File
) => {
  const fileExtension = file.originalname.split(".").pop();
  const fileName = `profile-picture/${userId}-${uuidv4()}.${fileExtension}`;

  const uploadParams = {
    Bucket: process.env.AWS_S3_BUCKET_NAME!,
    Key: fileName,
    Body: file.buffer,
    ContentType: file.mimetype,
  };

  await s3Client.send(new PutObjectCommand(uploadParams));

  const fileUrl = `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;

  await prisma.user.update({
    where: { id: userId },
    data: { profilepicture: fileUrl },
  });

  return fileUrl;
};

export const updateProfile = async (
  userId: string,
  data: UpdateProfileData
) => {
  const updateData: any = {};

  if (data.name) {
    updateData.name = data.name;
  }

  if (data.password) {
    const hashedPassword = await bcrypt.hash(data.password, 10);
    updateData.password = hashedPassword;
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: updateData,
  });

  return updatedUser;
};
