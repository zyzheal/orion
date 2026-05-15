import type { FastifyInstance } from 'fastify';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import { config } from './config';
import { RunnerService } from './services/RunnerService';
import { runnerRoutes } from './routes/runner-routes';

const runner = new RunnerService();

export async function buildApp(): Promise<{ fastify: FastifyInstance; runner: RunnerService }> {
  const fastify = Fastify({ logger: { level: config.logLevel } });

  await fastify.register(cors, { origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:5173', 'http://localhost:3000'] });
  await fastify.register(sensible);

  await fastify.register(runnerRoutes, { runner });

  return { fastify, runner };
}

export async function startServer(): Promise<void> {
  const { fastify, runner: runnerService } = await buildApp();

  // Register with Platform first
  try {
    await runnerService.registerWithRetry();
    runnerService.startHeartbeat();
  } catch (error) {
    console.error(`[runner] Failed during registration: ${(error as Error).message}`);
    process.exit(1);
  }

  try {
    await fastify.listen({ port: config.port, host: config.host });
    console.log(`[runner] Runner Service listening on http://${config.host}:${config.port}`);
  } catch (err) {
    console.error('[runner] Failed to start server:', err);
    process.exit(1);
  }

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('[runner] SIGTERM received, shutting down...');
    runnerService.stopHeartbeat();
    await fastify.close();
    process.exit(0);
  });
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  startServer();
}

export { runner };
