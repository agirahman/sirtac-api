import { z } from "zod";

export const ReviewSchema = z.object({
  rating: z.number().min(1).max(5),
  Comment: z.string().optional(),
});
