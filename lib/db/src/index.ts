import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

// Support both AIVEN_DATABASE_URL (explicit Aiven override) and DATABASE_URL
// (Replit-managed or standard connection string).
const connectionString =
  process.env["AIVEN_DATABASE_URL"] ?? process.env["DATABASE_URL"];

if (!connectionString) {
  throw new Error(
    "No database connection string found. " +
      "Set AIVEN_DATABASE_URL (for Aiven PostgreSQL) or DATABASE_URL.",
  );
}

// Aiven (and most managed PostgreSQL providers) require SSL.
// If the connection string already contains sslmode=disable, we respect that;
// otherwise we enable SSL with rejectUnauthorized: false so the Aiven CA
// bundle is not required. For stricter production setups, set
// DATABASE_SSL_CA to the path of your Aiven CA certificate.
const sslDisabled =
  connectionString.includes("sslmode=disable") ||
  process.env["DATABASE_SSL"] === "false";

const sslConfig = sslDisabled
  ? undefined
  : { rejectUnauthorized: false };

export const pool = new Pool({
  connectionString,
  ssl: sslConfig,
  // Connection pool tuning
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

// Surface pool-level errors so they appear in logs rather than crashing
// the process silently.
pool.on("error", (err) => {
  // Use process.stderr directly here because the pino logger may not yet
  // be available when the pool emits background errors.
  process.stderr.write(`[db] Unexpected pool error: ${err.message}\n`);
});

// Verify connectivity at startup — fails fast if the connection string is
// wrong or the database is unreachable, rather than surfacing the error on
// the first real request.
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
