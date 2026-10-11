import { Request, Response } from "express";
import { ok } from "../../common/utils/apiResponse";
import { asyncHandler } from "../../common/utils/asyncHandler";
import { SESSION_COOKIE, sessionCookieOptions } from "../../common/utils/session";
import { getProfile, loginUser, registerUser, updateProfile } from "./auth.service";

export const register = asyncHandler(async (req: Request, res: Response) => {
  const { user } = await registerUser(req.body);
  res.status(201).json(ok("Account created", { user }));
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { token, user } = await loginUser(req.body);
  res.cookie(SESSION_COOKIE, token, sessionCookieOptions);
  res.json(ok("Logged in", { user }));
});

export const logout = asyncHandler(async (_req: Request, res: Response) => {
  const { maxAge: _maxAge, ...clearOptions } = sessionCookieOptions;
  res.clearCookie(SESSION_COOKIE, clearOptions);
  res.json(ok("Logged out"));
});

export const patchMe = asyncHandler(async (req: Request, res: Response) => {
  const user = await updateProfile(req.user!.id, req.body);
  res.json(ok("Profile updated", user));
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  const user = await getProfile(req.user!.id);
  res.json(ok("Profile fetched", user));
});
