import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { apiKeyAuth } from "./middleware/apiKey.js";
import { healthRouter } from "./routes/health.js";
import { infoRouter } from "./routes/info.js";
import { downloadRouter } from "./routes/download.js";
import { filesRouter } from "./routes/files.js";

// Serve the static frontend from <repo>/web alongside the API for local dev.
// Vercel deploys only the contents of web/ — the same files work in both modes.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WEB_DIR = path.resolve(__dirname, "..", "web");

export function createApp(): Express {
  const app = express();

  app.disable("x-powered-by");
  // Helmet defaults are friendly to JSON APIs but block CDN-loaded scripts/styles
  // we use for the frontend (Tailwind CDN, Google Fonts, inline event handlers).
  // We disable CSP and COEP here so the bundled UI works out of the box; tighten
  // these in production if you serve only the API.
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: "cross-origin" },
    }),
  );
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

  app.get("/api", (_req, res) => {
    res.json({
      name: "video-audio-downloader-api",
      version: "1.0.0",
      endpoints: ["/health", "/health/deps", "/api/info", "/api/download", "/files/:filename"],
    });
  });

  app.use("/", healthRouter);

  // Protect the API surface with rate limiting + optional API key.
  // Both routers are mounted on a single app.use so the limiter and
  // auth middleware run exactly once per /api request.
  app.use("/api", limiter, apiKeyAuth, infoRouter, downloadRouter);

  // Public file serving (URLs returned by /api/download)
  app.use("/", filesRouter);

  // Static frontend (web/) — served at the root.
  app.use("/", express.static(WEB_DIR, { fallthrough: true, maxAge: "1h", index: "index.html" }));

  app.use((_req, res) => {
    res.status(404).json({ error: { code: "not_found", message: "Route not found" } });
  });

  app.use(errorHandler);

  return app;
}
