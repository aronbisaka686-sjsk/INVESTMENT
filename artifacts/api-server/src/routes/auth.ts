/**
 * Auth routes — register, login, and current-user.
 *
 * POST /api/auth/register  — create a new user account
 * POST /api/auth/login     — verify credentials, return a JWT
 * GET  /api/auth/me        — return the currently authenticated user
 */
import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { z } from "zod/v4";
import { db, usersTable, selectPublicUserSchema } from "@workspace/db";
import { signToken } from "../lib/jwt";
import { requireAuth, authedUser } from "../middlewares/requireAuth";

const router: IRouter = Router();

const BCRYPT_ROUNDS = 12;

// ── Validation schemas ────────────────────────────────────────────────────────

const RegisterBody = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

const LoginBody = z.object({
  email: z.email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

// ── POST /auth/register ───────────────────────────────────────────────────────

router.post("/auth/register", async (req, res): Promise<void> => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { name, email, password } = parsed.data;

  // Check for duplicate email before hashing (cheap query first)
  const [existing] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.email, email));

  if (existing) {
    res.status(409).json({ error: "An account with this email already exists" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  const [user] = await db
    .insert(usersTable)
    .values({ name, email, passwordHash })
    .returning();

  if (!user) {
    res.status(500).json({ error: "Failed to create user" });
    return;
  }

  const token = signToken({ sub: user.id, email: user.email, name: user.name });
  const publicUser = selectPublicUserSchema.parse(user);

  res.status(201).json({ token, user: publicUser });
});

// ── POST /auth/login ──────────────────────────────────────────────────────────

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { email, password } = parsed.data;

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email));

  // Use a constant-time compare even on "not found" to prevent timing attacks.
  // If no user, compare against a dummy hash so the timing is consistent.
  const DUMMY_HASH = "$2a$12$dummyhashforpreventingtimingattackonlogin.......";
  const hashToCompare = user?.passwordHash ?? DUMMY_HASH;
  const passwordOk = await bcrypt.compare(password, hashToCompare);

  if (!user || !passwordOk) {
    // Return the same message for both "user not found" and "wrong password"
    // to avoid leaking which emails are registered.
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const token = signToken({ sub: user.id, email: user.email, name: user.name });
  const publicUser = selectPublicUserSchema.parse(user);

  res.json({ token, user: publicUser });
});

// ── GET /auth/me ──────────────────────────────────────────────────────────────

router.get("/auth/me", requireAuth, async (req, res): Promise<void> => {
  const { sub: userId } = authedUser(res);

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId));

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json({ user: selectPublicUserSchema.parse(user) });
});

export default router;
