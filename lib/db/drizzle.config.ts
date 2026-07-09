import { defineConfig } from "drizzle-kit";
import path from "path";

// Prefer AIVEN_DATABASE_URL so Replit's own DATABASE_URL (reserved for its
// managed Postgres) is never accidentally used for Aiven connections.
const rawUrl =
  process.env["AIVEN_DATABASE_URL"] ?? process.env["DATABASE_URL"] ?? "";

if (!rawUrl) {
  throw new Error(
    "No database URL found. Set AIVEN_DATABASE_URL (Aiven PostgreSQL) or DATABASE_URL.",
  );
}

/**
 * drizzle-kit uses its own internal pg connection and does not go through
 * our custom pool, so we must fix the URL here directly.
 *
 * pg v8+ with pg-connection-string v3+ maps `sslmode=require` → `verify-full`,
 * which rejects Aiven's CA-signed chain.  The upstream-recommended fix is to
 * add `uselibpqcompat=true`, which restores the old libpq `sslmode=require`
 * semantics: encrypted channel, no CA verification.
 *
 * See: https://node-postgres.com/announcements (SSL breaking change note)
 */
function buildDrizzleUrl(raw: string): string {
  try {
    const u = new URL(raw);
    // Remove any existing SSL-related params to avoid conflicts
    u.searchParams.delete("sslmode");
    u.searchParams.delete("uselibpqcompat");
    u.searchParams.delete("sslcert");
    u.searchParams.delete("sslkey");
    u.searchParams.delete("sslrootcert");
    // Add the libpq-compat flag — encrypted but no CA chain verification
    u.searchParams.set("uselibpqcompat", "true");
    u.searchParams.set("sslmode", "require");
    return u.toString();
  } catch {
    // If the URL can't be parsed, return as-is and let pg report the error
    return raw;
  }
}

const url = buildDrizzleUrl(rawUrl);

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  /** SQL migration files written here by `drizzle-kit generate` */
  out: "./drizzle/migrations",
  dialect: "postgresql",
  dbCredentials: { url },
});
