import { Router } from "express";
import { z } from "zod";
import { getInfo } from "../services/ytdlp.js";
import { assertSafePublicUrl } from "../utils/url.js";
import { ValidationError } from "../errors.js";

const querySchema = z.object({
  url: z.string().min(1, "url is required"),
});

export const infoRouter: Router = Router();

infoRouter.get("/info", async (req, res, next) => {
  try {
    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new ValidationError("Invalid query", parsed.error.flatten());
    }
    const url = assertSafePublicUrl(parsed.data.url).toString();
    const info = await getInfo(url);

    const formats = (info.formats ?? [])
      .filter((f) => f.vcodec !== "none" || f.acodec !== "none")
      .map((f) => ({
        format_id: f.format_id,
        ext: f.ext,
        resolution: f.resolution ?? (f.height ? `${f.height}p` : undefined),
        height: f.height,
        fps: f.fps,
        vcodec: f.vcodec,
        acodec: f.acodec,
        abr: f.abr,
        filesize: f.filesize ?? f.filesize_approx,
      }));

    res.json({
      id: info.id,
      title: info.title,
      uploader: info.uploader,
      duration: info.duration,
      thumbnail: info.thumbnail,
      source: info.webpage_url ?? url,
      extractor: info.extractor,
      formats,
    });
  } catch (err) {
    next(err);
  }
});
