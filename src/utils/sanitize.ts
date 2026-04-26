/**
 * Replace characters that are unsafe for filesystems.
 * Keeps unicode letters/numbers, replaces other chars with `_`.
 */
export function sanitizeFilename(input: string, maxLen = 80): string {
  const cleaned = input
    .normalize("NFKD")
    // eslint-disable-next-line no-control-regex
    .replace(/[\\/:*?"<>|\x00-\x1f]+/g, "_")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.slice(0, maxLen) || "file";
}
