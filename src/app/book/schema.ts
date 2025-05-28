import { z } from "zod";

export const bookSchema = z.object({
  title: z.string().min(1, "Title is required"),
  author: z.string().min(1, "Author is required"),
  publisher: z.string().min(1, "Publisher is required"),
  description: z.string().optional(),
  publishedYear: z.coerce
    .number()
    .int()
    .min(1000)
    .max(new Date().getFullYear()),
  stock: z.coerce.number().int().min(1).optional().default(1),
});

export const updateBookSchema = z.object({
  title: z.string().min(1, "Title is required").optional(),
  author: z.string().min(1, "Author is required").optional(),
  publisher: z.string().min(1, "Publisher is required").optional(),
  description: z.string().optional(),
  publishedYear: z.coerce
    .number()
    .int()
    .min(1000)
    .max(new Date().getFullYear())
    .optional(),
  coverImage: z.string().optional(),
  fileUrl: z.string().optional(),
  stock: z.coerce.number().int().min(0).optional(),
});
