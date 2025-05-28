import { PrismaClient } from "@prisma/client";
import { UpdateProfileData, Role, FileUpload, ContactFormRequest } from "./dto";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import { NotFoundError } from "../../error/NotFoundError";
import { BadRequestError } from "../../error/BadRequestError";
import * as fs from "fs"; // Add this import
// import { uploadToS3 } from "../../utils/s3Upload";
import {
  generateAccessToken,
  generateEmailVerificationToken,
  replaceRefreshToken,
  verifyEmailVerificationToken,
} from "../../utils/tokenUtils";
import {
  sendContactFormEmail,
  sendPasswordResetEmail,
  sendVerificationEmail,
} from "../../utils/emailSender";
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
    data: {
      name,
      email,
      password: hashedPassword,
      phone,
      role: role as Role,
    },
  });

  const verificationToken = generateEmailVerificationToken(user.id, user.email);

  await sendVerificationEmail(email, verificationToken);

  // Simulasi kirim email
  console.log(
    `Verification Email Link: http://localhost:5000/user/verify-email?token=${verificationToken}`
  );

  return user;
};

export const verifyEmail = async (token: string) => {
  try {
    const payload = verifyEmailVerificationToken(token);

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    });

    if (!user) {
      return { error: "user_not_found" };
    }

    if (user.isverified) {
      return { message: "User already verified" };
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { isverified: true },
    });

    const accessToken = generateAccessToken(user.id, user.email, user.role);

    return {
      message: "Email verification successful",
      accessToken,
    };
  } catch (error) {
    console.error("Email verification error:", error);
    return { error: "verification_failed_or_expired" };
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

export const processContactForm = async (
  formData: ContactFormRequest
): Promise<void> => {
  const { name, email, message } = formData;
  const recipientEmail = process.env.SMTP_FROM || "admin@example.com";

  await sendContactFormEmail(recipientEmail, name, email, message);
};

export const getUser = async () => {
  return await prisma.user.findMany();
};

export const getUserById = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      profilePictureId: true,
      isverified: true,
      createdAt: true,
      updateAt: true,
    },
  });

  if (!user) {
    throw new NotFoundError("User not found");
  }

  return user;
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

  await sendPasswordResetEmail(email, token);

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

/// In your service.ts file:

export async function uploadProfilePicture(userId: string, file: FileUpload) {
  try {
    // Create a new profile picture record in the database
    const profilePicture = await prisma.profilePicture.create({
      data: {
        userId: userId,
        filename: file.originalname,
        mimetype: file.mimetype,
        file: Buffer.from(file.buffer), // Ensure it's a Buffer
        size: file.buffer.length,
        uploadedAt: new Date(),
      },
    });

    // Update user's profile picture reference
    await prisma.user.update({
      where: { id: userId },
      data: { profilePictureId: profilePicture.id },
    });

    return profilePicture.id;
  } catch (error) {
    console.error("Error uploading profile picture:", error);
    throw error;
  }
}

export async function getProfilePictureById(pictureId: string) {
  const picture = await prisma.profilePicture.findUnique({
    where: { id: pictureId },
    select: {
      id: true,
      userId: true,
      filename: true,
      mimetype: true,
      file: true,
    },
  });

  if (!picture) {
    throw new Error("Profile picture not found");
  }

  return picture;
}
// Add a utility function to get profile picture by user ID
export const getProfilePictureByUserId = async (userId: string) => {
  try {
    const picture = await prisma.profilePicture.findUnique({
      where: { userId },
    });

    if (!picture) {
      throw new NotFoundError(`No profile picture found for user: ${userId}`);
    }

    return picture;
  } catch (error) {
    console.error(`Error fetching profile picture for user ${userId}:`, error);
    throw error;
  }
};
export const updateUserRole = async (
  userId: string,
  newRole: string,
  currentUserId: string
) => {
  if (userId === currentUserId) {
    throw new BadRequestError("You cannot change your own role");
  }

  // Normalize role to uppercase for consistent storage
  const normalizedRole = newRole.toUpperCase();

  // Check if the normalized role is valid
  if (!Object.values(Role).includes(normalizedRole as Role)) {
    throw new BadRequestError(`Invalid role: ${newRole}`);
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new NotFoundError("User not found");

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: { role: normalizedRole as Role },
  });

  return updatedUser;
};

export const updateProfile = async (
  userId: string,
  data: UpdateProfileData
) => {
  const updateData: Partial<UpdateProfileData> = {};

  if (data.name) updateData.name = data.name;
  if (data.phone) updateData.phone = data.phone; // Added phone update
  if (data.password) {
    updateData.password = await bcrypt.hash(data.password, 10);
  }

  return await prisma.user.update({
    where: { id: userId },
    data: updateData,
  });
};
