import { Router } from "express";
import path from "node:path";
import fs from "node:fs";
import fsp from "node:fs/promises";
import { config } from "../config.js";
import { HttpError } from "../errors.js";

export const filesRouter: Router = Router();

filesRouter.get("/files/:filename", async (req, res, next) => {
  try {
    const requested = req.params.filename;
    // Disallow path traversal — only allow a flat filename.
    if (requested.includes("/") || requested.includes("\\") || requested.includes("..")) {
      throw new HttpError(400, "bad_filename", "Invalid filename");
    }
    const fullPath = path.join(config.downloadDir, requested);
    // Defensive: ensure resolved path is still inside DOWNLOAD_DIR.
    const resolved = path.resolve(fullPath);
    const baseResolved = path.resolve(config.downloadDir);
    if (!resolved.startsWith(baseResolved + path.sep) && resolved !== baseResolved) {
      throw new HttpError(400, "bad_filename", "Invalid filename");
    }
    try {
      await fsp.access(resolved, fs.constants.R_OK);
    } catch {
      throw new HttpError(404, "not_found", "File not found or expired");
    }
    res.download(resolved, requested, (err) => {
      if (err && !res.headersSent) next(err);
    });
  } catch (err) {
    next(err);
  }
});
