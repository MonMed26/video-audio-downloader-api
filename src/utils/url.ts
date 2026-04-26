import { ValidationError } from "../errors.js";

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

const PRIVATE_HOSTNAMES = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  // IPv6 unspecified address — routes to localhost on Linux/macOS.
  "::",
]);

const PRIVATE_HOST_REGEX = [
  /^10\./,
  // Entire 127.0.0.0/8 range is loopback, not just 127.0.0.1.
  /^127\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^169\.254\./,
  // IPv6 ULA fc00::/7 — first byte 0xfc or 0xfd, any value for the remaining nibbles.
  // (e.g. fd42:1234::1 must be blocked, not just fd00::*)
  /^f[cd][0-9a-f]{2}:/i,
  // IPv6 link-local fe80::/10 — first byte 0xfe with the high two bits 10 (so 0x80–0xbf).
  /^fe[89ab][0-9a-f]:/i,
  // IPv4-mapped IPv6 (e.g. [::ffff:127.0.0.1] which Node normalizes to ::ffff:7f00:1).
  // Without this, an attacker could bypass the IPv4 private-range checks via IPv6 syntax.
  /^::ffff:/i,
];

export function assertSafePublicUrl(input: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    throw new ValidationError("Invalid URL");
  }
  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
    throw new ValidationError("Only http(s) URLs are allowed");
  }
  // WHATWG URL keeps the brackets around IPv6 hostnames (e.g. "[::1]"),
  // which would defeat both the set lookup and every regex below. Strip them
  // before matching so all IPv6-based SSRF vectors are evaluated correctly.
  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (PRIVATE_HOSTNAMES.has(host)) {
    throw new ValidationError("URL points to a private/local address");
  }
  if (PRIVATE_HOST_REGEX.some((re) => re.test(host))) {
    throw new ValidationError("URL points to a private/local address");
  }
  return parsed;
}
