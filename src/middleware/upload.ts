import multer from "multer";
import { Request } from "express";

// Simpan file di memory (buffer), cocok untuk upload ke S3
const storage = multer.memoryStorage();

/**
 * Filter file berdasarkan tipe
 * @param req Request object
 * @param file File yang diupload
 * @param cb Callback untuk approve/reject file
 */
const fileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  if (req.path.includes("profile-picture")) {
    // Untuk upload foto profil - hanya image
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed!"));
    }
  } else if (req.path.includes("upload-book")) {
    // Untuk upload buku - hanya PDF
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are allowed!"));
    }
  } else {
    // Default - tolak semua
    cb(new Error("Invalid upload path!"));
  }
};

/**
 * Middleware multer dengan konfigurasi yang fleksibel
 * - Foto profil: max 2MB
 * - Buku PDF: max 10MB
 */
export const upload = multer({
  storage,
  limits: {
    fileSize: (req: Request) => {
      if (req.path.includes("profile-picture")) {
        return 2 * 1024 * 1024; // 2MB
      } else if (req.path.includes("upload-book")) {
        return 100 * 1024 * 1024; // 100MB
      }
      return 0; // Invalid - tidak boleh upload
    },
  } as any, // karena multer belum mendukung fileSize dinamis langsung di typescript
  fileFilter,
});
