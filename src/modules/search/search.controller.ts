import { Request, Response } from "express";
import { asyncHandler } from "../../common/utils/asyncHandler";
import { ok } from "../../common/utils/apiResponse";
import { searchLedger } from "./search.service";

export const getSearch = asyncHandler(async (req: Request, res: Response) => {
  const { q } = req.validated!.query as { q: string };
  const data = await searchLedger(req.user!, q);
  res.json(ok("Search results", data));
});
