import type { ErrorRequestHandler } from "express";
import { logger } from "../lib/logger";

/**
 * Global Express error handler. Must be registered AFTER all routes.
 * Express 5 automatically forwards async errors to this handler.
 */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const status: number =
    typeof (err as { status?: unknown }).status === "number"
      ? (err as { status: number }).status
      : 500;

  const message: string =
    err instanceof Error ? err.message : "Internal server error";

  if (status >= 500) {
    logger.error({ err }, "Unhandled server error");
  } else {
    logger.warn({ err }, "Request error");
  }

  res.status(status).json({ error: message });
};
