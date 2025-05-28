import { Router, Request, Response, NextFunction } from "express";
import * as bookService from "./service";
import { bookSchema, updateBookSchema } from "./schema";
import { authenticateJWT } from "../../middleware/auth";
import { authorizeRoles } from "../../middleware/roleMiddleware";
import { NotFoundError } from "../../error/NotFoundError";
import { BadRequestError } from "../../error/BadRequestError";
import multer from "multer";
import path from "path";
import fs from "fs";

// Define User interface for request authentication
interface User {
  id: string;
  role: string;
}

// Extend Express Request to include the user property
interface AuthRequest extends Request {
  user?: User;
}

const router = Router();

// Configure multer for disk storage rather than memory storage
const UPLOAD_DIR = path.join(process.cwd(), "uploads");
const COVERS_DIR = path.join(UPLOAD_DIR, "covers");
const BOOKS_DIR = path.join(UPLOAD_DIR, "books");

// Ensure directories exist
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
if (!fs.existsSync(COVERS_DIR)) fs.mkdirSync(COVERS_DIR, { recursive: true });
if (!fs.existsSync(BOOKS_DIR)) fs.mkdirSync(BOOKS_DIR, { recursive: true });

// Setup separate storage for each file type
const coverStorage = multer.diskStorage({
  destination: (req: Request, file: Express.Multer.File, cb: Function) => {
    cb(null, COVERS_DIR);
  },
  filename: (req: Request, file: Express.Multer.File, cb: Function) => {
    const timestamp = Date.now();
    const bookId = req.params.id || `book-${timestamp}`;
    const ext = path.extname(file.originalname);
    cb(null, `${bookId}-cover-${timestamp}${ext}`);
  },
});

const bookFileStorage = multer.diskStorage({
  destination: (req: Request, file: Express.Multer.File, cb: Function) => {
    cb(null, BOOKS_DIR);
  },
  filename: (req: Request, file: Express.Multer.File, cb: Function) => {
    const timestamp = Date.now();
    const bookId = req.params.id || `book-${timestamp}`;
    const ext = path.extname(file.originalname);
    cb(null, `${bookId}-book-${timestamp}${ext}`);
  },
});

// Combined storage for create book with files
const combinedStorage = multer.diskStorage({
  destination: (req: Request, file: Express.Multer.File, cb: Function) => {
    if (file.fieldname === "cover") {
      cb(null, COVERS_DIR);
    } else if (file.fieldname === "bookFile") {
      cb(null, BOOKS_DIR);
    } else {
      cb(new Error("Unexpected field"), null);
    }
  },
  filename: (req: Request, file: Express.Multer.File, cb: Function) => {
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);

    if (file.fieldname === "cover") {
      cb(null, `cover-${timestamp}${ext}`);
    } else if (file.fieldname === "bookFile") {
      cb(null, `book-${timestamp}${ext}`);
    } else {
      cb(new Error("Unexpected field"), null);
    }
  },
});

// File filters
const coverFileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: Function
) => {
  const allowedMimeTypes = ["image/jpeg", "image/png", "image/gif"];
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        "Invalid file type. Only JPEG, PNG, and GIF are allowed for covers."
      ),
      false
    );
  }
};

const bookFileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: Function
) => {
  const allowedMimeTypes = [
    "application/pdf",
    "application/epub+zip",
    "application/x-mobipocket-ebook",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ];

  const ext = path.extname(file.originalname).toLowerCase();
  const allowedExtensions = [".pdf", ".epub", ".mobi", ".doc", ".docx"];

  if (
    allowedMimeTypes.includes(file.mimetype) ||
    allowedExtensions.includes(ext)
  ) {
    cb(null, true);
  } else {
    cb(
      new Error(
        "Invalid file type. Only PDF, EPUB, MOBI, DOC, and DOCX are allowed for books."
      ),
      false
    );
  }
};

const combinedFileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: Function
) => {
  if (file.fieldname === "cover") {
    coverFileFilter(req, file, cb);
  } else if (file.fieldname === "bookFile") {
    bookFileFilter(req, file, cb);
  } else {
    cb(new Error("Unexpected field"), false);
  }
};

// Create separate upload instances
const uploadCover = multer({
  storage: coverStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: coverFileFilter,
});

const uploadBookFile = multer({
  storage: bookFileStorage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB for book files
  fileFilter: bookFileFilter,
});

const uploadCombined = multer({
  storage: combinedStorage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max
  fileFilter: combinedFileFilter,
});

// CREATE book with optional file uploads
router.post(
  "/",
  authenticateJWT,
  authorizeRoles("ADMIN", "SUPERADMIN"),
  uploadCombined.fields([
    { name: "cover", maxCount: 1 },
    { name: "bookFile", maxCount: 1 },
  ]),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const validatedData = bookSchema.parse(req.body);

      // Handle file uploads
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      let coverImage: string | undefined;
      let fileUrl: string | undefined;

      if (files?.cover && files.cover[0]) {
        coverImage = `/uploads/covers/${files.cover[0].filename}`;
      }

      if (files?.bookFile && files.bookFile[0]) {
        fileUrl = `/uploads/books/${files.bookFile[0].filename}`;
      }

      // Create book with file paths
      const bookData = {
        ...validatedData,
        coverImage,
        fileUrl,
      };

      const book = await bookService.createBook(bookData);
      res.status(201).json(book);
    } catch (error) {
      // Clean up uploaded files if book creation fails
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };

      if (files?.cover && files.cover[0]) {
        try {
          fs.unlinkSync(files.cover[0].path);
        } catch (cleanupError) {
          console.error("Error cleaning up cover file:", cleanupError);
        }
      }

      if (files?.bookFile && files.bookFile[0]) {
        try {
          fs.unlinkSync(files.bookFile[0].path);
        } catch (cleanupError) {
          console.error("Error cleaning up book file:", cleanupError);
        }
      }

      next(error);
    }
  }
);

// READ all books
router.get(
  "/",
  authenticateJWT,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const books = await bookService.getAllBooks();
      res.json(books);
    } catch (error) {
      next(error);
    }
  }
);

// READ book by ID
router.get(
  "/:id",
  authenticateJWT,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const book = await bookService.getBookById(req.params.id);
      if (!book) throw new NotFoundError("Book not found");
      res.json(book);
    } catch (error) {
      next(error);
    }
  }
);

// UPDATE book
router.put(
  "/:id",
  authenticateJWT,
  authorizeRoles("ADMIN", "SUPERADMIN"),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const validatedData = updateBookSchema.parse(req.body);
      const updatedBook = await bookService.updateBook(
        req.params.id,
        validatedData
      );
      res.json(updatedBook);
    } catch (error) {
      next(error);
    }
  }
);

// DELETE book
router.delete(
  "/:id",
  authenticateJWT,
  authorizeRoles("ADMIN", "SUPERADMIN"),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      await bookService.deleteBook(req.params.id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);

// Upload cover image - use disk storage instead of memory storage
router.post(
  "/:id/upload-cover",
  authenticateJWT,
  authorizeRoles("ADMIN", "SUPERADMIN"),
  uploadCover.single("cover"),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      // Check if book exists
      const book = await bookService.getBookById(id);
      if (!book) {
        throw new NotFoundError("Book not found");
      }

      if (!req.file) {
        throw new BadRequestError("No file uploaded");
      }

      // Delete old cover if exists
      if (book.coverImage) {
        const oldCoverPath = path.join(process.cwd(), book.coverImage);
        if (fs.existsSync(oldCoverPath)) {
          try {
            fs.unlinkSync(oldCoverPath);
            console.log(`Deleted old cover: ${oldCoverPath}`);
          } catch (error) {
            console.error(`Error deleting old cover: ${oldCoverPath}`, error);
          }
        }
      }

      // Save the cover image path to database
      const coverUrl = `/uploads/covers/${req.file.filename}`;
      const updated = await bookService.updateBook(id, {
        coverImage: coverUrl,
      });

      res.json({
        message: "Cover uploaded successfully",
        book: updated,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Upload book file - use disk storage instead of memory storage
router.post(
  "/:id/upload-book-file",
  authenticateJWT,
  authorizeRoles("ADMIN", "SUPERADMIN"),
  uploadBookFile.single("bookFile"),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      // Check if book exists
      const book = await bookService.getBookById(id);
      if (!book) {
        throw new NotFoundError("Book not found");
      }

      if (!req.file) {
        throw new BadRequestError("No file uploaded");
      }

      // Delete old book file if exists
      if (book.fileUrl) {
        const oldFilePath = path.join(process.cwd(), book.fileUrl);
        if (fs.existsSync(oldFilePath)) {
          try {
            fs.unlinkSync(oldFilePath);
            console.log(`Deleted old book file: ${oldFilePath}`);
          } catch (error) {
            console.error(
              `Error deleting old book file: ${oldFilePath}`,
              error
            );
          }
        }
      }

      // Save the book file path to database
      const fileUrl = `/uploads/books/${req.file.filename}`;
      const updated = await bookService.updateBook(id, { fileUrl });

      res.json({
        message: "Book file uploaded successfully",
        book: updated,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Borrow book
router.post(
  "/:bookId/borrow",
  authenticateJWT,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { bookId } = req.params;
      const { dueDate } = req.body;

      // Add null check for req.user
      if (!req.user) {
        throw new BadRequestError("User not authenticated");
      }

      const userId = req.user.id;

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

// Return book
router.post(
  "/:bookId/return",
  authenticateJWT,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { bookId } = req.params;

      // Add null check for req.user
      if (!req.user) {
        throw new BadRequestError("User not authenticated");
      }

      const userId = req.user.id;

      const loan = await bookService.returnBook(userId, bookId);
      res.json({ message: "Book returned successfully", loan });
    } catch (error) {
      next(error);
    }
  }
);

// User's loans
router.get(
  "/user/loans",
  authenticateJWT,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      // Add null check for req.user
      if (!req.user) {
        throw new BadRequestError("User not authenticated");
      }

      const userId = req.user.id;
      const loans = await bookService.getUserLoans(userId);
      res.json(loans);
    } catch (error) {
      next(error);
    }
  }
);

// Better error handler for multer and other errors
router.use((err: any, req: Request, res: Response, next: NextFunction) => {
  // Handle multer errors
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      res.status(400).json({
        error:
          "File size too large. Maximum size is 5MB for covers and 50MB for book files.",
      });
      return;
    }
    res.status(400).json({ error: err.message });
    return;
  }

  // Handle custom file type errors
  if (
    err.message &&
    (err.message.includes("Invalid file type") ||
      err.message.includes("Unexpected field"))
  ) {
    res.status(400).json({ error: err.message });
    return;
  }

  next(err);
});

export default router;
