import { z } from "zod";

const period = z.enum(["daily", "weekly", "monthly", "yearly"]);
const status = z.enum(["all", "paid", "unpaid"]).optional().default("all");
const bound = z.string().optional().default("");

const shared = {
  from: bound,
  to: bound,
  status,
  userId: z.string().optional().default(""),
  adminId: z.string().optional().default(""),
};

export const summaryReportSchema = z.object({
  body: z.object({}).optional(),
  params: z.object({}).optional(),
  query: z.object({
    period: period.optional().default("monthly"),
    ...shared,
  }),
});

export const byUserReportSchema = z.object({
  body: z.object({}).optional(),
  params: z.object({}).optional(),
  query: z.object({
    from: bound,
    to: bound,
    status,
    userId: z.string().optional().default(""),
    adminId: z.string().optional().default(""),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(10),
    sortBy: z.enum(["name", "payments", "usd", "bdt", "paid", "unpaid"]).optional().default("bdt"),
    sortDir: z.enum(["asc", "desc"]).optional().default("desc"),
  }),
});

export const userReportSchema = z.object({
  body: z.object({}).optional(),
  params: z.object({ id: z.string().min(1) }),
  query: z.object({
    period: period.optional().default("monthly"),
    from: bound,
    to: bound,
    status,
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }),
});

export const exportReportSchema = z.object({
  body: z.object({}).optional(),
  params: z.object({}).optional(),
  query: z.object({
    type: z.enum(["summary", "by-user", "payments"]),
    format: z.literal("csv").optional().default("csv"),
    period: period.optional().default("monthly"),
    ...shared,
    sortBy: z.enum(["name", "payments", "usd", "bdt", "paid", "unpaid"]).optional().default("bdt"),
    sortDir: z.enum(["asc", "desc"]).optional().default("desc"),
  }),
});
