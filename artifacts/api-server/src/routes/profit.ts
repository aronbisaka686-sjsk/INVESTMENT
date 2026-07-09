/**
 * Profit routes — preview and credit daily investment returns.
 *
 * All routes require a valid JWT (Authorization: Bearer <token>).
 * Operations are scoped to the authenticated user's investments only.
 *
 * GET  /api/profit/preview  — show pending profit for all active investments
 * POST /api/profit/credit   — credit all pending profits (whole days only)
 */
import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, investmentsTable } from "@workspace/db";
import { requireAuth, authedUser } from "../middlewares/requireAuth";
import {
  previewProfits,
  creditProfitsForUser,
} from "../services/profitCredit";

const router: IRouter = Router();

// ── GET /profit/preview ───────────────────────────────────────────────────────

router.get("/profit/preview", requireAuth, async (_req, res): Promise<void> => {
  const { sub: userId } = authedUser(res);

  const investments = await db
    .select()
    .from(investmentsTable)
    .where(
      and(
        eq(investmentsTable.userId, userId),
        eq(investmentsTable.status, "active"),
      ),
    );

  const previews = previewProfits(investments);
  const totalPending = previews
    .reduce((sum, p) => sum + parseFloat(p.pendingProfit), 0)
    .toFixed(2);

  res.json({
    investments: previews,
    totalPendingProfit: totalPending,
    currency: "ETB",
  });
});

// ── POST /profit/credit ───────────────────────────────────────────────────────

router.post("/profit/credit", requireAuth, async (_req, res): Promise<void> => {
  const { sub: userId } = authedUser(res);

  const results = await creditProfitsForUser(userId);

  const totalCredited = results
    .reduce((sum, r) => sum + parseFloat(r.profitCredited), 0)
    .toFixed(2);

  res.json({
    credited: results,
    totalCredited,
    currency: "ETB",
    message:
      results.length === 0
        ? "No profits pending — less than 1 full day has elapsed since last credit."
        : `Credited ${results.length} investment(s).`,
  });
});

export default router;
