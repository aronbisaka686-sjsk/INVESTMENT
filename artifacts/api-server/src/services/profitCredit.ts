/**
 * profitCredit service — calculates and applies daily profit to investments.
 *
 * For each active investment:
 *   1. Calculate elapsed whole days since last_credited_at (or start_date).
 *   2. Compute profit = amount_invested × daily_profit_rate × elapsed_days.
 *   3. In a single DB transaction with optimistic concurrency control:
 *        a. Conditionally update last_credited_at — only if it still matches
 *           the value we read. If another concurrent request already credited,
 *           this update hits 0 rows and the operation is safely skipped.
 *        b. Add profit to the user's balance_etb.
 *        c. Record a user_transaction of type "profit".
 *
 * Fractional-day carryover:
 *   last_credited_at is advanced by exactly (daysElapsed × 24 h) from the
 *   credit base, not set to `now`.  This preserves the fractional remainder
 *   so it is included in the next credit run instead of being silently lost.
 *
 *   Example: 1.8 days elapsed → credit 1 day, advance base by 24 h.
 *   Next run the 0.8-day remainder is included in the elapsed calculation.
 */
import { eq, and, isNull, sql } from "drizzle-orm";
import {
  db,
  investmentsTable,
  usersTable,
  userTransactionsTable,
  type Investment,
} from "@workspace/db";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ProfitPreview {
  investmentId: string;
  userId: string;
  amountInvested: string;
  dailyProfitRate: string;
  daysElapsed: number;
  pendingProfit: string;
  /** ISO string of the last credit date (or start_date when never credited) */
  creditBase: string;
}

export interface CreditResult {
  investmentId: string;
  userId: string;
  profitCredited: string;
  transactionId: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const MS_PER_DAY = 1_000 * 60 * 60 * 24;

/**
 * Given an investment, compute how many whole days of profit are pending
 * and what the total profit amount is.
 */
export function computePendingProfit(investment: Investment): {
  daysElapsed: number;
  profit: number;
  creditBase: Date;
} {
  const creditBase = investment.lastCreditedAt ?? investment.startDate;
  const now = new Date();
  const msElapsed = now.getTime() - creditBase.getTime();
  const daysElapsed = Math.max(0, Math.floor(msElapsed / MS_PER_DAY));

  const amountInvested = parseFloat(investment.amountInvested);
  const dailyProfitRate = parseFloat(investment.dailyProfitRate);
  const profit = amountInvested * dailyProfitRate * daysElapsed;

  return { daysElapsed, profit, creditBase };
}

/** Format a number to 2 decimal places as a string (for numeric DB columns). */
function toNumericStr(n: number): string {
  return n.toFixed(2);
}

// ── Core operations ───────────────────────────────────────────────────────────

/**
 * Preview pending profits for a list of investments — read-only, no DB writes.
 */
export function previewProfits(investments: Investment[]): ProfitPreview[] {
  return investments
    .filter((inv) => inv.status === "active")
    .map((inv) => {
      const { daysElapsed, profit, creditBase } = computePendingProfit(inv);
      return {
        investmentId: inv.id,
        userId: inv.userId,
        amountInvested: inv.amountInvested,
        dailyProfitRate: inv.dailyProfitRate,
        daysElapsed,
        pendingProfit: toNumericStr(profit),
        creditBase: creditBase.toISOString(),
      };
    });
}

/**
 * Credit pending profits for a single active investment.
 *
 * Uses optimistic concurrency control: the `last_credited_at` update is
 * conditional on the column still matching the value we read before entering
 * the transaction.  If two requests race, only one succeeds — the other
 * finds 0 updated rows and returns null safely.
 *
 * Returns null when:
 *   - The investment is not active
 *   - Fewer than 1 full day has elapsed
 *   - A concurrent request already credited this investment
 */
export async function creditOneInvestment(
  investment: Investment,
): Promise<CreditResult | null> {
  if (investment.status !== "active") return null;

  const { daysElapsed, profit, creditBase } = computePendingProfit(investment);
  if (daysElapsed === 0 || profit <= 0) return null;

  const profitStr = toNumericStr(profit);
  const now = new Date();

  // Advance the credit base by exactly the credited days — preserves the
  // fractional remainder for the next run instead of discarding it.
  const newLastCreditedAt = new Date(
    creditBase.getTime() + daysElapsed * MS_PER_DAY,
  );

  return await db.transaction(async (tx) => {
    // ── Step 1: Conditional update (optimistic lock) ──────────────────────
    // Match last_credited_at to the exact value we computed from.
    // If another concurrent call already advanced it, this hits 0 rows
    // and we bail out cleanly without double-crediting.
    const condition = and(
      eq(investmentsTable.id, investment.id),
      investment.lastCreditedAt != null
        ? eq(investmentsTable.lastCreditedAt, investment.lastCreditedAt)
        : isNull(investmentsTable.lastCreditedAt),
    );

    const [locked] = await tx
      .update(investmentsTable)
      .set({ lastCreditedAt: newLastCreditedAt, updatedAt: now })
      .where(condition)
      .returning({ id: investmentsTable.id });

    // Another concurrent credit already ran — skip without error
    if (!locked) return null;

    // ── Step 2: Credit balance ────────────────────────────────────────────
    await tx
      .update(usersTable)
      .set({
        balanceEtb: sql`${usersTable.balanceEtb} + ${profitStr}::numeric`,
      })
      .where(eq(usersTable.id, investment.userId));

    // ── Step 3: Record the transaction ───────────────────────────────────
    const [txRecord] = await tx
      .insert(userTransactionsTable)
      .values({
        userId: investment.userId,
        amount: profitStr,
        type: "profit",
        status: "completed",
        timestamp: now,
      })
      .returning();

    return {
      investmentId: investment.id,
      userId: investment.userId,
      profitCredited: profitStr,
      transactionId: txRecord!.id,
    };
  });
}

/**
 * Credit all pending profits for active investments belonging to a specific user.
 * Returns an array of results for investments that had ≥ 1 day pending.
 * Concurrent duplicate calls are safe — the optimistic lock in creditOneInvestment
 * ensures each investment is credited at most once per day window.
 */
export async function creditProfitsForUser(userId: string): Promise<CreditResult[]> {
  const investments = await db
    .select()
    .from(investmentsTable)
    .where(
      and(
        eq(investmentsTable.userId, userId),
        eq(investmentsTable.status, "active"),
      ),
    );

  const results: CreditResult[] = [];
  for (const inv of investments) {
    const result = await creditOneInvestment(inv);
    if (result) results.push(result);
  }
  return results;
}
