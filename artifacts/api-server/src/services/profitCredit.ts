/**
 * profitCredit service — calculates and applies daily profit to investments.
 *
 * For each active investment:
 *   1. Calculate elapsed whole days since last_credited_at (or start_date).
 *   2. Compute profit = amount_invested × daily_profit_rate × elapsed_days.
 *   3. In a single DB transaction:
 *        a. Add profit to the user's balance_etb.
 *        b. Record a user_transaction of type "profit".
 *        c. Update investment.last_credited_at to now.
 *
 * All monetary arithmetic is done with JavaScript numbers then converted back
 * to 2-decimal-place strings.  For a future high-precision requirement, swap
 * to a decimal library (e.g. "decimal.js").
 */
import { eq, and, sql } from "drizzle-orm";
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
 * Skips (returns null) when 0 whole days have elapsed.
 *
 * Runs inside a DB transaction to ensure the balance update,
 * transaction record, and last_credited_at update are atomic.
 */
export async function creditOneInvestment(
  investment: Investment,
): Promise<CreditResult | null> {
  if (investment.status !== "active") return null;

  const { daysElapsed, profit } = computePendingProfit(investment);
  if (daysElapsed === 0 || profit <= 0) return null;

  const profitStr = toNumericStr(profit);
  const now = new Date();

  return await db.transaction(async (tx) => {
    // 1. Credit the user's balance atomically at the DB level
    await tx
      .update(usersTable)
      .set({
        balanceEtb: sql`${usersTable.balanceEtb} + ${profitStr}::numeric`,
      })
      .where(eq(usersTable.id, investment.userId));

    // 2. Record the profit transaction
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

    // 3. Mark credit time so the next run doesn't re-credit the same days
    await tx
      .update(investmentsTable)
      .set({ lastCreditedAt: now, updatedAt: now })
      .where(eq(investmentsTable.id, investment.id));

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
