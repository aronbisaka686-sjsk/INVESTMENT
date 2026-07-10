import { numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  /** bcrypt hash — never returned to clients */
  passwordHash: text("password_hash").notNull(),
  /** Account balance in Ethiopian Birr, stored as exact numeric */
  balanceEtb: numeric("balance_etb", { precision: 20, scale: 2 })
    .notNull()
    .default("0.00"),
  /**
   * Sum of daily_profit_etb across all active investments.
   * Updated whenever an investment is created, completed, or cancelled.
   * Lets the frontend show "you earn X ETB/day" without an aggregation query.
   */
  totalDailyEarningsEtb: numeric("total_daily_earnings_etb", {
    precision: 20,
    scale: 2,
  })
    .notNull()
    .default("0.00"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ── Zod schemas ──────────────────────────────────────────────────────────────

export const insertUserSchema = createInsertSchema(usersTable, {
  name: z.string().min(1),
  email: z.email(),
  passwordHash: z.string().min(1),
  balanceEtb: z.string().optional(),
  totalDailyEarningsEtb: z.string().optional(),
}).omit({ id: true, createdAt: true });

export const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.email().optional(),
  balanceEtb: z.string().optional(),
  totalDailyEarningsEtb: z.string().optional(),
});

/** Full DB row — includes passwordHash. For internal/server use only. */
export const selectUserSchema = createSelectSchema(usersTable);

/**
 * Safe public representation — passwordHash is stripped.
 * Use this for any API response or client-facing type.
 */
export const selectPublicUserSchema = selectUserSchema.omit({
  passwordHash: true,
});

// ── TypeScript types ─────────────────────────────────────────────────────────

export type InsertUser = z.infer<typeof insertUserSchema>;
export type UpdateUser = z.infer<typeof updateUserSchema>;
/** Full DB row (contains passwordHash) — never serialise this to a client. */
export type User = typeof usersTable.$inferSelect;
/** Safe subset for API responses — passwordHash omitted. */
export type PublicUser = z.infer<typeof selectPublicUserSchema>;
