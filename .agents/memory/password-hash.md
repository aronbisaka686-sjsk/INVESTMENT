---
name: password_hash exposure
description: usersTable selectSchema includes passwordHash — always use the safe variant for API responses
---

## The rule
`createSelectSchema(usersTable)` produces `selectUserSchema` which includes `passwordHash`. This must **never** be serialised to a client.

**Safe variants defined in `lib/db/src/schema/users.ts`:**
- `selectPublicUserSchema` — Zod schema with `passwordHash` omitted (`.omit({ passwordHash: true })`)
- `PublicUser` — TypeScript type derived from the safe schema

**Why:** drizzle-zod's `createSelectSchema` mirrors the full table definition. There is no opt-out at the ORM level; the omit must be explicit in the schema file.

**How to apply:** Any route handler or API response that returns user data must use `selectPublicUserSchema` / `PublicUser`, not `selectUserSchema` / `User`. The full `User` type is only for internal server-side logic (e.g. password verification).
