/**
 * user_transactions — platform-level financial movements for an investor.
 *
 * Distinct from the existing `transactions` table, which records portfolio
 * trade executions (buy / sell / dividend linked to a portfolio_id).
 * This table records cash flows tied directly to a user account:
 * deposits, withdrawals, and profit credits.
 */
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

export const userTransactionTypeEnum = pgEnum("user_transaction_type", [
  "deposit",
  "withdrawal",
  "profit",
]);

export const userTransactionStatusEnum = pgEnum("user_transaction_status", [
  "pending",
  "completed",
  "failed",
]);

export const userTransactionsTable = pgTable("user_transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  /** Amount in Ethiopian Birr */
  amount: numeric("amount", { precision: 20, scale: 2 }).notNull(),
  type: userTransactionTypeEnum("type").notNull(),
  status: userTransactionStatusEnum("status").notNull().default("pending"),
  /** When the transaction occurred (defaults to now, can be back-dated for profit credits) */
  timestamp: timestamp("timestamp", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ── Zod schemas ──────────────────────────────────────────────────────────────

export const insertUserTransactionSchema = createInsertSchema(
  userTransactionsTable,
  {
    userId: z.uuid(),
    amount: z.string(),
    type: z.enum(["deposit", "withdrawal", "profit"]),
    status: z.enum(["pending", "completed", "failed"]).optional(),
    timestamp: z.iso.datetime().optional(),
  },
).omit({ id: true });

export const selectUserTransactionSchema =
  createSelectSchema(userTransactionsTable);

// ── TypeScript types ─────────────────────────────────────────────────────────

export type InsertUserTransaction = z.infer<typeof insertUserTransactionSchema>;
export type UserTransaction = typeof userTransactionsTable.$inferSelect;
