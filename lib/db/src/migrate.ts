/**
 * migrate.ts — standalone migration runner
 *
 * Applies every pending SQL migration from lib/db/drizzle/migrations/ to the
 * target database.  Run after `drizzle-kit generate` has produced new SQL
 * files.
 *
 * Usage:
 *   pnpm --filter @workspace/db run generate   # create SQL migration files
 *   pnpm --filter @workspace/db run migrate    # apply them to Aiven
 *
 * The script re-uses the same SSL-safe pool from lib/db/src/index.ts so
 * Aiven's certificate chain is handled correctly.
 */
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
import path from "path";
import { fileURLToPath } from "url";

const { Pool } = pg;

// ── Resolve paths ─────────────────────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Migrations live at lib/db/drizzle/migrations/ relative to this file
// (src/migrate.ts → ../drizzle/migrations)
const migrationsFolder = path.join(__dirname, "../drizzle/migrations");

// ── Database connection (mirrors lib/db/src/index.ts SSL logic) ───────────────
const rawConnectionString =
  process.env["AIVEN_DATABASE_URL"] ?? process.env["DATABASE_URL"];

if (!rawConnectionString) {
  console.error(
    "❌  No database connection string found.\n" +
      "    Set AIVEN_DATABASE_URL (for Aiven PostgreSQL) or DATABASE_URL.",
  );
  process.exit(1);
}

const disableSsl =
  rawConnectionString.includes("sslmode=disable") ||
  process.env["DATABASE_SSL"] === "false";

/** Strip sslmode and related params so the explicit `ssl` option controls TLS. */
function stripSslParams(raw: string): string {
  try {
    const u = new URL(raw);
    u.searchParams.delete("sslmode");
    u.searchParams.delete("sslcert");
    u.searchParams.delete("sslkey");
    u.searchParams.delete("sslrootcert");
    u.searchParams.delete("uselibpqcompat");
    return u.toString();
  } catch {
    return raw;
  }
}

const connectionString = stripSslParams(rawConnectionString);

const pool = new Pool({
  connectionString,
  ssl: disableSsl ? undefined : { rejectUnauthorized: false },
  max: 1, // single connection is enough for migrations
  connectionTimeoutMillis: 10_000,
});

// ── Run migrations ────────────────────────────────────────────────────────────
async function main() {
  console.log("🔄  Connecting to database…");
  const client = await pool.connect();
  client.release();
  console.log("✅  Connected.");

  const db = drizzle(pool);

  console.log(`📂  Migrations folder: ${migrationsFolder}`);
  console.log("🔄  Applying pending migrations…");

  await migrate(db, { migrationsFolder });

  console.log("✅  All migrations applied.");
  await pool.end();
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`❌  Migration failed: ${message}`);
  process.exit(1);
});
