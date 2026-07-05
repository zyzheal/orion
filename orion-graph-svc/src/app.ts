import Fastify from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import { config } from './config';
import { graphRoutes } from './routes/graph-routes';
import { errorHandler } from './middleware/errorHandler';
import { DatabasePool } from './db/database';
import { GraphNodeRepository } from './repositories/GraphNodeRepository';
import { GraphRelationshipRepository } from './repositories/GraphRelationshipRepository';

const app = Fastify({ logger: { level: config.logLevel } });

/** Noop pool for fallback (in-memory mode, same API shape) */
class NoopPool {
  async query(): Promise<{ rows: any[]; rowCount: null }> { return { rows: [], rowCount: null }; }
  async connect(): Promise<void> {}
  async close(): Promise<void> {}
}

async function start() {
  // Config validation
  if (process.env.NODE_ENV === 'production' && config.neo4j.password === 'password') {
    console.error('[graph-svc] ERROR: NEO4J_PASSWORD must not be the default value "password" in production');
    process.exit(1);
  }

  await app.register(cors, { origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:5173', 'http://localhost:3000'] });
  await app.register(sensible);
  errorHandler(app);

  // Initialize PostgreSQL
  let db: DatabasePool | undefined;
  if (process.env.DATABASE_URL) {
    db = new DatabasePool({ connectionString: process.env.DATABASE_URL });
    await db.connect();
    console.log('[graph-svc] PostgreSQL connected');
  }

  const pool = db ?? new NoopPool();
  const nodeRepo = new GraphNodeRepository(pool);
  const relRepo = new GraphRelationshipRepository(pool);
  app.decorate('graphNodeRepository', nodeRepo);
  app.decorate('graphRelationshipRepository', relRepo);

  // Health check
  app.get('/healthz', async () => ({
    status: 'ok',
    service: 'orion-graph-svc',
    timestamp: new Date().toISOString(),
    database: db ? 'connected' : 'disconnected',
  }));

  await app.register(graphRoutes);

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`[graph-svc] Received ${signal}, shutting down gracefully...`);
    if (db) await db.close();
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
