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
// Production origin is locked to the GitHub Pages site.
// Localhost variants are kept for local development.
//
const allowedOrigins: (string | RegExp)[] = [
  "https://aronbisaka686-sjsk.github.io", // production — GitHub Pages
  /^http:\/\/localhost(:\d+)?$/,           // local dev
  /^http:\/\/127\.0\.0\.1(:\d+)?$/,        // local dev (IP)
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
    credentials: true, // allows Authorization header to be read by the browser
  }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// Global error handler — must be registered after all routes.
app.use(errorHandler);

export default app;
