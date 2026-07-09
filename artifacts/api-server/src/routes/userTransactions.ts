/**
 * User-transaction routes — list an investor's cash flow history.
 *
 * All routes require a valid JWT (Authorization: Bearer <token>).
 *
 * GET /api/user-transactions             — list all transactions for current user
 * GET /api/user-transactions?type=profit — filter by type (deposit/withdrawal/profit)
 */
import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { z } from "zod/v4";
import {
  db,
  userTransactionsTable,
  selectUserTransactionSchema,
} from "@workspace/db";
import { requireAuth, authedUser } from "../middlewares/requireAuth";

const router: IRouter = Router();

const QueryParams = z.object({
  type: z.enum(["deposit", "withdrawal", "profit"]).optional(),
});

// ── GET /user-transactions ────────────────────────────────────────────────────

router.get("/user-transactions", requireAuth, async (req, res): Promise<void> => {
  const { sub: userId } = authedUser(res);

  const query = QueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: "Invalid query parameter: type must be deposit, withdrawal, or profit" });
    return;
  }

  const conditions = [eq(userTransactionsTable.userId, userId)];
  if (query.data.type) {
    conditions.push(eq(userTransactionsTable.type, query.data.type));
  }

  const rows = await db
    .select()
    .from(userTransactionsTable)
    .where(and(...conditions))
    .orderBy(desc(userTransactionsTable.timestamp));

  res.json(rows.map((r) => selectUserTransactionSchema.parse(r)));
});

export default router;
