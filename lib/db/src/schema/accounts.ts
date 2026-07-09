import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const accountsTable = pgTable("accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  fullName: text("full_name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertAccountSchema = createInsertSchema(accountsTable, {
  email: z.email(),
  fullName: z.string().min(1),
}).omit({ id: true, createdAt: true, updatedAt: true });

export const updateAccountSchema = insertAccountSchema.partial();

export const selectAccountSchema = createSelectSchema(accountsTable);

export type InsertAccount = z.infer<typeof insertAccountSchema>;
export type UpdateAccount = z.infer<typeof updateAccountSchema>;
export type Account = typeof accountsTable.$inferSelect;
