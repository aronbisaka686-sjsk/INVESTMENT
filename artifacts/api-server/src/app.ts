import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { errorHandler } from "./middlewares/errorHandler";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// ── CORS ──────────────────────────────────────────────────────────────────────
//
// Allow GitHub Pages origins and localhost for development.
//
// Security note: credentials (cookies/auth headers) are NOT enabled here.
// Enable them only once you have a specific, hard-coded origin — never with
// a wildcard/regex pattern.
//
// To add a custom domain: push its exact origin string to allowedOrigins.
// Example: "https://my-portfolio.example.com"
//
const allowedOrigins: (string | RegExp)[] = [
  /^https:\/\/[\w-]+\.github\.io$/, // any GitHub Pages domain
  /^http:\/\/localhost(:\d+)?$/,     // local dev
  /^http:\/\/127\.0\.0\.1(:\d+)?$/,  // local dev (IP)
];

app.use(
  cors({
    origin(origin, callback) {
      // Allow requests with no origin (server-to-server, curl, etc.)
      if (!origin) {
        callback(null, true);
        return;
      }
      const allowed = allowedOrigins.some((pattern) =>
        typeof pattern === "string" ? pattern === origin : pattern.test(origin),
      );
      if (allowed) {
        callback(null, true);
      } else {
        // Return a controlled 403 instead of letting Express emit a 500.
        const err = new Error(`CORS: origin not allowed — ${origin}`) as Error & {
          status: number;
        };
        err.status = 403;
        callback(err);
      }
    },
    // credentials: false (default) — enable only after locking down to a
    // specific origin and adding proper session/token auth.
  }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// Global error handler — must be registered after all routes.
app.use(errorHandler);

export default app;
