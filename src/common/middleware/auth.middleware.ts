import { NextFunction, Request, Response } from "express";
import { AppError } from "../errors/AppError";
import { SESSION_COOKIE, verifySession } from "../utils/session";
import { User } from "../../modules/user/user.model";

const readCookie = (header: string | undefined, name: string) => {
  if (!header) return null;
  const parts = header.split(";").map((part) => part.trim());
  const match = parts.find((part) => part.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
};

export const authenticate = async (req: Request, _res: Response, next: NextFunction) => {
  const token = req.cookies?.[SESSION_COOKIE] ?? readCookie(req.headers.cookie, SESSION_COOKIE);
  if (!token) {
    next(new AppError("Authentication required", 401));
    return;
  }

  try {
    const session = await verifySession(token);
    if (!session) {
      next(new AppError("Invalid or expired token", 401));
      return;
    }

    const user = await User.findById(session.userId);
    if (!user || !user.isActive) {
      next(new AppError("Account is inactive or no longer exists", 401));
      return;
    }

    req.user = {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
    };
    next();
  } catch {
    next(new AppError("Invalid or expired token", 401));
  }
};
