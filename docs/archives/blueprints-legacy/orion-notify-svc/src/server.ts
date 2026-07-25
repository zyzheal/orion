import { createApp } from './app';
import { config } from './config';
import { testConnection, closePool } from './utils/database';

async function start(): Promise<void> {
  const app = await createApp();

  try {
    await testConnection();
    app.log.info('Database connection established');
  } catch (err) {
    app.log.error({ err: err as Error }, 'Failed to connect to database');
    process.exit(1);
  }

  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, async () => {
      app.log.info(`Received ${signal}, shutting down gracefully...`);
      await app.close();
      await closePool();
      process.exit(0);
    });
  }

  try {
    await app.listen({ port: config.port, host: config.host });
    app.log.info(`Orion Notify Service running on http://${config.host}:${config.port}`);
  } catch (err) {
    app.log.error({ err: err as Error }, 'Failed to start server');
    process.exit(1);
  }
}

start();
