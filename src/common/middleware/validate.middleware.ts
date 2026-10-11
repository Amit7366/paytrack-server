import { NextFunction, Request, Response } from "express";
import { ZodType } from "zod";
import { AppError } from "../errors/AppError";

export const validate =
  (schema: ZodType) => (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse({
      body: req.body,
      query: req.query,
      params: req.params,
    });

    if (!result.success) {
      next(new AppError("Validation failed", 422, result.error.flatten()));
      return;
    }

    const data = result.data as {
      body?: Request["body"];
      query?: Request["query"];
      params?: Request["params"];
    };

    if (data.body) req.body = data.body;
    req.validated = data;

    next();
  };
