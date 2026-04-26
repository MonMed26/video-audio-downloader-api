import { ValidationError } from "../errors.js";

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

const PRIVATE_HOSTNAMES = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1"]);

const PRIVATE_HOST_REGEX = [
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^169\.254\./,
  /^fc00::/i,
  /^fd00::/i,
  /^fe80::/i,
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
  const host = parsed.hostname.toLowerCase();
  if (PRIVATE_HOSTNAMES.has(host)) {
    throw new ValidationError("URL points to a private/local address");
  }
  if (PRIVATE_HOST_REGEX.some((re) => re.test(host))) {
    throw new ValidationError("URL points to a private/local address");
  }
  return parsed;
}
