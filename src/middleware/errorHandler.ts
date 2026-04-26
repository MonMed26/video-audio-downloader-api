import type { Request, Response, NextFunction } from "express";
import { HttpError } from "../errors.js";
import { logger } from "../logger.js";

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof HttpError) {
    res.status(err.status).json({
      error: {
        code: err.code,
        message: err.message,
        ...(err.details !== undefined ? { details: err.details } : {}),
      },
    });
    return;
  }
  const message = err instanceof Error ? err.message : "Internal server error";
  logger.error("Unhandled error", { message, err });
  res.status(500).json({ error: { code: "internal_error", message: "Internal server error" } });
}
