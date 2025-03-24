import { Request, Response, NextFunction } from "express";
import * as bookService from "./service";
import { bookSchema, updateBookSchema } from "./schema";
import { Router } from "express";
import { authenticateJWT } from "../../middleware/auth";
import { authorizeRoles } from "../../middleware/roleMiddleware";
import { NotFoundError } from "../../error/NotFoundError";
import { upload } from "../../middleware/upload";
import { BadRequestError } from "../../error/BadRequestError";
// import { uploadBookCoverToS3, uploadBookFileToS3 } from "../../utils/s3Upload";

const router = Router();

router.post(
  "/",
  authenticateJWT,
  authorizeRoles("ADMIN", "SUPERADMIN"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validateData = bookSchema.parse(req.body);
      const book = await bookService.createBook(validateData);
      res.status(201).json(book);
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
      const books = await bookService.getAllBooks();
      res.json(books);
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
      const book = await bookService.getBookById(req.params.id);
      if (!book) {
        throw new NotFoundError("Book not found");
      }
      res.json(book);
    } catch (error) {
      next(error);
    }
  }
);

router.put(
  "/:id",
  authenticateJWT,
  authorizeRoles("ADMIN", "SUPERADMIN"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validateData = updateBookSchema.parse(req.body);
      const updateBook = await bookService.updateBook(
        req.params.id,
        validateData
      );
      res.json(updateBook);
    } catch (error) {
      next(error);
    }
  }
);

router.delete(
  "/:id",
  authenticateJWT,
  authorizeRoles("ADMIN", "SUPERADMIN"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await bookService.deleteBook(req.params.id);
      res.status(204).send();
    } catch (error) {
      next(new NotFoundError("Book not found"));
    }
  }
);

// upload buku dan cover

router.post(
  "/:id/upload-cover",
  authenticateJWT,
  authorizeRoles("ADMIN", "SUPERADMIN"),
  upload.single("cover"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      if (!req.file) {
        throw new BadRequestError("No file uploaded");
      }

      // const coverUrl = await uploadBookCoverToS3(id, req.file);
      // res.json({ coverUrl });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  "/:id/upload-book-file",
  authenticateJWT,
  authorizeRoles("ADMIN", "SUPERADMIN"),
  upload.single("bookFile"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      if (!req.file) {
        throw new BadRequestError("No file uploaded");
      }
      // const fileUrl = await uploadBookFileToS3(id, req.file);
      // res.json({ fileUrl });
    } catch (error) {}
  }
);

// loans

router.post(
  "/:bookId/borrow",
  authenticateJWT,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { bookId } = req.params;
      const { dueDate } = req.body;
      const userId = (req as any).user.id;

      const loan = await bookService.borrowBook(
        userId,
        bookId,
        new Date(dueDate)
      );
      res.status(201).json({ message: "Book borrowed successfully", loan });
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  "/user/loans",
  authenticateJWT,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user.id;
      const loans = await bookService.getUserLoans(userId);
      const validLoans = loans.filter((loan) => loan.book !== null);

      if (validLoans.length < loans.length) {
        console.warn(
          `${loans.length - validLoans.length} loans have missing books`
        );
      }

      res.json(validLoans);
      res.json(loans);
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  "/:bookId/return",
  authenticateJWT,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { bookId } = req.params;
      const userId = (req as any).user.id;

      const loan = await bookService.returnBook(userId, bookId);
      res.json({ message: "Book returned successfully", loan });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
