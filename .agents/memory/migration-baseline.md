---
name: Migration baseline strategy
description: How drizzle-kit migrations are set up after initial push bootstrap
---

## The rule
All tables were first created via `drizzle-kit push` (no SQL files). When the migration workflow was introduced later, the generated `0000_kind_ultron.sql` would have tried to recreate all tables — causing "already exists" errors.

**Fix applied:** `0000_kind_ultron.sql` was replaced with a no-op (`SELECT 1`) with a comment explaining the baseline. Running `migrate` once recorded it in `__drizzle_migrations` without touching the DB.

**Going forward:**
- Schema changes → `pnpm --filter @workspace/db run generate` → creates `0001_…sql`, `0002_…sql`, etc.
- Apply → `pnpm --filter @workspace/db run migrate`
- Quick dev → `pnpm --filter @workspace/db run push` (skips SQL files, pushes diff directly)

**Why:** `drizzle-orm/node-postgres/migrator` tracks applied migrations by hash in `__drizzle_migrations`. The no-op baseline anchors the history without risk of "already exists" failures.

**How to apply:** If the schema is ever bootstrapped on a fresh DB (e.g. production), run `migrate` — the no-op `0000` records the baseline, then subsequent files are applied in order.
