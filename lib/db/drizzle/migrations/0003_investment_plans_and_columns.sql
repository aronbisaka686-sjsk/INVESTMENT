-- Step 2: everything that depends on 'pending' being a committed enum value.

CREATE TABLE "investment_plans" (
  "id"               uuid          PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name"             text          NOT NULL,
  "principal_etb"    numeric(20,2) NOT NULL,
  "daily_profit_etb" numeric(20,2) NOT NULL,
  "daily_profit_rate" numeric(10,6) NOT NULL,
  "is_active"        boolean       NOT NULL DEFAULT true,
  "created_at"       timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "investment_plans_name_unique" UNIQUE("name")
);
--> statement-breakpoint

-- New columns on existing tables
ALTER TABLE "users"       ADD COLUMN "total_daily_earnings_etb" numeric(20,2) NOT NULL DEFAULT '0.00';
--> statement-breakpoint
ALTER TABLE "investments" ADD COLUMN "plan_id"                uuid;
--> statement-breakpoint
ALTER TABLE "investments" ADD COLUMN "transaction_reference"  text;
--> statement-breakpoint
ALTER TABLE "investments" ADD CONSTRAINT "investments_plan_id_investment_plans_id_fk"
  FOREIGN KEY ("plan_id") REFERENCES "public"."investment_plans"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint

-- Now safe: 'pending' was committed in the previous migration
ALTER TABLE "investments" ALTER COLUMN "status" SET DEFAULT 'pending';
--> statement-breakpoint

-- Seed the five fixed investment plans
INSERT INTO "investment_plans" ("name", "principal_etb", "daily_profit_etb", "daily_profit_rate") VALUES
  ('Starter',  '500.00',   '25.00',  '0.050000'),
  ('Basic',    '1000.00',  '60.00',  '0.060000'),
  ('Standard', '3000.00',  '210.00', '0.070000'),
  ('Premium',  '5000.00',  '400.00', '0.080000'),
  ('Elite',    '10000.00', '900.00', '0.090000');
