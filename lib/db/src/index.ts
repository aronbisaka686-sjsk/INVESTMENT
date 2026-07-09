import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

// Support both AIVEN_DATABASE_URL (explicit Aiven override) and DATABASE_URL.
const rawConnectionString =
  process.env["AIVEN_DATABASE_URL"] ?? process.env["DATABASE_URL"];

if (!rawConnectionString) {
  throw new Error(
    "No database connection string found. " +
      "Set AIVEN_DATABASE_URL (for Aiven PostgreSQL) or DATABASE_URL.",
  );
}

// ── SSL configuration ──────────────────────────────────────────────────────
//
// pg v8+ with pg-connection-string v3+ maps `sslmode=require` to `verify-full`,
// which rejects Aiven's CA-signed chain. Fix: strip sslmode from the URL and
// pass an explicit `ssl` object so pg's built-in logic takes full control.
//
// For stricter production setups, set DATABASE_SSL_CA to the path of your
// Aiven CA certificate and switch to rejectUnauthorized: true.
//
const disableSsl =
  rawConnectionString.includes("sslmode=disable") ||
  process.env["DATABASE_SSL"] === "false";

// Strip SSL-related query params using the URL API so the explicit `ssl`
// pool option below is the sole SSL authority.
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
    // If the URL can't be parsed (e.g. postgres:// with special chars),
    // fall back to the raw string — SSL will rely on the pool option.
    return raw;
  }
}

const connectionString = stripSslParams(rawConnectionString);

const sslOption: pg.PoolConfig["ssl"] = disableSsl
  ? undefined
  : { rejectUnauthorized: false };

export const pool = new Pool({
  connectionString,
  ssl: sslOption,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 8_000,
});

// Surface pool-level errors in logs rather than crashing the process silently.
pool.on("error", (err) => {
  process.stderr.write(`[db] Unexpected pool error: ${err.message}\n`);
});

// Verify connectivity at startup — exits fast with a clear error if the
// connection string is wrong or Aiven is unreachable.
export async function connectDb(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("SELECT 1");
  } finally {
    client.release();
  }
}

export const db = drizzle(pool, { schema });

export * from "./schema";
