import { PrismaClient } from "@prisma/client";
import { UpdateProfileData, UserDTO, Role } from "./dto";
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

export const uploadProfilePicture = async (
  userId: string,
  file: Express.Multer.File
): Promise<string> => {
  try {
    // Validate file type
    const allowedMimeTypes = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
    ];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestError("Only image files are allowed");
    }

    // Read file to buffer (if not already)
    const fileBuffer = file.buffer || (await fs.promises.readFile(file.path));

    // First check if user already has a profile picture
    const existingPicture = await prisma.profilePicture.findUnique({
      where: {
        userId: userId,
      },
    });

    let picture;

    if (existingPicture) {
      // If user already has a profile picture, update it
      picture = await prisma.profilePicture.update({
        where: {
          userId: userId,
        },
        data: {
          filename: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
          file: Buffer.from(fileBuffer), // Convert to Buffer explicitly
        },
      });
    } else {
      // If no existing picture, create a new one
      picture = await prisma.profilePicture.create({
        data: {
          userId: userId,
          filename: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
          file: Buffer.from(fileBuffer), // Convert to Buffer explicitly
        },
      });
    }

    // Important: Update the user's profilePictureId in the user table
    await prisma.user.update({
      where: { id: userId },
      data: { profilePictureId: picture.id },
    });

    console.log(
      `Profile picture uploaded with ID: ${picture.id} for user: ${userId}`
    );

    // Return the picture ID
    return picture.id;
  } catch (error) {
    console.error("Error in uploadProfilePicture service:", error);
    throw error;
  }
};

export const getProfilePictureById = async (id: string) => {
  try {
    console.log(`Fetching profile picture with ID: ${id}`);

    const picture = await prisma.profilePicture.findUnique({
      where: { id },
    });

    if (!picture) {
      console.error(`Profile picture not found with ID: ${id}`);
      throw new NotFoundError(`Profile picture not found with ID: ${id}`);
    }

    console.log(
      `Found profile picture: ${picture.filename}, size: ${picture.size}`
    );
    return picture;
  } catch (error) {
    console.error(`Error fetching profile picture with ID ${id}:`, error);
    throw error;
  }
};

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
