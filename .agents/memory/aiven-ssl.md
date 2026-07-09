---
name: Aiven SSL fix
description: How to make pg v8+ connect to Aiven without certificate chain errors
---

## The rule
pg v8 + pg-connection-string v3 treats `sslmode=require` as `verify-full`, rejecting Aiven's CA-signed cert chain.

**For the custom pool** (`lib/db/src/index.ts`): strip all ssl params from the URL using the URL API, then pass `ssl: { rejectUnauthorized: false }` to the Pool constructor.

**For drizzle-kit CLI** (`lib/db/drizzle.config.ts`): strip ssl params and add `uselibpqcompat=true&sslmode=require` back. The `uselibpqcompat` flag restores old libpq semantics: encrypted channel, no CA chain verification.

**Why:** drizzle-kit uses its own internal pg connection; it does not go through the custom pool, so the two code paths need separate fixes.

**How to apply:** Any time a new pg client or drizzle-kit config is added, apply the appropriate fix above. If the user ever supplies an Aiven CA cert path, switch to `ssl: { ca: fs.readFileSync(path), rejectUnauthorized: true }` for the pool and `sslmode=verify-full` for drizzle-kit.
