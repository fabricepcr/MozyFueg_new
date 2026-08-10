import app from "./app";
import { logger } from "./lib/logger";
import { runImageUrlMigration } from "./lib/imageMigration";
import { runToppingsPriceMigration } from "./lib/toppingsMigration";
import { runPizzaPriceMigration } from "./lib/pizzaPriceMigration";

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

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  // One-time migration: replace Supabase image URLs with Replit Object Storage URLs
  runImageUrlMigration().catch((e) =>
    logger.error({ err: e }, "Image URL migration failed")
  );

  // One-time migration: update topping prices from 2026-08 pricing sheet
  runToppingsPriceMigration().catch((e) =>
    logger.error({ err: e }, "Toppings price migration failed")
  );

  // One-time migration: populate 24cm pizza prices where still NULL
  runPizzaPriceMigration().catch((e) =>
    logger.error({ err: e }, "Pizza price migration failed")
  );
});
