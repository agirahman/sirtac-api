import express, { NextFunction, Request, Response } from "express";
import * as userService from "./service";
import { NotFoundError } from "../../error/NotFoundError";
import { BadRequestError } from "../../error/BadRequestError";
import { authenticateJWT } from "../../middleware/auth";
import { UnauthorizedError } from "../../error/UnauthorizedError";
import { authorizeRoles } from "../../middleware/roleMiddleware";
// import { upload } from "../../middleware/upload";
import multer from "multer";
import { UpdateProfileData, UserPayload } from "./dto";
// import { uploadProfilePictureToDB } from "../../utils/s3Upload";

const router = express.Router();
const upload = multer();

router.post(
  "/register",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, email, password, phone, role } = req.body;
      const newUser = await userService.registerUser(
        name,
        email,
        password,
        phone,
        role
      );
      res.status(201).json({
        message: "User registered successfully",
        user: {
          id: newUser.id,
          name: newUser.name,
          email: newUser.email,
          phone: newUser.phone,
          role: newUser.role,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  "/verify-email",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { token } = req.query;
      console.log("Received token:", req.query);

      if (!token || typeof token !== "string") {
        res.status(400).json({ error: "Invalid token" });
        return;
      }

      const { accessToken, error } = await userService.verifyEmail(
        token as string
      );

      if (error) {
        // For API access, return JSON first
        if (req.headers.accept?.includes("application/json")) {
          res.status(401).json({ error });
          return;
        }
        // For browser access, redirect
        res.redirect(`http://localhost:3000/login?error=${error}`);
        return;
      }

      // For API access
      if (req.headers.accept?.includes("application/json")) {
        res.json({ success: true, accessToken });
        return;
      }

      // For browser access
      return res.redirect(
        `http://localhost:3000/verification-success?token=${accessToken}`
      );
    } catch (error) {
      console.error("Email verification error:", error);
      res.status(500).json({ error: "Verification failed" });
      return;
    }
  }
);

router.post(
  "/login",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password } = req.body;
      const result = await userService.loginUser(email, password);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  "/logout",
  authenticateJWT,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw new UnauthorizedError("Unauthorized");
      }
      await userService.logoutUser(req.user.id);
      res.json({ message: "Logout successful" });
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  "/profile",
  authenticateJWT,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Check if req.user exists
      if (!req.user) {
        res.status(401).json({ message: "Unauthorized" });
        return;
      }

      // Now TypeScript knows req.user is defined
      const userId = req.user.id;

      // Fetch complete user data from database
      const completeUserData = await userService.getUserById(userId);

      res.json({ message: "This is your profile", user: completeUserData });
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  "/admin-dashboard",
  authenticateJWT,
  authorizeRoles("admin"),
  (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({ message: "Welcome to admin dashboard!" });
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  "/",
  // authenticateJWT,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const users = await userService.getUser();
      res.status(200).json(users);
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  "/:id",
  authenticateJWT,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await userService.getUserById(String(req.params.id));
      if (!user) throw new NotFoundError("User not found");
      res.json(user);
    } catch (error) {
      next(error);
    }
  }
);

router.put(
  "/:id",
  authenticateJWT,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Get user ID from JWT token
      const userId = req.user?.id;

      // If user ID from token is missing, return unauthorized
      if (!userId) {
        res.status(401).json({ error: "Unauthorized access" });
        return;
      }

      // Check if user is updating their own profile (important security check)
      if (userId !== req.params.id) {
        res.status(403).json({ error: "You can only update your own profile" });
        return;
      }

      // Extract only the fields we want to update
      const { name, password } = req.body as UpdateProfileData;

      // Validate input data
      if (
        (name !== undefined && name.trim() === "") ||
        (password !== undefined && password.trim() === "")
      ) {
        res.status(400).json({ error: "Invalid input data" });
        return;
      }

      // Update the user profile
      const updatedUser = await userService.updateProfile(userId, {
        name,
        password,
      });

      // Return success response
      res.status(200).json({
        message: "Profile updated successfully",
        user: {
          id: updatedUser.id,
          name: updatedUser.name,
          email: updatedUser.email,
          phone: updatedUser.phone, // Include phone in response
          role: updatedUser.role,
          profilepicture: updatedUser.profilePictureId,
        },
      });
      return;
    } catch (error) {
      next(error);
    }
  }
);

router.delete(
  "/:id",
  authenticateJWT,
  authorizeRoles("SUPERADMIN"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const deletedUser = await userService.deleteUser(String(req.params.id));
      res.json({ message: "User deleted successfully", user: deletedUser });
    } catch (error) {
      next(new NotFoundError("User not found"));
    }
  }
);
router.post(
  "/reset-password",
  async (req: Request, res: Response, next: NextFunction) => {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      res.status(400).json({ error: "Token and newPassword are required" });
      return;
    }
    try {
      await userService.resetPassword(token, newPassword);
      res.json({ message: "Password reset successful" });
    } catch (error: any) {
      console.error("Error in reset-password:", error.message);
      res
        .status(500)
        .json({ error: "Internal Server Error", detail: error.message });
    }
  }
);

router.post(
  "/request-reset-password",
  async (req: Request, res: Response, next: NextFunction) => {
    const { email } = req.body;
    try {
      await userService.requestPasswordReset(email);
      res.json({ message: "Reset password link sent (check console for now)" });
    } catch (error) {
      next(error);
    }
  }
);

// Route handler in userRoutes.js
// In your userRoutes.js file:

router.post(
  "/upload-profile-picture",
  authenticateJWT,
  upload.single("profilePicture"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const file = req.file;
      const userId = (req.user as UserPayload).id;

      if (!file) {
        res.status(400).json({ message: "No file uploaded" });
        return;
      }

      // Add logging to debug upload issues
      console.log(
        `Received file upload request: ${file.originalname}, size: ${file.size}, mimetype: ${file.mimetype} for user: ${userId}`
      );

      // Upload the file and get the fileId
      const fileId = await userService.uploadProfilePicture(userId, file);

      // Return consistent response with fileId
      res.status(201).json({
        message: "Profile picture uploaded successfully",
        fileId: fileId, // Use fileId consistently
      });
    } catch (error) {
      console.error("Profile picture upload error:", error);
      next(error);
    }
  }
);

router.get(
  "/profile-picture/:id",
  authenticateJWT,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      console.log(`Received request for profile picture: ${id}`);

      // Get the user ID from the token
      const userId = (req.user as UserPayload).id;
      console.log(
        `Authenticated user ${userId} requesting profile picture ${id}`
      );

      // Fetch the picture
      const picture = await userService.getProfilePictureById(id);

      // Set appropriate headers
      res.setHeader("Content-Type", picture.mimetype);
      res.setHeader(
        "Content-Disposition",
        `inline; filename="${picture.filename}"`
      );

      // Send the file data
      res.send(picture.file);
    } catch (error) {
      console.error(`Error serving profile picture:`, error);
      next(error);
    }
  }
);

router.patch(
  "/:id/role",
  authenticateJWT,
  authorizeRoles("superadmin"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role } = req.body;

      if (!["user", "admin", "superadmin"].includes(role)) {
        throw new BadRequestError("Invalid role");
      }
      const currentUserId = (req as any).user.id;
      const updatedUser = await userService.updateUserRole(
        String(req.params.id),
        role,
        currentUserId
      );
      res.status(200).json({
        message: "User role updated successfully",
        user: {
          id: updatedUser.id,
          name: updatedUser.name,
          email: updatedUser.email,
          role: updatedUser.role,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
