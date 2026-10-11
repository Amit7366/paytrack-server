import { Request, Response } from "express";
import { Role } from "../../common/constants/roles";
import { ok } from "../../common/utils/apiResponse";
import { asyncHandler } from "../../common/utils/asyncHandler";
import {
  createManagedUser,
  deleteManagedUser,
  getManagedUser,
  listManagedUsers,
  updateManagedUser,
} from "./user.service";

const actor = (req: Request) => ({ id: req.user!.id, role: req.user!.role as Role });

export const getUsers = asyncHandler(async (req: Request, res: Response) => {
  const query = req.validated?.query as {
    search: string;
    status: "all" | "active" | "inactive";
    page: number;
    limit: number;
  };
  const data = await listManagedUsers(actor(req), query);
  res.json(ok("Users fetched", data));
});

export const getUser = asyncHandler(async (req: Request, res: Response) => {
  const id = String((req.validated?.params as { id: string }).id);
  const user = await getManagedUser(actor(req), id);
  res.json(ok("User fetched", user));
});

export const postUser = asyncHandler(async (req: Request, res: Response) => {
  const user = await createManagedUser(actor(req), req.validated?.body as { name: string; email: string; password: string });
  res.status(201).json(ok("User created", user));
});

export const patchUser = asyncHandler(async (req: Request, res: Response) => {
  const id = String((req.validated?.params as { id: string }).id);
  const user = await updateManagedUser(
    actor(req),
    id,
    req.validated?.body as { name?: string; email?: string; password?: string; isActive?: boolean },
  );
  res.json(ok("User updated", user));
});

export const removeUser = asyncHandler(async (req: Request, res: Response) => {
  const id = String((req.validated?.params as { id: string }).id);
  const result = await deleteManagedUser(actor(req), id);
  const message = result.mode === "soft" ? "User deactivated because they have payments" : "User deleted";
  res.json(ok(message, result));
});
