import {
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { investmentPlansTable } from "./investment-plans";

/**
 * investment_status lifecycle:
 *   pending   → user chose a plan, payment reference recorded, awaiting confirmation
 *   active    → payment confirmed, daily profit crediting is running
 *   completed → investment term ended, no further crediting
 *   cancelled → rejected / refunded before activation
 */
export const investmentStatusEnum = pgEnum("investment_status", [
  "pending",
  "active",
  "completed",
  "cancelled",
]);

export const investmentsTable = pgTable("investments", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  /**
   * Which plan this investment belongs to.
   * Nullable so existing rows without a plan are preserved.
   */
  planId: uuid("plan_id").references(() => investmentPlansTable.id, {
    onDelete: "set null",
  }),
  /** Principal invested, in Ethiopian Birr */
  amountInvested: numeric("amount_invested", {
    precision: 20,
    scale: 2,
  }).notNull(),
  /**
   * Daily return rate as a decimal fraction (e.g. 0.050000 = 5 % / day).
   * Copied from the plan at creation time so changes to the plan don't
   * retroactively affect existing investments.
   */
  dailyProfitRate: numeric("daily_profit_rate", {
    precision: 10,
    scale: 6,
  }).notNull(),
  /**
   * External payment / transfer reference (e.g. CBE transaction ID).
   * Used to verify the deposit before activating the investment.
   */
  transactionReference: text("transaction_reference"),
  startDate: timestamp("start_date", { withTimezone: true }).notNull(),
  status: investmentStatusEnum("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  /**
   * Tracks when the last daily profit was credited.
   * NULL means no profit has been credited yet (use start_date as baseline).
   * Only relevant when status = 'active'.
   */
  lastCreditedAt: timestamp("last_credited_at", { withTimezone: true }),
});

// ── Zod schemas ──────────────────────────────────────────────────────────────

export const insertInvestmentSchema = createInsertSchema(investmentsTable, {
  userId: z.uuid(),
  planId: z.uuid().optional(),
  amountInvested: z.string(),
  dailyProfitRate: z.string(),
  transactionReference: z.string().optional(),
  startDate: z.iso.datetime(),
  status: z
    .enum(["pending", "active", "completed", "cancelled"])
    .optional(),
}).omit({ id: true, createdAt: true, updatedAt: true });

export const updateInvestmentSchema = z.object({
  status: z.enum(["pending", "active", "completed", "cancelled"]).optional(),
  dailyProfitRate: z.string().optional(),
  transactionReference: z.string().optional(),
  planId: z.uuid().optional(),
});

export const selectInvestmentSchema = createSelectSchema(investmentsTable);

// ── TypeScript types ─────────────────────────────────────────────────────────

export type InsertInvestment = z.infer<typeof insertInvestmentSchema>;
export type UpdateInvestment = z.infer<typeof updateInvestmentSchema>;
export type Investment = typeof investmentsTable.$inferSelect;
