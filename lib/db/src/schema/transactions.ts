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
import { portfoliosTable } from "./portfolios";

export const transactionTypeEnum = pgEnum("transaction_type", [
  "buy",
  "sell",
  "dividend",
  "deposit",
  "withdrawal",
]);

export const transactionsTable = pgTable("transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  portfolioId: uuid("portfolio_id")
    .notNull()
    .references(() => portfoliosTable.id, { onDelete: "cascade" }),
  ticker: text("ticker").notNull(),
  transactionType: transactionTypeEnum("transaction_type").notNull(),
  quantity: numeric("quantity", { precision: 20, scale: 8 }),
  pricePerUnit: numeric("price_per_unit", { precision: 20, scale: 8 }).notNull(),
  totalAmount: numeric("total_amount", { precision: 20, scale: 8 }).notNull(),
  notes: text("notes"),
  transactedAt: timestamp("transacted_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertTransactionSchema = createInsertSchema(transactionsTable, {
  portfolioId: z.uuid(),
  ticker: z.string().min(1).toUpperCase(),
  quantity: z.string().nullable().optional(),
  pricePerUnit: z.string(),
  totalAmount: z.string(),
  notes: z.string().nullable().optional(),
  transactedAt: z.iso.datetime(),
}).omit({ id: true, createdAt: true });

export const selectTransactionSchema = createSelectSchema(transactionsTable);

export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactionsTable.$inferSelect;
