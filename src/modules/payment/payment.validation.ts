import { z } from "zod";
import { isPositiveMoney, moneyString } from "../../common/money";
import { PAYMENT_METHODS } from "./payment.model";

const method = z.enum(PAYMENT_METHODS);

const positiveMoney = z.union([z.string(), z.number()]).transform((value, context) => {
  if (!isPositiveMoney(value)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Enter a positive amount" });
    return z.NEVER;
  }
  return moneyString(value);
});

export const listPaymentsSchema = z.object({
  body: z.object({}).optional(),
  params: z.object({}).optional(),
  query: z.object({
    userId: z.string().optional().default(""),
    status: z.enum(["all", "paid", "unpaid"]).optional().default("all"),
    dateFrom: z.string().optional().default(""),
    dateTo: z.string().optional().default(""),
    search: z.string().trim().optional().default(""),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(10),
    sortBy: z.enum(["paymentDate", "amountUsd", "amountBdt", "createdAt", "status"]).optional().default("paymentDate"),
    sortDir: z.enum(["asc", "desc"]).optional().default("desc"),
  }),
});

export const createPaymentSchema = z.object({
  body: z.object({
    userId: z.string().min(1),
    method: method,
    amountUsd: positiveMoney,
    rateBdt: positiveMoney,
    paymentDate: z.coerce.date(),
    note: z.string().trim().max(500).optional().default(""),
  }),
  params: z.object({}).optional(),
  query: z.object({}).optional(),
});

export const updatePaymentSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  query: z.object({}).optional(),
  body: z
    .object({
      userId: z.string().min(1).optional(),
      method: method.optional(),
      amountUsd: positiveMoney.optional(),
      rateBdt: positiveMoney.optional(),
      paymentDate: z.coerce.date().optional(),
      note: z.string().trim().max(500).optional(),
    })
    .refine((value) => Object.values(value).some((item) => item !== undefined), {
      message: "Provide a field to update",
    }),
});

export const paymentIdSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  query: z.object({}).optional(),
  body: z.object({}).optional(),
});

export const bulkMarkPaidSchema = z.object({
  body: z.object({
    ids: z.array(z.string().min(1)).min(1).max(100),
  }),
  params: z.object({}).optional(),
  query: z.object({}).optional(),
});
