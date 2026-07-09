/**
 * requireAuth — Express middleware that enforces JWT authentication.
 *
 * Reads the `Authorization: Bearer <token>` header, verifies the token,
 * and attaches the decoded payload to `res.locals.user`.
 *
 * Returns 401 if the header is missing or the token is invalid/expired.
 *
 * Usage in routes:
 *   import { requireAuth, authedUser } from "../middlewares/requireAuth";
 *   router.get("/me", requireAuth, async (req, res) => {
 *     const user = authedUser(res); // { sub, email, name }
 *   });
 */
import type { Request, Response, NextFunction } from "express";
import { verifyToken, type JwtPayload } from "../lib/jwt";

/** Key used to stash the verified payload in res.locals */
const USER_KEY = "jwtUser";

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers["authorization"];
  if (!header || !header.startsWith("Bearer ")) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const token = header.slice("Bearer ".length);
  const payload = verifyToken(token);

  if (!payload) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }

  // Store payload for route handlers — avoids global Request augmentation
  // which can conflict with tsconfig "types" restrictions.
  res.locals[USER_KEY] = payload;
  next();
}

/**
 * Retrieve the authenticated user from res.locals.
 * Call only inside routes protected by `requireAuth`.
 */
export function authedUser(res: Response): JwtPayload {
  const user = res.locals[USER_KEY] as JwtPayload | undefined;
  if (!user) {
    throw new Error("authedUser() called outside an authenticated route");
  }
  return user;
}
