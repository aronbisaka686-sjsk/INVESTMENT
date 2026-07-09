/**
 * JWT utilities — sign and verify tokens for stateless auth.
 *
 * Tokens carry { sub (userId), email, name } and expire in 7 days.
 * The secret is read once at module load so a missing JWT_SECRET
 * crashes the server immediately rather than failing on first use.
 */
import jwt from "jsonwebtoken";

export interface JwtPayload {
  /** User's UUID from the users table */
  sub: string;
  email: string;
  name: string;
}

const JWT_EXPIRES_IN = "7d";

function loadSecret(): string {
  const s = process.env["JWT_SECRET"];
  if (!s) {
    throw new Error(
      "JWT_SECRET environment variable is required. " +
        "Add it in Replit Secrets (Tools → Secrets).",
    );
  }
  return s;
}

const JWT_SECRET = loadSecret();

/** Sign a new token for the given user. */
export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/**
 * Verify a token and return its payload.
 * Returns `null` if the token is invalid, expired, or tampered with.
 */
export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    return null;
  }
}
