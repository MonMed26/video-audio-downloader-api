import { Router } from "express";
import path from "node:path";
import fs from "node:fs/promises";
import { nanoid } from "nanoid";
import { z } from "zod";
import { config } from "../config.js";
import { HttpError, UpstreamError, ValidationError } from "../errors.js";
import { download } from "../services/ytdlp.js";
import { checkFfmpeg } from "../services/ffmpeg.js";
import { assertSafePublicUrl } from "../utils/url.js";

const bodySchema = z.object({
  url: z.string().min(1),
  type: z.enum(["video", "audio"]).default("video"),
});

export const downloadRouter: Router = Router();

downloadRouter.post("/download", async (req, res, next) => {
  try {
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError("Invalid body", parsed.error.flatten());
    }
    const url = assertSafePublicUrl(parsed.data.url).toString();
    const type = parsed.data.type;

    // Pre-flight: ffmpeg is required for both flows (video merge + MP3 extraction).
    // Detect missing binary up front so the client gets a clear actionable error
    // instead of an opaque "yt-dlp failed" upstream message.
    const ffmpegProbe = await checkFfmpeg();
    if (!ffmpegProbe.ok) {
      throw new HttpError(
        500,
        "ffmpeg_missing",
        "ffmpeg binary not found on the server. Install ffmpeg and restart, or set FFMPEG_PATH in .env to its absolute path.",
        { ffmpegPath: config.ffmpegPath, probeError: ffmpegProbe.error },
      );
    }

    await fs.mkdir(config.downloadDir, { recursive: true });

    const jobId = nanoid(12);
    // Use yt-dlp's own templating. We constrain the basename so we can predict
    // and serve the file. yt-dlp will append the correct extension.
    const outputTemplate = path.join(config.downloadDir, `${jobId}.%(ext)s`);

    let filename: string;
    try {
      const result = await download({
        url,
        type,
        outputTemplate,
        ffmpegLocation: config.ffmpegPath,
        maxFileSizeMb: config.maxFileSizeMb,
      });
      filename = result.filename;
    } catch (err) {
      // Map yt-dlp's well-known error patterns to clearer client errors.
      if (err instanceof UpstreamError) {
        const stderr =
          (err.details && typeof err.details === "object" && "stderr" in err.details
            ? String((err.details as { stderr?: unknown }).stderr ?? "")
            : "") || "";
        if (/ffmpeg not found/i.test(stderr) || /ffmpeg-location/i.test(stderr)) {
          throw new HttpError(
            500,
            "ffmpeg_missing",
            "yt-dlp could not locate ffmpeg. Install ffmpeg and restart, or set FFMPEG_PATH in .env.",
            { stderrTail: stderr.slice(-500) },
          );
        }
        if (/Unsupported URL/i.test(stderr) || /No video formats found/i.test(stderr)) {
          throw new HttpError(
            400,
            "unsupported_url",
            "yt-dlp does not support this URL or could not find any media on it.",
            { stderrTail: stderr.slice(-500) },
          );
        }
      }
      throw err;
    }

    const filePath = path.join(config.downloadDir, filename);
    let size = 0;
    try {
      const stat = await fs.stat(filePath);
      size = stat.size;
    } catch {
      // ignore — file should exist; if not, yt-dlp would have failed.
    }

    const downloadUrl = `${config.publicBaseUrl}/files/${encodeURIComponent(filename)}`;
    const expiresAt = new Date(Date.now() + config.fileTtlMinutes * 60_000).toISOString();

    res.json({
      id: jobId,
      type,
      filename,
      size,
      downloadUrl,
      expiresAt,
    });
  } catch (err) {
    next(err);
  }
});
