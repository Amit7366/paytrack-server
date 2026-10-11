import { z } from "zod";

export const listAdminsSchema = z.object({
  body: z.object({}).optional(),
  params: z.object({}).optional(),
  query: z.object({
    search: z.string().trim().optional().default(""),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(10),
  }),
});

export const createAdminSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(80),
    email: z.string().trim().email(),
    password: z.string().min(8, "Password must be at least 8 characters"),
  }),
  params: z.object({}).optional(),
  query: z.object({}).optional(),
});

export const adminIdSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
  query: z.object({}).optional(),
});

export const updateAdminSchema = adminIdSchema.extend({
  body: z
    .object({
      name: z.string().trim().min(2).max(80).optional(),
      email: z.string().trim().email().optional(),
      password: z.string().min(8, "Password must be at least 8 characters").optional(),
      isActive: z.boolean().optional(),
    })
    .refine((value) => Object.values(value).some((item) => item !== undefined), {
      message: "Provide a name, email, password, or status to update",
    }),
});
