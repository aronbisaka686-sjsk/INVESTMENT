import type { ErrorRequestHandler } from "express";
import { logger } from "../lib/logger";
import { mapDbError } from "../lib/dbErrors";

/**
 * Global Express error handler. Must be registered AFTER all routes.
 * Express 5 automatically forwards async errors to this handler.
 *
 * Security: raw database/driver error messages are never forwarded to
 * clients. Only safe, pre-approved messages are returned for 500s.
 */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  // Prefer an explicit status code attached to the error object.
  const explicitStatus =
    typeof (err as { status?: unknown }).status === "number"
      ? (err as { status: number }).status
      : typeof (err as { statusCode?: unknown }).statusCode === "number"
        ? (err as { statusCode: number }).statusCode
        : null;

  // Attempt to map DB-level errors (FK violations, unique conflicts, etc.)
  // to deterministic HTTP statuses before falling back to 500.
  const dbMapped = explicitStatus == null ? mapDbError(err) : null;

  const status = explicitStatus ?? dbMapped?.status ?? 500;

  // For client errors (4xx), a short descriptive message is safe.
  // For server errors (5xx), log the full error but return only a generic
  // message — never expose internal details to callers.
  let message: string;
  if (status < 500) {
    message =
      dbMapped?.message ??
      (err instanceof Error ? err.message : "Bad request");
  } else {
    logger.error({ err }, "Unhandled server error");
    message = "Internal server error";
  }

  if (status >= 400 && status < 500) {
    logger.warn({ err }, "Request error");
  }

  res.status(status).json({ error: message });
};
