import "dotenv/config";
import path from "node:path";

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) {
    throw new Error(`Invalid integer for env ${name}: ${raw}`);
  }
  return n;
}

function envStr(name: string, fallback: string): string {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  return raw;
}

const downloadDirRaw = envStr("DOWNLOAD_DIR", "./downloads");
const downloadDir = path.isAbsolute(downloadDirRaw)
  ? downloadDirRaw
  : path.resolve(process.cwd(), downloadDirRaw);

export const config = {
  port: envInt("PORT", 3000),
  host: envStr("HOST", "0.0.0.0"),
  publicBaseUrl: envStr("PUBLIC_BASE_URL", "http://localhost:3000").replace(/\/+$/, ""),
  downloadDir,
  fileTtlMinutes: envInt("FILE_TTL_MINUTES", 60),
  maxFileSizeMb: envInt("MAX_FILE_SIZE_MB", 2048),
  ytdlpPath: envStr("YTDLP_PATH", "yt-dlp"),
  ffmpegPath: envStr("FFMPEG_PATH", "ffmpeg"),
  rateLimit: {
    windowMinutes: envInt("RATE_LIMIT_WINDOW_MINUTES", 15),
    max: envInt("RATE_LIMIT_MAX", 60),
  },
  apiKey: process.env.API_KEY || "",
} as const;

export type Config = typeof config;
