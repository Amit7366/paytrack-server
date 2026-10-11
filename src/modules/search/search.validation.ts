import { z } from "zod";

export const searchSchema = z.object({
  body: z.object({}).optional(),
  params: z.object({}).optional(),
  query: z.object({
    q: z.string().trim().min(1).max(80),
  }),
});
