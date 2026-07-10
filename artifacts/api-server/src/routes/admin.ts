/**
 * Admin routes — deposit management.
 *
 * All routes require the X-Admin-Key header to match ADMIN_SECRET.
 *
 * GET  /api/admin/pending-deposits
 *   Returns every investment currently in 'pending' status, joined with
 *   the submitting user and the chosen plan, ordered oldest-first so the
 *   backlog is worked through in submission order.
 *
 * POST /api/admin/approve-deposit
 *   Activates a pending investment:
 *     1. Flips status  pending → active
 *     2. Sets lastCreditedAt = now  (starts the daily profit clock)
 *     3. Adds the plan's daily profit to the user's total_daily_earnings_etb
 *   All three writes happen in a single DB transaction.
 */
import { Router, type IRouter } from "express";
import { eq, and, sql } from "drizzle-orm";
import { z } from "zod/v4";
import {
  db,
  investmentsTable,
  investmentPlansTable,
  usersTable,
  selectInvestmentSchema,
  selectPublicUserSchema,
  selectInvestmentPlanSchema,
} from "@workspace/db";
import { requireAdmin } from "../middlewares/requireAdmin";

const router: IRouter = Router();

// ── GET /admin/pending-deposits ───────────────────────────────────────────────

router.get(
  "/admin/pending-deposits",
  requireAdmin,
  async (_req, res): Promise<void> => {
    // Join investments → users and investments → investment_plans in one query
    const rows = await db
      .select({
        investment: investmentsTable,
        user: {
          id:        usersTable.id,
          name:      usersTable.name,
          email:     usersTable.email,
          balanceEtb: usersTable.balanceEtb,
        },
        plan: investmentPlansTable,
      })
      .from(investmentsTable)
      .innerJoin(usersTable,           eq(investmentsTable.userId, usersTable.id))
      .leftJoin(investmentPlansTable,  eq(investmentsTable.planId, investmentPlansTable.id))
      .where(eq(investmentsTable.status, "pending"))
      .orderBy(investmentsTable.createdAt); // oldest first → work through backlog in order

    const payload = rows.map((row) => ({
      investment: selectInvestmentSchema.parse(row.investment),
      user:       selectPublicUserSchema.omit({ createdAt: true, totalDailyEarningsEtb: true }).parse(row.user),
      plan:       row.plan ? selectInvestmentPlanSchema.parse(row.plan) : null,
    }));

    res.json({
      count:   payload.length,
      pending: payload,
    });
  },
);

// ── POST /admin/approve-deposit ───────────────────────────────────────────────

const ApproveBody = z.object({
  investmentId: z.uuid({ message: "investmentId must be a valid UUID" }),
});

router.post(
  "/admin/approve-deposit",
  requireAdmin,
  async (req, res): Promise<void> => {
    // ── 1. Validate body ────────────────────────────────────────────────────
    const parsed = ApproveBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request", details: parsed.error.issues });
      return;
    }

    const { investmentId } = parsed.data;

    // ── 2. Load the investment and verify it is still pending ───────────────
    const [investment] = await db
      .select()
      .from(investmentsTable)
      .where(
        and(
          eq(investmentsTable.id, investmentId),
          eq(investmentsTable.status, "pending"),
        ),
      )
      .limit(1);

    if (!investment) {
      res.status(404).json({
        error: "Pending investment not found. It may have already been approved or does not exist.",
      });
      return;
    }

    // ── 3. Compute daily earnings to credit to the user ─────────────────────
    // If the investment is linked to a plan, use the plan's stored dailyProfitEtb
    // for precision.  Otherwise derive it from the investment's own fields.
    let dailyEarningEtb: string;

    if (investment.planId) {
      const [plan] = await db
        .select({ dailyProfitEtb: investmentPlansTable.dailyProfitEtb })
        .from(investmentPlansTable)
        .where(eq(investmentPlansTable.id, investment.planId))
        .limit(1);

      dailyEarningEtb = plan
        ? plan.dailyProfitEtb
        : (parseFloat(investment.amountInvested) * parseFloat(investment.dailyProfitRate)).toFixed(2);
    } else {
      dailyEarningEtb = (
        parseFloat(investment.amountInvested) * parseFloat(investment.dailyProfitRate)
      ).toFixed(2);
    }

    const now = new Date();

    // ── 4. Atomic approval transaction ────────────────────────────────────
    // All three writes succeed together or roll back together.
    const [activatedInvestment, updatedUser] = await db.transaction(async (tx) => {
      // 4a. Activate the investment and start the profit clock
      const [inv] = await tx
        .update(investmentsTable)
        .set({
          status:         "active",
          lastCreditedAt: now,   // profit accrual starts from this moment
          updatedAt:      now,
        })
        .where(
          and(
            eq(investmentsTable.id, investmentId),
            eq(investmentsTable.status, "pending"), // re-check inside tx (guard against races)
          ),
        )
        .returning();

      if (!inv) {
        // Another concurrent approval beat us — roll back cleanly
        tx.rollback();
        return [null, null];
      }

      // 4b. Add this plan's daily earning to the user's running total
      const [user] = await tx
        .update(usersTable)
        .set({
          totalDailyEarningsEtb: sql`${usersTable.totalDailyEarningsEtb} + ${dailyEarningEtb}::numeric`,
        })
        .where(eq(usersTable.id, investment.userId))
        .returning({
          id:                   usersTable.id,
          name:                 usersTable.name,
          email:                usersTable.email,
          balanceEtb:           usersTable.balanceEtb,
          totalDailyEarningsEtb: usersTable.totalDailyEarningsEtb,
        });

      return [inv, user];
    });

    if (!activatedInvestment || !updatedUser) {
      res.status(409).json({
        error: "Investment was already approved by a concurrent request.",
      });
      return;
    }

    // ── 5. Respond ──────────────────────────────────────────────────────────
    res.json({
      investment:         selectInvestmentSchema.parse(activatedInvestment),
      user:               updatedUser,
      dailyEarningAdded:  dailyEarningEtb,
      message:            `Investment approved. User now earns ${updatedUser.totalDailyEarningsEtb} ETB/day total.`,
    });
  },
);

export default router;
