import type { Request, Response, NextFunction } from "express";
import { config } from "../config.js";

export function apiKeyAuth(req: Request, res: Response, next: NextFunction): void {
  if (!config.apiKey) {
    next();
    return;
  }
  const provided = req.header("x-api-key");
  if (provided !== config.apiKey) {
    res.status(401).json({ error: { code: "unauthorized", message: "Invalid or missing API key" } });
    return;
  }
  next();
}
