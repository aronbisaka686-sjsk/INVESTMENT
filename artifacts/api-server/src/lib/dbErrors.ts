/**
 * Maps PostgreSQL driver error codes to safe, client-facing HTTP responses.
 *
 * NEVER forward raw Postgres error messages to clients — they can expose
 * table names, column names, constraint names, and SQL fragments.
 */

interface PgError {
  code?: string;
  constraint?: string;
  detail?: string;
}

export interface MappedDbError {
  status: number;
  message: string;
}

/** Postgres error codes that have deterministic HTTP mappings. */
const PG_CODES: Record<string, MappedDbError> = {
  "23505": { status: 409, message: "A record with this value already exists" },
  "23503": { status: 400, message: "Referenced record does not exist" },
  "23502": { status: 400, message: "A required field is missing" },
  "23514": { status: 400, message: "A value violates a check constraint" },
  "22001": { status: 400, message: "A value is too long for its field" },
  "22003": { status: 400, message: "A numeric value is out of range" },
  "22P02": { status: 400, message: "Invalid input syntax (bad UUID or number)" },
  "42P01": { status: 500, message: "Internal server error" }, // undefined table — a bug
};

/**
 * Returns a mapped error if the error is a known Postgres error code,
 * otherwise returns null (caller should treat it as a 500).
 */
export function mapDbError(err: unknown): MappedDbError | null {
  if (err == null || typeof err !== "object") return null;

  const pg = err as PgError;
  if (typeof pg.code !== "string") return null;

  return PG_CODES[pg.code] ?? null;
}
