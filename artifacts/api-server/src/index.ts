import app from "./app";
import { logger } from "./lib/logger";
import { connectDb } from "@workspace/db";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Verify DB connectivity before accepting requests.
// This provides a clear startup error if the connection string is wrong,
// rather than a confusing runtime failure on the first query.
connectDb()
  .then(() => {
    logger.info("Database connection verified");

    app.listen(port, (err) => {
      if (err) {
        logger.error({ err }, "Error listening on port");
        process.exit(1);
      }
      logger.info({ port }, "Server listening");
    });
  })
  .catch((err: unknown) => {
    logger.error(
      { err },
      "Failed to connect to database — check AIVEN_DATABASE_URL or DATABASE_URL",
    );
    process.exit(1);
  });
