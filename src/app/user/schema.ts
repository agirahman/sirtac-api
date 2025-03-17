import { optional, z } from "zod";

export const userSchema = z.object({
  name: z.string(),
  email: z.string().email("Invalid email format"),
  phone: z.string(),
  password: z.string(),
});
