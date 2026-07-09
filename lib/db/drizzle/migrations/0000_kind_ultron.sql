-- ============================================================
-- Baseline marker — no-op migration
-- ============================================================
-- All tables and enums in this migration were applied to the
-- Aiven database via `drizzle-kit push` before the migration
-- workflow was introduced.  This file exists only to anchor
-- the migration history so that subsequent `drizzle-kit generate`
-- + `migrate` runs apply changes incrementally.
--
-- Tables covered by this baseline (already exist in Aiven):
--   accounts, portfolios, holdings, transactions   (portfolio schema)
--   users, investments, user_transactions           (investment platform)
--
-- Enums covered:
--   asset_type, transaction_type                   (portfolio schema)
--   investment_status, user_transaction_type,
--   user_transaction_status                        (investment platform)
-- ============================================================

SELECT 1; -- no-op so Postgres accepts this as a valid statement
