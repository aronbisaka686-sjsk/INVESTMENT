---
name: Auth middleware pattern
description: How JWT auth middleware is implemented to avoid tsconfig "types" conflict
---

## The rule
JWT payload is stored in `res.locals[USER_KEY]` (not on `req.user`) and retrieved via `authedUser(res)` helper.

**Why:** The api-server tsconfig sets `"types": ["node"]`, which restricts global type augmentation. Augmenting `Express.Request` via a `.d.ts` file conflicts with this restriction and causes TypeScript errors. `res.locals` is already typed as `Record<string, any>` and requires no global augmentation.

**How to apply:**
- Protected routes: add `requireAuth` as middleware, then call `const { sub: userId } = authedUser(res);` inside the handler.
- `requireAuth` is in `artifacts/api-server/src/middlewares/requireAuth.ts`.
- `authedUser` throws if called outside an authenticated route (dev-time guard).
- JWT payload shape: `{ sub: string (userId), email: string, name: string }`.
