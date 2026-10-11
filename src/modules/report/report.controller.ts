import { Request, Response } from "express";
import { Role } from "../../common/constants/roles";
import { ok } from "../../common/utils/apiResponse";
import { asyncHandler } from "../../common/utils/asyncHandler";
import { byUserReport, exportReport, summaryReport, userReport } from "./report.service";

const actor = (req: Request) => ({ id: req.user!.id, role: req.user!.role as Role });

export const getSummary = asyncHandler(async (req: Request, res: Response) => {
  const data = await summaryReport(actor(req), req.validated?.query as Parameters<typeof summaryReport>[1]);
  res.json(ok("Report summary", data));
});

export const getByUser = asyncHandler(async (req: Request, res: Response) => {
  const data = await byUserReport(actor(req), req.validated?.query as Parameters<typeof byUserReport>[1]);
  res.json(ok("Report by user", data));
});

export const getUserReport = asyncHandler(async (req: Request, res: Response) => {
  const id = String((req.validated?.params as { id: string }).id);
  const data = await userReport(actor(req), id, req.validated?.query as Parameters<typeof userReport>[2]);
  res.json(ok("User report", data));
});

export const getExport = asyncHandler(async (req: Request, res: Response) => {
  const file = await exportReport(actor(req), req.validated?.query as Parameters<typeof exportReport>[1]);
  res.setHeader("content-type", "text/csv; charset=utf-8");
  res.setHeader("content-disposition", `attachment; filename="${file.filename}"`);
  res.send(file.body);
});
