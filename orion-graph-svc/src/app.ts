import Fastify from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import { config } from './config';
import { graphRoutes } from './routes/graph-routes';
import { errorHandler } from './middleware/errorHandler';

const app = Fastify({ logger: { level: config.logLevel } });

async function start() {
  // Config validation
  if (process.env.NODE_ENV === 'production' && config.neo4j.password === 'password') {
    console.error('[graph-svc] ERROR: NEO4J_PASSWORD must not be the default value "password" in production');
    process.exit(1);
  }

  await app.register(cors, { origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:5173', 'http://localhost:3000'] });
  await app.register(sensible);
  errorHandler(app);

  // Health check
  app.get('/healthz', async () => ({
    status: 'ok',
    service: 'orion-graph-svc',
    timestamp: new Date().toISOString(),
  }));

  await app.register(graphRoutes);

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`[graph-svc] Received ${signal}, shutting down gracefully...`);
    await app.close();
    process.exit(0);
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  try {
    await app.listen({ port: config.port, host: config.host });
    console.log(`[graph-svc] Listening on http://${config.host}:${config.port}`);
  } catch (err) {
    console.error('[graph-svc] Failed to start:', err);
    process.exit(1);
  }
}

start();
export default app;
