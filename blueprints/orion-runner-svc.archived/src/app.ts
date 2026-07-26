import type { FastifyInstance } from 'fastify';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import { config } from './config';
import { RunnerService } from './services/RunnerService';
import { runnerRoutes } from './routes/runner-routes';
import { DatabasePool } from './db/database';
import { JobRepository } from './repositories/JobRepository';

/** Noop pool for fallback (in-memory mode, same API shape) */
class NoopPool {
  async query(): Promise<{ rows: any[]; rowCount: null }> { return { rows: [], rowCount: null }; }
  async connect(): Promise<void> {}
  async close(): Promise<void> {}
}

export async function buildApp(): Promise<{ fastify: FastifyInstance; runner: RunnerService; jobRepo: JobRepository; db?: DatabasePool }> {
  const fastify = Fastify({ logger: { level: config.logLevel } });

  await fastify.register(cors, { origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:5173', 'http://localhost:3000'] });
  await fastify.register(sensible);

  // Initialize PostgreSQL
  let db: DatabasePool | undefined;
  if (process.env.DATABASE_URL) {
    db = new DatabasePool({ connectionString: process.env.DATABASE_URL });
    await db.connect();
    console.log('[runner] PostgreSQL connected');
  }

  const pool = db ?? new NoopPool();
  const jobRepo = new JobRepository(pool);

  const runner = new RunnerService(jobRepo);

  await fastify.register(runnerRoutes, { runner });

  return { fastify, runner, jobRepo, db };
}

export async function startServer(): Promise<void> {
  const { fastify, runner: runnerService, db } = await buildApp();

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
    if (db) await db.close();
    await fastify.close();
    process.exit(0);
  });
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  startServer();
}
