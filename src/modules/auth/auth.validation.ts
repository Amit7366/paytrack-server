import { z } from "zod";

const credentials = {
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
};

export const registerSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(80),
    ...credentials,
  }),
  params: z.object({}).optional(),
  query: z.object({}).optional(),
});

export const profileSchema = z.object({
  body: z
    .object({
      name: z.string().trim().min(2).max(80).optional(),
      currentPassword: z.string().min(8).optional(),
      newPassword: z.string().min(8).optional(),
    })
    .refine((value) => Boolean(value.name || value.newPassword), {
      message: "Change your name or password",
    }),
  params: z.object({}).optional(),
  query: z.object({}).optional(),
});

export const loginSchema = z.object({
  body: z.object(credentials),
  params: z.object({}).optional(),
  query: z.object({}).optional(),
});
