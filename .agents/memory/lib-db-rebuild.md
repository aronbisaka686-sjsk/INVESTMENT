---
name: lib/db dist rebuild
description: Must rebuild lib/db after adding new schema files for api-server typecheck to resolve new exports
---

## The rule
After adding new schema files to `lib/db/src/schema/`, run `cd lib/db && pnpm exec tsc -p tsconfig.json` to regenerate `lib/db/dist/schema/*.d.ts`.

**Why:** `artifacts/api-server` resolves `@workspace/db` via TypeScript project references, which read from `lib/db/dist/` (compiled declarations), not the source. Until the dist is regenerated, the api-server typecheck cannot see new exports and emits "Module has no exported member" errors.

**How to apply:** Any time new tables/schemas are added to `lib/db/src/schema/` and exported from `lib/db/src/schema/index.ts`, rebuild lib/db before typechecking api-server. The `drizzle-kit generate` + `migrate` flow does NOT trigger a TypeScript build — it must be done separately.
