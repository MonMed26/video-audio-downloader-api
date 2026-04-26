import fs from "node:fs/promises";
import { createApp } from "./app.js";
import { config } from "./config.js";
import { logger } from "./logger.js";
import { startCleanupJob } from "./services/cleanup.js";
import { checkBinary } from "./services/ytdlp.js";
import { checkFfmpeg } from "./services/ffmpeg.js";

async function main(): Promise<void> {
  await fs.mkdir(config.downloadDir, { recursive: true });

  const [ytdlpProbe, ffmpegProbe] = await Promise.all([checkBinary(), checkFfmpeg()]);
  if (!ytdlpProbe.ok) {
    logger.warn("yt-dlp not detected at startup — install it before downloading", {
      ytdlpPath: config.ytdlpPath,
      error: ytdlpProbe.error,
    });
  } else {
    logger.info("yt-dlp ready", { version: ytdlpProbe.version });
  }
  if (!ffmpegProbe.ok) {
    logger.warn(
      "ffmpeg not detected at startup — video merge & MP3 conversion will fail. " +
        "Install ffmpeg or set FFMPEG_PATH in .env",
      { ffmpegPath: config.ffmpegPath, error: ffmpegProbe.error },
    );
  } else {
    logger.info("ffmpeg ready", { version: ffmpegProbe.version });
  }

  startCleanupJob();

  const app = createApp();
  app.listen(config.port, config.host, () => {
    logger.info("server listening", {
      url: `http://${config.host}:${config.port}`,
      publicBaseUrl: config.publicBaseUrl,
      downloadDir: config.downloadDir,
    });
  });
}

main().catch((err) => {
  logger.error("fatal", { err: err instanceof Error ? err.stack : err });
  process.exit(1);
});
