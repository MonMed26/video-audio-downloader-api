import fs from "node:fs/promises";
import path from "node:path";
import { config } from "../config.js";
import { logger } from "../logger.js";

const CLEANUP_INTERVAL_MS = 5 * 60_000;

async function sweep(): Promise<void> {
  const ttlMs = config.fileTtlMinutes * 60_000;
  if (ttlMs <= 0) return;
  let entries: string[];
  try {
    entries = await fs.readdir(config.downloadDir);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return;
    logger.warn("cleanup readdir failed", { err: String(err) });
    return;
  }
  const now = Date.now();
  for (const name of entries) {
    const full = path.join(config.downloadDir, name);
    try {
      const stat = await fs.stat(full);
      if (!stat.isFile()) continue;
      const age = now - stat.mtimeMs;
      if (age > ttlMs) {
        await fs.unlink(full);
        logger.info("cleanup removed expired file", { file: name, ageMin: Math.round(age / 60_000) });
      }
    } catch (err) {
      logger.warn("cleanup failed for entry", { entry: name, err: String(err) });
    }
  }
}

export function startCleanupJob(): void {
  // Run once on boot, then on an interval.
  void sweep();
  const handle = setInterval(() => {
    void sweep();
  }, CLEANUP_INTERVAL_MS);
  // Allow the process to exit cleanly during tests/shutdown.
  handle.unref?.();
  logger.info("cleanup job started", {
    intervalMs: CLEANUP_INTERVAL_MS,
    ttlMinutes: config.fileTtlMinutes,
  });
}
