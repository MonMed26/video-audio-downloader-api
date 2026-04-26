import { spawn } from "node:child_process";
import path from "node:path";
import { config } from "../config.js";
import { UpstreamError } from "../errors.js";
import { logger } from "../logger.js";

/**
 * Whether the given `--ffmpeg-location` value is something yt-dlp can use directly.
 * yt-dlp expects an absolute path to an ffmpeg binary, or a directory containing it.
 * If the value is a bare command name like `"ffmpeg"`, passing it via
 * `--ffmpeg-location` overrides yt-dlp's own PATH discovery and breaks postprocessing
 * even when ffmpeg is on the system PATH. In that case we should let yt-dlp resolve
 * ffmpeg itself.
 */
function shouldPassFfmpegLocation(p: string): boolean {
  if (!p) return false;
  if (path.isAbsolute(p)) return true;
  return /[\\/]/.test(p);
}

export interface VideoInfo {
  id: string;
  title: string;
  uploader?: string;
  duration?: number;
  thumbnail?: string;
  webpage_url?: string;
  extractor?: string;
  ext?: string;
  formats?: Array<{
    format_id: string;
    ext: string;
    resolution?: string;
    height?: number;
    fps?: number;
    vcodec?: string;
    acodec?: string;
    abr?: number;
    filesize?: number;
    filesize_approx?: number;
  }>;
}

interface RunResult {
  stdout: string;
  stderr: string;
  code: number;
}

function run(args: string[], opts: { timeoutMs?: number } = {}): Promise<RunResult> {
  const { timeoutMs = 5 * 60_000 } = opts;
  return new Promise((resolve, reject) => {
    logger.debug("yt-dlp", { bin: config.ytdlpPath, args });
    const child = spawn(config.ytdlpPath, args, {
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new UpstreamError("yt-dlp timed out"));
    }, timeoutMs);

    child.stdout.on("data", (c: Buffer) => stdoutChunks.push(c));
    child.stderr.on("data", (c: Buffer) => stderrChunks.push(c));

    child.on("error", (err) => {
      clearTimeout(timer);
      reject(new UpstreamError(`Failed to spawn yt-dlp: ${err.message}`));
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({
        stdout: Buffer.concat(stdoutChunks).toString("utf8"),
        stderr: Buffer.concat(stderrChunks).toString("utf8"),
        code: code ?? -1,
      });
    });
  });
}

export async function getInfo(url: string): Promise<VideoInfo> {
  const args = [
    "--no-warnings",
    "--no-playlist",
    "--dump-single-json",
    url,
  ];
  const { stdout, stderr, code } = await run(args, { timeoutMs: 60_000 });
  if (code !== 0) {
    throw new UpstreamError("yt-dlp failed to fetch metadata", {
      stderr: stderr.slice(-1000),
    });
  }
  try {
    return JSON.parse(stdout) as VideoInfo;
  } catch {
    throw new UpstreamError("yt-dlp returned invalid JSON");
  }
}

export interface DownloadOptions {
  url: string;
  type: "video" | "audio";
  outputTemplate: string;
  /** ffmpeg location, passed to yt-dlp */
  ffmpegLocation?: string;
  /** Hard limit on output filesize (in MB) — yt-dlp uses this when picking formats */
  maxFileSizeMb?: number;
}

export interface DownloadResult {
  /** Final filename written by yt-dlp (no path) */
  filename: string;
  stderrTail: string;
}

/**
 * Run yt-dlp to download the requested file. Uses --print after_move:filepath
 * so we know exactly what file ended up on disk after merging/post-processing.
 */
export async function download(opts: DownloadOptions): Promise<DownloadResult> {
  const args: string[] = [
    "--no-warnings",
    "--no-playlist",
    "--restrict-filenames",
    "--no-mtime",
    "-o",
    opts.outputTemplate,
    "--print",
    "after_move:filepath",
    "--no-simulate",
  ];

  if (opts.ffmpegLocation && shouldPassFfmpegLocation(opts.ffmpegLocation)) {
    args.push("--ffmpeg-location", opts.ffmpegLocation);
  }

  if (opts.type === "audio") {
    args.push(
      "-f",
      "bestaudio/best",
      "--extract-audio",
      "--audio-format",
      "mp3",
      "--audio-quality",
      "0",
      "--embed-thumbnail",
      "--add-metadata",
    );
  } else {
    args.push(
      "-f",
      "bestvideo*+bestaudio/best",
      "--merge-output-format",
      "mp4",
      "--add-metadata",
    );
  }

  if (opts.maxFileSizeMb && opts.maxFileSizeMb > 0) {
    args.push("--max-filesize", `${opts.maxFileSizeMb}M`);
  }

  args.push(opts.url);

  const { stdout, stderr, code } = await run(args, { timeoutMs: 30 * 60_000 });
  if (code !== 0) {
    throw new UpstreamError("yt-dlp failed to download media", {
      stderr: stderr.slice(-1500),
    });
  }
  const lines = stdout
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const filepath = lines[lines.length - 1];
  if (!filepath) {
    throw new UpstreamError("yt-dlp did not report an output filepath", {
      stderr: stderr.slice(-1500),
    });
  }
  // Extract just the basename — yt-dlp prints the full path it wrote.
  const filename = filepath.split(/[\\/]/).pop() as string;
  return { filename, stderrTail: stderr.slice(-500) };
}

export async function checkBinary(): Promise<{ ok: boolean; version?: string; error?: string }> {
  try {
    const { stdout, code } = await run(["--version"], { timeoutMs: 10_000 });
    if (code !== 0) return { ok: false, error: "non-zero exit" };
    return { ok: true, version: stdout.trim() };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
