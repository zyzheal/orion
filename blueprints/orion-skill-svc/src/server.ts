import { createApp } from "./app";
import { config } from "./config";
import { testConnection, runMigrations, closePool } from "./utils/database";

async function start(): Promise<void> {
  const app = await createApp();

  // Verify database connection
  try {
    const connected = await testConnection();
    if (connected) {
      app.log.info("Database connection established");
    }
  } catch (err) {
    app.log.error({ err: err as Error }, "Failed to connect to database");
    process.exit(1);
  }

  // Run migrations on startup in development
  if (config.server.nodeEnv === "development") {
    try {
      await runMigrations();
      app.log.info("Database migrations completed");
    } catch (err) {
      app.log.error({ err: err as Error }, "Migration failed");
      process.exit(1);
    }
  }

  // Graceful shutdown
  const signals = ["SIGINT", "SIGTERM"] as const;
  for (const signal of signals) {
    process.on(signal, async () => {
      app.log.info(`Received ${signal}, shutting down gracefully...`);
      await app.close();
      await closePool();
      process.exit(0);
    });
  }

  // Start server
  try {
    await app.listen({
      port: config.server.port,
      host: config.server.host,
    });
    app.log.info(
      `Orion Skill Service running on http://${config.server.host}:${config.server.port}`,
    );
  } catch (err) {
    app.log.error({ err: err as Error }, "Failed to start server");
    process.exit(1);
  }
}

start();
