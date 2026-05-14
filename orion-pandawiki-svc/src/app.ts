import Fastify from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import { config } from './config';
import { pandawikiRoutes } from './routes/pandawiki';

const app = Fastify({ logger: { level: config.logLevel } });

async function start() {
  await app.register(cors, { origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:5173', 'http://localhost:3000'] });
  await app.register(sensible);

  // Health check endpoint for K8s liveness/readiness probes
  app.get('/healthz', async () => ({
    status: 'ok',
    service: 'orion-pandawiki-svc',
    timestamp: new Date().toISOString(),
  }));

  await app.register(pandawikiRoutes);

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`[pandawiki-svc] Received ${signal}, shutting down gracefully...`);
    await app.close();
    process.exit(0);
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  try {
    await app.listen({ port: config.port, host: config.host });
    console.log(`[pandawiki-svc] Listening on http://${config.host}:${config.port}`);
  } catch (err) {
    console.error('[pandawiki-svc] Failed to start:', err);
    process.exit(1);
  }
}

start();
export default app;
