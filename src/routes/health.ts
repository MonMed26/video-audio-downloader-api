import { Router } from "express";
import { checkBinary } from "../services/ytdlp.js";

export const healthRouter: Router = Router();

healthRouter.get("/health", (_req, res) => {
  res.json({ ok: true, uptime: process.uptime() });
});

healthRouter.get("/health/deps", async (_req, res) => {
  const ytdlp = await checkBinary();
  res.json({
    ok: ytdlp.ok,
    ytdlp,
  });
});
