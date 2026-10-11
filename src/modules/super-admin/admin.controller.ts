import { Request, Response } from "express";
import { ok } from "../../common/utils/apiResponse";
import { asyncHandler } from "../../common/utils/asyncHandler";
import { listAuditLogs } from "../audit/audit.service";
import { createAdmin, deleteAdmin, getDashboardStats, listAdmins, updateAdmin } from "./admin.service";

type ListQuery = { search: string; page: number; limit: number };
type CreateBody = { name: string; email: string; password: string };
type UpdateBody = { name?: string; email?: string; password?: string; isActive?: boolean };

export const getAdmins = asyncHandler(async (req: Request, res: Response) => {
  const query = req.validated?.query as ListQuery;
  const data = await listAdmins(query);
  res.json(ok("Admins fetched", data));
});

export const postAdmin = asyncHandler(async (req: Request, res: Response) => {
  const admin = await createAdmin(req.user!.id, req.validated?.body as CreateBody);
  res.status(201).json(ok("Admin created", admin));
});

export const patchAdmin = asyncHandler(async (req: Request, res: Response) => {
  const id = String((req.validated?.params as { id: string }).id);
  const admin = await updateAdmin(id, req.validated?.body as UpdateBody);
  res.json(ok("Admin updated", admin));
});

export const removeAdmin = asyncHandler(async (req: Request, res: Response) => {
  const id = String((req.validated?.params as { id: string }).id);
  const result = await deleteAdmin(id);
  const message = result.mode === "soft" ? "Admin deactivated because they have created users" : "Admin deleted";
  res.json(ok(message, result));
});

export const getStats = asyncHandler(async (_req: Request, res: Response) => {
  const stats = await getDashboardStats();
  res.json(ok("Dashboard stats fetched", stats));
});

export const getAuditLogs = asyncHandler(async (req: Request, res: Response) => {
  const data = await listAuditLogs(req.validated?.query as Parameters<typeof listAuditLogs>[0]);
  res.json(ok("Audit logs fetched", data));
});
