/**
 * Investment routes — manage a user's active investment plans.
 *
 * All routes require a valid JWT (Authorization: Bearer <token>).
 * Users can only access their own investments.
 *
 * GET    /api/investments         — list all investments for the current user
 * POST   /api/investments         — create a new investment plan
 * GET    /api/investments/:id     — get a single investment
 * PATCH  /api/investments/:id     — update status or daily profit rate
 * DELETE /api/investments/:id     — cancel (delete) an investment
 */
import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { z } from "zod/v4";
import { db, investmentsTable, selectInvestmentSchema } from "@workspace/db";
import { requireAuth, authedUser } from "../middlewares/requireAuth";

const router: IRouter = Router();

// ── Validation schemas ────────────────────────────────────────────────────────

const CreateInvestmentBody = z.object({
  /** Principal in Ethiopian Birr (stored as string to preserve decimal precision) */
  amountInvested: z.string().regex(/^\d+(\.\d{1,2})?$/, "Must be a valid ETB amount"),
  /** Decimal fraction per day, e.g. "0.005000" = 0.5 % / day */
  dailyProfitRate: z.string().regex(/^0\.\d{1,6}$/, "Must be a decimal fraction, e.g. 0.005"),
  startDate: z.iso.datetime({ message: "startDate must be an ISO 8601 datetime" }),
});

const UpdateInvestmentBody = z.object({
  status: z.enum(["active", "completed", "cancelled"]).optional(),
  dailyProfitRate: z
    .string()
    .regex(/^0\.\d{1,6}$/, "Must be a decimal fraction")
    .optional(),
});

const IdParam = z.object({ id: z.uuid() });

// ── GET /investments ──────────────────────────────────────────────────────────

router.get("/investments", requireAuth, async (_req, res): Promise<void> => {
  const { sub: userId } = authedUser(res);

  const investments = await db
    .select()
    .from(investmentsTable)
    .where(eq(investmentsTable.userId, userId))
    .orderBy(investmentsTable.createdAt);

  res.json(investments.map((i) => selectInvestmentSchema.parse(i)));
});

// ── POST /investments ─────────────────────────────────────────────────────────

router.post("/investments", requireAuth, async (req, res): Promise<void> => {
  const { sub: userId } = authedUser(res);

  const parsed = CreateInvestmentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { amountInvested, dailyProfitRate, startDate } = parsed.data;

  const [investment] = await db
    .insert(investmentsTable)
    .values({
      userId,
      amountInvested,
      dailyProfitRate,
      startDate: new Date(startDate),
    })
    .returning();

  res.status(201).json(selectInvestmentSchema.parse(investment));
});

// ── GET /investments/:id ──────────────────────────────────────────────────────

router.get("/investments/:id", requireAuth, async (req, res): Promise<void> => {
  const { sub: userId } = authedUser(res);

  const params = IdParam.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid investment ID" });
    return;
  }

  const [investment] = await db
    .select()
    .from(investmentsTable)
    .where(
      and(
        eq(investmentsTable.id, params.data.id),
        eq(investmentsTable.userId, userId),
      ),
    );

  if (!investment) {
    res.status(404).json({ error: "Investment not found" });
    return;
  }

  res.json(selectInvestmentSchema.parse(investment));
});

// ── PATCH /investments/:id ────────────────────────────────────────────────────

router.patch("/investments/:id", requireAuth, async (req, res): Promise<void> => {
  const { sub: userId } = authedUser(res);

  const params = IdParam.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid investment ID" });
    return;
  }

  const parsed = UpdateInvestmentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  if (Object.keys(parsed.data).length === 0) {
    res.status(400).json({ error: "No fields provided to update" });
    return;
  }

  const [investment] = await db
    .update(investmentsTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(
      and(
        eq(investmentsTable.id, params.data.id),
        eq(investmentsTable.userId, userId),
      ),
    )
    .returning();

  if (!investment) {
    res.status(404).json({ error: "Investment not found" });
    return;
  }

  res.json(selectInvestmentSchema.parse(investment));
});

// ── DELETE /investments/:id ───────────────────────────────────────────────────

router.delete("/investments/:id", requireAuth, async (req, res): Promise<void> => {
  const { sub: userId } = authedUser(res);

  const params = IdParam.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid investment ID" });
    return;
  }

  const [deleted] = await db
    .delete(investmentsTable)
    .where(
      and(
        eq(investmentsTable.id, params.data.id),
        eq(investmentsTable.userId, userId),
      ),
    )
    .returning({ id: investmentsTable.id });

  if (!deleted) {
    res.status(404).json({ error: "Investment not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
