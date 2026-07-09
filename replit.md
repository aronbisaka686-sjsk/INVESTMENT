# Investment Platform API

A RESTful backend API for an investment platform. Manages investor accounts, portfolios, asset holdings, and transaction history. Frontend is hosted separately on GitHub Pages.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port from `$PORT`)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes to Aiven PostgreSQL (dev only)

## Required Environment Variables

Set these as Replit Secrets:

| Variable | Description |
|---|---|
| `AIVEN_DATABASE_URL` | Aiven PostgreSQL connection string (takes priority over `DATABASE_URL`). Format: `postgresql://user:pass@host:port/db?sslmode=require` |

See `.env.example` for the full list and format.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: Aiven PostgreSQL + Drizzle ORM (SSL enabled by default)
- Validation: Zod (Orval-generated schemas from OpenAPI spec)
- API codegen: Orval (from `lib/api-spec/openapi.yaml`)
- Build: esbuild (CJS bundle)

## Where Things Live

- `lib/api-spec/openapi.yaml` — OpenAPI contract (source of truth for all routes)
- `lib/api-zod/src/generated/api.ts` — Generated Zod validation schemas
- `lib/api-client-react/src/generated/` — Generated React Query hooks (for a future frontend)
- `lib/db/src/schema/` — Drizzle ORM table definitions
  - `accounts.ts` — investor accounts
  - `portfolios.ts` — investment portfolios
  - `holdings.ts` — asset positions within a portfolio
  - `transactions.ts` — buy/sell/dividend transaction history
- `artifacts/api-server/src/routes/` — Express route handlers
- `artifacts/api-server/src/middlewares/errorHandler.ts` — global error handler

## API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/healthz` | Health check |
| GET/POST | `/api/accounts` | List / create accounts |
| GET/PATCH/DELETE | `/api/accounts/:id` | Read / update / delete account |
| GET/POST | `/api/portfolios` | List (filter by `?accountId=`) / create |
| GET/PATCH/DELETE | `/api/portfolios/:id` | Read / update / delete portfolio |
| GET/POST | `/api/holdings` | List (filter by `?portfolioId=`) / add holding |
| GET/PATCH/DELETE | `/api/holdings/:id` | Read / update / delete holding |
| GET/POST | `/api/transactions` | List (filter by `?portfolioId=&ticker=`) / record |
| GET | `/api/transactions/:id` | Read transaction |

## Architecture Decisions

- **OpenAPI-first**: `lib/api-spec/openapi.yaml` is the source of truth. Edit the spec, run codegen, then implement the route. Never drift routes from the contract.
- **Aiven SSL**: DB pool has `ssl: { rejectUnauthorized: false }` enabled by default for Aiven compatibility. Set `DATABASE_SSL=false` only for local non-SSL dev.
- **Startup DB check**: Server calls `connectDb()` and exits if the DB is unreachable, providing a clear error rather than a silent query failure.
- **CORS**: Configured to allow `*.github.io` origins and localhost. Add custom domains in `artifacts/api-server/src/app.ts` `allowedOrigins`.
- **Numeric fields as strings**: `quantity`, `pricePerUnit`, `totalAmount`, and `avgCostBasis` are stored as PostgreSQL `numeric` and returned as strings to avoid floating-point precision loss.

## Gotchas

- Run codegen after any OpenAPI spec change: `pnpm --filter @workspace/api-spec run codegen`
- `DATABASE_URL` is managed by Replit's built-in database. Use `AIVEN_DATABASE_URL` for your Aiven database.
- Run `pnpm --filter @workspace/db run push` to apply schema changes to the database before testing routes.

## User Preferences

_Populate as you build — explicit user instructions worth remembering across sessions._
