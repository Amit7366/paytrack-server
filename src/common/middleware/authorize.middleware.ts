import { NextFunction, Request, Response } from "express";
import { Role } from "../constants/roles";
import { AppError } from "../errors/AppError";

export const authorize =
  (...allowed: Role[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      next(new AppError("Authentication required", 401));
      return;
    }

    if (!allowed.includes(req.user.role)) {
      next(new AppError("You do not have permission for this action", 403));
      return;
    }

    next();
  };
