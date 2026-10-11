import { NextFunction, Request, Response } from "express";
import { AppError } from "../errors/AppError";

const WINDOW_MS = 60_000;
const LIMIT = 5;
const buckets = new Map<string, { count: number; resetAt: number }>();

const clientIp = (req: Request) => {
  const forwarded = req.header("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || req.ip || "unknown";
};

export const loginRateLimit = (req: Request, _res: Response, next: NextFunction) => {
  const now = Date.now();
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  const key = `${clientIp(req)}:${email}`;
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    next();
    return;
  }
  if (current.count >= LIMIT) {
    next(new AppError("Too many login attempts. Try again in a minute.", 429));
    return;
  }
  current.count += 1;
  next();
};
