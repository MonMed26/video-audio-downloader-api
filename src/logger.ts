type Level = "info" | "warn" | "error" | "debug";

function fmt(level: Level, msg: string, meta?: unknown): string {
  const ts = new Date().toISOString();
  const base = `[${ts}] [${level.toUpperCase()}] ${msg}`;
  if (meta === undefined) return base;
  try {
    return `${base} ${JSON.stringify(meta)}`;
  } catch {
    return `${base} ${String(meta)}`;
  }
}

export const logger = {
  info: (msg: string, meta?: unknown) => console.log(fmt("info", msg, meta)),
  warn: (msg: string, meta?: unknown) => console.warn(fmt("warn", msg, meta)),
  error: (msg: string, meta?: unknown) => console.error(fmt("error", msg, meta)),
  debug: (msg: string, meta?: unknown) => {
    if (process.env.DEBUG) console.log(fmt("debug", msg, meta));
  },
};
