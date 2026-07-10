import {
  boolean,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * investment_plans — the five fixed plans on offer.
 * Seeded once via migration; rows should not be deleted while active investments reference them.
 *
 * | name        | principal | daily_profit | daily_rate |
 * |-------------|-----------|--------------|------------|
 * | Starter     |   500 ETB |      25 ETB  |    5.0 %   |
 * | Basic       |  1000 ETB |      60 ETB  |    6.0 %   |
 * | Standard    |  3000 ETB |     210 ETB  |    7.0 %   |
 * | Premium     |  5000 ETB |     400 ETB  |    8.0 %   |
 * | Elite       | 10000 ETB |     900 ETB  |    9.0 %   |
 */
export const investmentPlansTable = pgTable("investment_plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** Human-readable label shown on the frontend (e.g. "Starter", "Elite") */
  name: text("name").notNull().unique(),
  /** Amount the user must deposit to activate this plan */
  principalEtb: numeric("principal_etb", {
    precision: 20,
    scale: 2,
  }).notNull(),
  /** Fixed ETB profit credited per day (derived from principalEtb × dailyProfitRate) */
  dailyProfitEtb: numeric("daily_profit_etb", {
    precision: 20,
    scale: 2,
  }).notNull(),
  /**
   * Daily rate as a decimal fraction — stored for audit / recomputation.
   * e.g. 0.050000 = 5 % per day
   */
  dailyProfitRate: numeric("daily_profit_rate", {
    precision: 10,
    scale: 6,
  }).notNull(),
  /** Set to false to hide a plan from new investors without deleting it */
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ── Zod schemas ──────────────────────────────────────────────────────────────

export const insertInvestmentPlanSchema = createInsertSchema(
  investmentPlansTable,
  {
    name: z.string().min(1),
    principalEtb: z.string(),
    dailyProfitEtb: z.string(),
    dailyProfitRate: z.string(),
    isActive: z.boolean().optional(),
  },
).omit({ id: true, createdAt: true });

export const selectInvestmentPlanSchema =
  createSelectSchema(investmentPlansTable);

// ── TypeScript types ─────────────────────────────────────────────────────────

export type InsertInvestmentPlan = z.infer<typeof insertInvestmentPlanSchema>;
export type InvestmentPlan = typeof investmentPlansTable.$inferSelect;
