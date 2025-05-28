import { z } from "zod";

export const ReviewSchema = z.object({
  rating: z.number().min(1, "Rating minimal 1").max(5, "Rating maksimal 5"),
  comment: z.string().optional(), // Fixed typo: "Comment" -> "comment"
});

export const ReviewUpdateSchema = z.object({
  rating: z
    .number()
    .min(1, "Rating minimal 1")
    .max(5, "Rating maksimal 5")
    .optional(),
  comment: z.string().optional(),
});

export type ReviewInput = z.infer<typeof ReviewSchema>;
export type ReviewUpdateInput = z.infer<typeof ReviewUpdateSchema>;
