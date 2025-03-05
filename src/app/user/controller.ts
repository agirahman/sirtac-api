import express, { NextFunction, Request, Response } from "express";
import * as userService from "./service";
import { userSchema } from "./schema";
import { NotFoundError } from "../../error/NotFoundError";
import { BadRequestError } from "../../error/BadRequestError";
import { authenticateJWT } from "../../middleware/auth";
import { UnauthorizedError } from "../../error/UnauthorizedError";
import { authorizeRoles } from "../../middleware/roleMiddleware";
import { upload } from "../../middleware/upload";
import { UpdateProfileData } from "./dto";

const router = express.Router();

router.post(
  "/register",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, email, password, role } = req.body;
      const newUser = await userService.registerUser(
        name,
        email,
        password,
        role
      );
      res.status(201).json({
        message: "User registered successfully",
        user: {
          id: newUser.id,
          name: newUser.name,
          email: newUser.email,
          role: newUser.role,
        },
      });
    } catch (error) {
      next(error);
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
  (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({ message: "This is your profile", user: req.user });
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
  authenticateJWT,
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
      const userId = (req as any).user.id; // dari token JWT
      const { name, password } = req.body as UpdateProfileData;
      const updatedUser = await userService.updateProfile(userId, {
        name,
        password,
      });

      res.status(200).json({
        message: "Profile updated successfully",
        user: {
          id: updatedUser.id,
          name: updatedUser.name,
          email: updatedUser.email,
          profilePicture: updatedUser.profilepicture,
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
  authorizeRoles("superadmin"),
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

router.post(
  "/upload-profile-picture",
  authenticateJWT,
  upload.single("profilePicture"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user.id; // dari token JWT
      const file = req.file;

      if (!file) {
        throw new BadRequestError("No file uploaded");
      }

      const fileUrl = await userService.uploadProfilePicture(userId, file);
      res
        .status(200)
        .json({ message: "Profile picture uploaded successfully", fileUrl });
    } catch (error: any) {
      next(error);
    }
  }
);

export default router;
