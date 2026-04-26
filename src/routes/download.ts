import { Router } from "express";
import path from "node:path";
import fs from "node:fs/promises";
import { nanoid } from "nanoid";
import { z } from "zod";
import { config } from "../config.js";
import { ValidationError } from "../errors.js";
import { download } from "../services/ytdlp.js";
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

    await fs.mkdir(config.downloadDir, { recursive: true });

    const jobId = nanoid(12);
    // Use yt-dlp's own templating. We constrain the basename so we can predict
    // and serve the file. yt-dlp will append the correct extension.
    const outputTemplate = path.join(config.downloadDir, `${jobId}.%(ext)s`);

    const { filename } = await download({
      url,
      type,
      outputTemplate,
      ffmpegLocation: config.ffmpegPath,
      maxFileSizeMb: config.maxFileSizeMb,
    });

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
