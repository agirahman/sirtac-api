import { z } from "zod";

export const bookSchema = z.object({
  title: z.string(),
  author: z.string(),
  description: z.string().optional(),
  publishedYear: z.number(),
});

export const updateBookSchema = z.object({
  title: z.string().optional(),
  author: z.string().optional(),
  description: z.string().optional(),
  publishedYear: z.number().optional(),
  coverImage: z.string().optional(),
  fileUrl: z.string().optional(),
});
