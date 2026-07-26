/**
 * PandaWiki Service - Application Entry Point
 *
 * Wraps PandaWiki knowledge base API behind unified HTTP interface.
 * Adds tenant isolation, NATS event integration, and PostgreSQL storage.
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import { config } from './config';
import { pandawikiRoutes } from './routes/pandawiki-routes';
import { getPool, initializeDatabase, closePool } from './utils/database.js';
import { WikiSpaceRepository } from './repositories/WikiSpaceRepository.js';
import { WikiDocumentRepository } from './repositories/WikiDocumentRepository.js';

const app = Fastify({ logger: { level: config.logLevel } });

async function start() {
  await app.register(cors, { origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:5173', 'http://localhost:3000'] });
  await app.register(sensible);

  // Initialize database connection and tables
  await initializeDatabase();
  const pool = getPool();

  // Wire repositories
  const wikiSpaceRepo = new WikiSpaceRepository(pool);
  const wikiDocRepo = new WikiDocumentRepository(pool);

  // Make repositories available via Fastify decorators
  app.decorate('wikiSpaceRepository', wikiSpaceRepo);
  app.decorate('wikiDocumentRepository', wikiDocRepo);

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
    await closePool();
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

// Fastify decorator type declarations
declare module 'fastify' {
  interface FastifyInstance {
    wikiSpaceRepository: WikiSpaceRepository;
    wikiDocumentRepository: WikiDocumentRepository;
  }
}

export default app;
