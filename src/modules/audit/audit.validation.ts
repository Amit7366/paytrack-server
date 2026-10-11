import { z } from "zod";

export const listAuditLogsSchema = z.object({
  body: z.object({}).optional(),
  params: z.object({}).optional(),
  query: z.object({
    actorId: z.string().optional().default(""),
    action: z.string().trim().optional().default(""),
    entity: z.string().trim().optional().default(""),
    search: z.string().trim().optional().default(""),
    from: z.string().optional().default(""),
    to: z.string().optional().default(""),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  }),
});
