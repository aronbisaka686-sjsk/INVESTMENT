/**
 * requireAdmin middleware
 *
 * Protects admin-only routes with a static secret key.
 * The caller must send the header:
 *
 *   X-Admin-Key: <value of ADMIN_SECRET env var>
 *
 * Responses:
 *   401 — header missing
 *   403 — header present but value is wrong
 *
 * The secret is read once at module load.  If ADMIN_SECRET is not set the
 * server will refuse to start (enforced in src/index.ts via the startup
 * check — see below).
 */
import type { Request, Response, NextFunction } from "express";

const ADMIN_SECRET = process.env["ADMIN_SECRET"];

if (!ADMIN_SECRET) {
  // Fail hard at startup so a misconfigured server never silently accepts
  // admin requests without a secret.
  throw new Error(
    "ADMIN_SECRET environment variable is not set. " +
      "Set it in Replit Secrets before starting the server.",
  );
}

export function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const provided = req.headers["x-admin-key"];

  if (!provided) {
    res.status(401).json({ error: "Admin key required (X-Admin-Key header)" });
    return;
  }

  // Constant-time comparison to prevent timing attacks
  const expected = Buffer.from(ADMIN_SECRET as string);
  const actual   = Buffer.from(String(provided));

  if (
    actual.length !== expected.length ||
    !require("crypto").timingSafeEqual(actual, expected)
  ) {
    res.status(403).json({ error: "Invalid admin key" });
    return;
  }

  next();
}
