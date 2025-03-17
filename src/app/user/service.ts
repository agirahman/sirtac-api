import { PrismaClient } from "@prisma/client";
import { UpdateProfileData, UserDTO, Role } from "./dto";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import { NotFoundError } from "../../error/NotFoundError";
import { BadRequestError } from "../../error/BadRequestError";
import { uploadToS3 } from "../../utils/s3Upload";
import {
  generateAccessToken,
  replaceRefreshToken,
} from "../../utils/tokenUtils";
import { sendVerificationEmail } from "../../utils/emailSender";
const prisma = new PrismaClient();

export const registerUser = async (
  name: string,
  email: string,
  password: string,
  phone: string,
  role: string
) => {
  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: { name, email, password: hashedPassword, role: role as Role, phone },
  });

  const refreshToken = await generateInitialRefreshToken(user.id);

  await sendVerificationEmail(email, refreshToken);

  // simulasi kirim ke email verification
  // console.log(
  //   `Verification Email Link: http://localhost:5000/user/verify-email?token=${refreshToken}`
  // );

  return user;
};

export const verifyEmail = async (token: string) => {
  try {
    const refreshToken = await prisma.refreshToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!refreshToken) {
      return { error: "token_not_found" };
    }

    if (refreshToken.expiresAt < new Date()) {
      return { error: "token_expired" };
    }

    await prisma.user.update({
      where: { id: refreshToken.userId },
      data: { isverified: true },
    });

    const accessToken = generateAccessToken(
      refreshToken.user.id,
      refreshToken.user.email,
      refreshToken.user.role
    );

    return { accessToken };
  } catch (error) {
    console.error("Error verifying email:", error);
    return { error: "verification_failed" };
  }
};

export const loginUser = async (email: string, password: string) => {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new BadRequestError("Invalid email or password");

  const isValidPassword = await bcrypt.compare(password, user.password);
  if (!isValidPassword) throw new BadRequestError("Invalid email or password");

  // Check if user is verified
  if (!user.isverified) {
    throw new BadRequestError("Please verify your email before logging in");
  }

  const accessToken = generateAccessToken(user.id, user.email, user.role);
  const refreshToken = await replaceRefreshToken(user.id);

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

  // await sendPasswordResetEmail(email, token);

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
  const fileUrl = await uploadToS3(userId, file);

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
  const updateData: Partial<UpdateProfileData> = {};

  if (data.name) updateData.name = data.name;

  if (data.password) {
    updateData.password = await bcrypt.hash(data.password, 10);
  }

  return await prisma.user.update({
    where: { id: userId },
    data: updateData,
  });
};

export const updateUserRole = async (
  userId: string,
  newRole: string,
  currentUserId: string
) => {
  if (userId === currentUserId) {
    throw new BadRequestError("You cannot change your own role");
  }

  if (!Object.values(Role).includes(newRole as Role)) {
    throw new BadRequestError("Invalid role");
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new NotFoundError("User not found");

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: { role: newRole as Role },
  });

  return updatedUser;
};

// helpers functions

const validateRole = (role: string) => {
  if (!Object.values(Role).includes(role as Role)) {
    throw new BadRequestError("Invalid role");
  }
};

const generateInitialRefreshToken = async (userId: string) => {
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
