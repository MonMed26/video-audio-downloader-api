import { spawn } from "node:child_process";
import { config } from "../config.js";

export async function checkFfmpeg(): Promise<{ ok: boolean; version?: string; error?: string }> {
  return new Promise((resolve) => {
    const child = spawn(config.ffmpegPath, ["-version"], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      resolve({ ok: false, error: "ffmpeg -version timed out" });
    }, 10_000);
    child.stdout.on("data", (c: Buffer) => stdoutChunks.push(c));
    child.stderr.on("data", (c: Buffer) => stderrChunks.push(c));
    child.on("error", (err) => {
      clearTimeout(timer);
      resolve({ ok: false, error: `Failed to spawn ffmpeg: ${err.message}` });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        resolve({ ok: false, error: "non-zero exit" });
        return;
      }
      const out = Buffer.concat(stdoutChunks).toString("utf8");
      const firstLine = out.split("\n")[0]?.trim() ?? "";
      resolve({ ok: true, version: firstLine });
    });
  });
}
