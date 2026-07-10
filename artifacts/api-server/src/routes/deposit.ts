/**
 * Deposit routes — user-initiated deposit request.
 *
 * POST /api/deposit
 *   The user picks a plan and submits the reference number of the bank
 *   transfer they already made.  This creates an investment row with
 *   status = 'pending' and returns it alongside the chosen plan details.
 *   An admin later verifies the payment and activates the investment.
 *
 * GET /api/deposit/plans
 *   Returns all active investment plans so the frontend can build the
 *   plan-picker without hard-coding values.
 */
import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { z } from "zod/v4";
import {
  db,
  investmentsTable,
  investmentPlansTable,
  selectInvestmentSchema,
  selectInvestmentPlanSchema,
} from "@workspace/db";
import { requireAuth, authedUser } from "../middlewares/requireAuth";

const router: IRouter = Router();

// ── Validation ────────────────────────────────────────────────────────────────

const DepositBody = z.object({
  /** UUID of the chosen investment plan */
  planId: z.uuid({ message: "planId must be a valid UUID" }),
  /**
   * The bank / mobile-money transfer reference the user received after
   * sending payment.  e.g. "CBE2024071012345678"
   */
  transactionReference: z
    .string()
    .min(4, "Transaction reference is too short")
    .max(100, "Transaction reference is too long")
    .trim(),
});

// ── GET /deposit/plans ────────────────────────────────────────────────────────

/**
 * List all active plans.  Public — no auth required — so the frontend can
 * display the plan picker before the user is logged in.
 */
router.get("/deposit/plans", async (_req, res): Promise<void> => {
  const plans = await db
    .select()
    .from(investmentPlansTable)
    .where(eq(investmentPlansTable.isActive, true))
    .orderBy(investmentPlansTable.principalEtb);

  res.json(plans.map((p) => selectInvestmentPlanSchema.parse(p)));
});

// ── POST /deposit ─────────────────────────────────────────────────────────────

router.post("/deposit", requireAuth, async (req, res): Promise<void> => {
  const { sub: userId } = authedUser(res);

  // ── 1. Validate request body ──────────────────────────────────────────────
  const parsed = DepositBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error.issues });
    return;
  }

  const { planId, transactionReference } = parsed.data;

  // ── 2. Load and validate the chosen plan ─────────────────────────────────
  const [plan] = await db
    .select()
    .from(investmentPlansTable)
    .where(
      and(
        eq(investmentPlansTable.id, planId),
        eq(investmentPlansTable.isActive, true),
      ),
    )
    .limit(1);

  if (!plan) {
    res.status(404).json({ error: "Investment plan not found or no longer available" });
    return;
  }

  // ── 3. Guard: block duplicate pending deposit for the same plan ───────────
  // Prevents accidental double-submissions while a request is under review.
  const [existing] = await db
    .select({ id: investmentsTable.id })
    .from(investmentsTable)
    .where(
      and(
        eq(investmentsTable.userId, userId),
        eq(investmentsTable.planId, planId),
        eq(investmentsTable.status, "pending"),
      ),
    )
    .limit(1);

  if (existing) {
    res.status(409).json({
      error: "You already have a pending deposit request for this plan. Please wait for it to be reviewed.",
    });
    return;
  }

  // ── 4. Create the pending investment ────────────────────────────────────
  // Amount and rate are copied from the plan so future plan edits don't
  // retroactively change this investment.
  const now = new Date();
  const [investment] = await db
    .insert(investmentsTable)
    .values({
      userId,
      planId: plan.id,
      amountInvested: plan.principalEtb,
      dailyProfitRate: plan.dailyProfitRate,
      transactionReference,
      startDate: now,
      status: "pending",
    })
    .returning();

  // ── 5. Return the new request + plan details ─────────────────────────────
  res.status(201).json({
    deposit: selectInvestmentSchema.parse(investment),
    plan: selectInvestmentPlanSchema.parse(plan),
    message: `Deposit request received. Your ${plan.name} plan (${plan.principalEtb} ETB) is under review. You will be notified once your payment is confirmed.`,
  });
});

export default router;
