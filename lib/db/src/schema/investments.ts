import {
  numeric,
  pgEnum,
  pgTable,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const investmentStatusEnum = pgEnum("investment_status", [
  "active",
  "completed",
  "cancelled",
]);

export const investmentsTable = pgTable("investments", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  /** Principal invested, in Ethiopian Birr */
  amountInvested: numeric("amount_invested", { precision: 20, scale: 2 }).notNull(),
  /**
   * Daily return rate as a decimal fraction (e.g. 0.005000 = 0.5 % / day).
   * Stored with 6 decimal places for precision.
   */
  dailyProfitRate: numeric("daily_profit_rate", {
    precision: 10,
    scale: 6,
  }).notNull(),
  startDate: timestamp("start_date", { withTimezone: true }).notNull(),
  status: investmentStatusEnum("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  /**
   * Tracks when the last daily profit was credited.
   * NULL means no profit has been credited yet (use start_date as baseline).
   */
  lastCreditedAt: timestamp("last_credited_at", {
    withTimezone: true,
  }),
});

// ── Zod schemas ──────────────────────────────────────────────────────────────

export const insertInvestmentSchema = createInsertSchema(investmentsTable, {
  userId: z.uuid(),
  amountInvested: z.string(),
  dailyProfitRate: z.string(),
  startDate: z.iso.datetime(),
  status: z.enum(["active", "completed", "cancelled"]).optional(),
}).omit({ id: true, createdAt: true, updatedAt: true });

export const updateInvestmentSchema = z.object({
  status: z.enum(["active", "completed", "cancelled"]).optional(),
  dailyProfitRate: z.string().optional(),
});

export const selectInvestmentSchema = createSelectSchema(investmentsTable);

// ── TypeScript types ─────────────────────────────────────────────────────────

export type InsertInvestment = z.infer<typeof insertInvestmentSchema>;
export type UpdateInvestment = z.infer<typeof updateInvestmentSchema>;
export type Investment = typeof investmentsTable.$inferSelect;
