import express, { NextFunction, Request, Response } from "express";
import * as userService from "./service";
import { NotFoundError } from "../../error/NotFoundError";
import { BadRequestError } from "../../error/BadRequestError";
import { authenticateJWT } from "../../middleware/auth";
import { UnauthorizedError } from "../../error/UnauthorizedError";
import { authorizeRoles } from "../../middleware/roleMiddleware";
import multer from "multer";
import { ContactFormRequest, UpdateProfileData, UserPayload } from "./dto";

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB file size limit
  },
  fileFilter: (req, file, cb) => {
    // Accept only image files
    const allowedMimeTypes = ["image/jpeg", "image/png", "image/gif"];
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only JPEG, PNG, and GIF are allowed."));
    }
  },
});

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

router.post(
  "/contact",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, email, message } = req.body as ContactFormRequest;

      // Validate required fields
      if (!name || !email || !message) {
        res.status(400).json({
          message: "Name, email, and comment are required fields",
        });
        return;
      }

      // Check if recipient email is configured
      const recipientEmail = process.env.SMTP_FROM || "admin@example.com";
      if (!recipientEmail) {
        res.status(500).json({
          error: "Recipient email is not configured",
        });
        return;
      }

      // Process the contact form submission
      await userService.processContactForm({ name, email, message });

      // Return success response
      res.status(200).json({
        message: "Your message has been sent successfully!",
      });
      return;
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  "/admin-dashboard",
  authenticateJWT,
  authorizeRoles("ADMIN", "SUPERADMIN"),
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
      // Get user ID and role from JWT token
      const userId = req.user?.id;
      const userRole = req.user?.role;

      // If user ID from token is missing, return unauthorized
      if (!userId) {
        res.status(401).json({ error: "Unauthorized access" });
        return;
      }

      // Allow SUPERADMINs to edit any profile, but other users can only edit their own
      if (userRole !== "SUPERADMIN" && userId !== req.params.id) {
        res.status(403).json({ error: "You can only update your own profile" });
        return;
      }

      // Extract only the fields we want to update
      const { name, password, phone } = req.body as UpdateProfileData;

      // Validate input data
      if (
        (name !== undefined && name.trim() === "") ||
        (password !== undefined && password.trim() === "") ||
        (phone !== undefined && phone.trim() === "")
      ) {
        res.status(400).json({ error: "Invalid input data" });
        return;
      }

      // Update the user profile (use req.params.id - the target user - not userId which is the logged-in user)
      const updatedUser = await userService.updateProfile(req.params.id, {
        name,
        password,
        phone,
      });

      // Return success response
      res.status(200).json({
        message: "Profile updated successfully",
        user: {
          id: updatedUser.id,
          name: updatedUser.name,
          email: updatedUser.email,
          phone: updatedUser.phone,
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

      // Log file details for debugging
      console.log(`Received file upload: 
        - Original Name: ${file.originalname}
        - Size: ${file.size} bytes
        - MIME Type: ${file.mimetype}`);

      // Upload the file buffer and get the fileId
      const fileId = await userService.uploadProfilePicture(userId, {
        buffer: file.buffer,
        originalname: file.originalname,
        mimetype: file.mimetype,
      });

      // Return success response with fileId
      res.status(201).json({
        message: "Profile picture uploaded successfully",
        fileId: fileId,
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
      const userId = (req.user as UserPayload).id;

      console.log(`Fetching profile picture: ${id} for user: ${userId}`);

      // Fetch the picture
      const picture = await userService.getProfilePictureById(id);

      // Validate access (optional: add more granular access control if needed)
      if (picture.userId !== userId) {
        res
          .status(403)
          .json({ message: "Unauthorized to access this profile picture" });
        return;
      }

      // IMPORTANT: Convert Bytes to Buffer if needed
      const imageBuffer = Buffer.from(picture.file);

      // Set appropriate headers
      res.setHeader("Content-Type", picture.mimetype);
      res.setHeader(
        "Content-Disposition",
        `inline; filename="${picture.filename}"`
      );

      // Send the file data
      res.send(imageBuffer);
    } catch (error) {
      console.error(`Error serving profile picture:`, error);
      next(error);
    }
  }
);

router.patch(
  "/:id/role",
  authenticateJWT,
  authorizeRoles("SUPERADMIN"), // Changed to uppercase to match frontend
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role } = req.body;

      // Case-insensitive role validation
      const validRoles = ["user", "admin", "superadmin"].map((r) =>
        r.toLowerCase()
      );

      if (!validRoles.includes(role.toLowerCase())) {
        throw new BadRequestError("Invalid role");
      }

      const currentUserId = req.user?.id;

      if (!currentUserId) {
        throw new UnauthorizedError("User ID not found in token");
      }

      // Role is converted to proper case in the service layer
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
