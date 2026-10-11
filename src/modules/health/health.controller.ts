import { Request, Response } from "express";
import { ok } from "../../common/utils/apiResponse";

export const health = (_req: Request, res: Response) => {
  res.json(ok("Payment management API is running", { service: "server" }));
};
