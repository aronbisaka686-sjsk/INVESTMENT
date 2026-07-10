-- Step 1: add 'pending' to the enum.
-- Must be committed BEFORE any statement that uses 'pending' as a default value,
-- because Postgres cannot see a newly-added enum value until after the transaction commits.
ALTER TYPE "public"."investment_status" ADD VALUE 'pending' BEFORE 'active';
