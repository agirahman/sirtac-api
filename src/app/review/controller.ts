import { Request, Response, NextFunction } from "express";
import * as bookService from "./service";
import { Router } from "express";
import { authenticateJWT } from "../../middleware/auth";
import { authorizeRoles } from "../../middleware/roleMiddleware";

const router = Router();

// Get all reviews
router.get(
  "/",
  authenticateJWT,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const reviews = await bookService.getAllReviews();
      res.json(reviews);
    } catch (error) {
      next(error);
    }
  }
);

// Add review for a specific book
router.post(
  "/:bookId",
  authenticateJWT,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { bookId } = req.params;
      const { rating, comment } = req.body;
      const userId = (req as Request & { user: { id: string } }).user.id;

      const review = await bookService.addReview(
        userId,
        bookId,
        rating,
        comment
      );
      res.status(201).json(review);
    } catch (error) {
      next(error);
    }
  }
);

// Get reviews for a specific book - FIXED THE TYPO HERE
router.get(
  "/:bookId", // Changed from "/:bookdId" to "/:bookId"
  authenticateJWT,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { bookId } = req.params;
      const reviews = await bookService.getReviewsByBook(bookId);
      res.json(reviews);
    } catch (error) {
      next(error);
    }
  }
);

// Delete a review
router.delete(
  "/:reviewId",
  authenticateJWT,
  authorizeRoles("ADMIN", "SUPERADMIN"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authenticatedReq = req as Request & {
        user: {
          id: string;
          role: string;
        };
      };
      const { reviewId } = req.params;
      const userId = authenticatedReq.user.id;
      const isAdmin =
        authenticatedReq.user.role === "ADMIN" ||
        authenticatedReq.user.role === "SUPERADMIN";
      await bookService.deleteReview(userId, reviewId, isAdmin);
      res.status(200).json({ message: "Review berhasil dihapus" });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
