import { z } from "zod";
import { ROLE_VALUES } from "../../common/constants/roles";

export const updateRoleSchema = z.object({
  body: z.object({
    role: z.enum(ROLE_VALUES),
  }),
  params: z.object({
    id: z.string().min(1),
  }),
  query: z.object({}).optional(),
});
