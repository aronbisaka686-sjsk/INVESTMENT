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

export const assetTypeEnum = pgEnum("asset_type", [
  "stock",
  "etf",
  "crypto",
  "bond",
  "commodity",
  "other",
]);

export const holdingsTable = pgTable("holdings", {
  id: uuid("id").primaryKey().defaultRandom(),
  portfolioId: uuid("portfolio_id")
    .notNull()
    .references(() => portfoliosTable.id, { onDelete: "cascade" }),
  ticker: text("ticker").notNull(),
  assetType: assetTypeEnum("asset_type").notNull().default("stock"),
  quantity: numeric("quantity", { precision: 20, scale: 8 }).notNull(),
  avgCostBasis: numeric("avg_cost_basis", { precision: 20, scale: 8 }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertHoldingSchema = createInsertSchema(holdingsTable, {
  portfolioId: z.uuid(),
  ticker: z.string().min(1).toUpperCase(),
  quantity: z.string(),
  avgCostBasis: z.string().nullable().optional(),
}).omit({ id: true, createdAt: true, updatedAt: true });

export const updateHoldingSchema = z.object({
  quantity: z.string().optional(),
  avgCostBasis: z.string().nullable().optional(),
});

export const selectHoldingSchema = createSelectSchema(holdingsTable);

export type InsertHolding = z.infer<typeof insertHoldingSchema>;
export type UpdateHolding = z.infer<typeof updateHoldingSchema>;
export type Holding = typeof holdingsTable.$inferSelect;
