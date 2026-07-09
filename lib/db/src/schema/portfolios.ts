import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { accountsTable } from "./accounts";

export const portfoliosTable = pgTable("portfolios", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id")
    .notNull()
    .references(() => accountsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertPortfolioSchema = createInsertSchema(portfoliosTable, {
  accountId: z.uuid(),
  name: z.string().min(1),
  description: z.string().nullable().optional(),
}).omit({ id: true, createdAt: true, updatedAt: true });

export const updatePortfolioSchema = insertPortfolioSchema
  .omit({ accountId: true })
  .partial();

export const selectPortfolioSchema = createSelectSchema(portfoliosTable);

export type InsertPortfolio = z.infer<typeof insertPortfolioSchema>;
export type UpdatePortfolio = z.infer<typeof updatePortfolioSchema>;
export type Portfolio = typeof portfoliosTable.$inferSelect;
