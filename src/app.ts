import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import { config } from "./config.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { apiKeyAuth } from "./middleware/apiKey.js";
import { healthRouter } from "./routes/health.js";
import { infoRouter } from "./routes/info.js";
import { downloadRouter } from "./routes/download.js";
import { filesRouter } from "./routes/files.js";

export function createApp(): Express {
  const app = express();

  app.disable("x-powered-by");
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(cors());
  app.use(compression());
  app.use(express.json({ limit: "1mb" }));
  app.use(morgan("tiny"));

  const limiter = rateLimit({
    windowMs: config.rateLimit.windowMinutes * 60_000,
    max: config.rateLimit.max,
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.get("/", (_req, res) => {
    res.json({
      name: "video-audio-downloader-api",
      version: "1.0.0",
      endpoints: ["/health", "/health/deps", "/api/info", "/api/download", "/files/:filename"],
    });
  });

  app.use("/", healthRouter);

  // Protect the API surface with rate limiting + optional API key.
  app.use("/api", limiter, apiKeyAuth, infoRouter);
  app.use("/api", limiter, apiKeyAuth, downloadRouter);

  // Public file serving (URLs returned by /api/download)
  app.use("/", filesRouter);

  app.use((_req, res) => {
    res.status(404).json({ error: { code: "not_found", message: "Route not found" } });
  });

  app.use(errorHandler);

  return app;
}
