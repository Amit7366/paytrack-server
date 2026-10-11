import { Request, Response } from "express";
import { Role } from "../../common/constants/roles";
import { ok } from "../../common/utils/apiResponse";
import { asyncHandler } from "../../common/utils/asyncHandler";
import { listUsers, updateUserRole } from "./user.service";

export const getUsers = asyncHandler(async (req: Request, res: Response) => {
  const users = await listUsers({ id: req.user!.id, role: req.user!.role as Role });
  res.json(ok("Users fetched", users));
});

export const patchUserRole = asyncHandler(async (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const user = await updateUserRole(req.user!.id, id, req.body.role as Role);
  res.json(ok("Role updated", user));
});
