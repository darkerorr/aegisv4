import { z } from "zod";
export const loginSchema = z.object({ email: z.string().email("Enter a valid email address."), password: z.string().min(8, "Password must be at least 8 characters.") });
export const registerSchema = loginSchema.extend({ displayName: z.string().trim().min(1, "Enter your name.").max(80), confirmPassword: z.string().min(8) }).refine((data) => data.password === data.confirmPassword, { path: ["confirmPassword"], message: "Passwords do not match." });
