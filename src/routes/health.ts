import { Router } from "express";
import { checkBinary } from "../services/ytdlp.js";
import { checkFfmpeg } from "../services/ffmpeg.js";

export const healthRouter: Router = Router();

healthRouter.get("/health", (_req, res) => {
  res.json({ ok: true, uptime: process.uptime() });
});

healthRouter.get("/health/deps", async (_req, res) => {
  const [ytdlp, ffmpeg] = await Promise.all([checkBinary(), checkFfmpeg()]);
  res.json({
    ok: ytdlp.ok && ffmpeg.ok,
    ytdlp,
    ffmpeg,
  });
});
