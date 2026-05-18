import Fastify from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import { config } from './config';
import inceptionRoutes from './routes/inception-routes';
import { DatabasePool } from './db/database';
import { SqlAuditRepository } from './repositories/SqlAuditRepository';

const app = Fastify({ logger: { level: config.logLevel } });

/** Noop pool for fallback (in-memory mode, same API shape) */
class NoopPool {
  async query(): Promise<{ rows: any[]; rowCount: null }> { return { rows: [], rowCount: null }; }
  async connect(): Promise<void> {}
  async close(): Promise<void> {}
}

async function start() {
  // Config validation
  if (process.env.NODE_ENV === 'production' && !config.inception.password) {
    console.error('[inception-svc] ERROR: INCEPTION_PASSWORD must be set in production');
    process.exit(1);
  }
  if (config.inception.password === '') {
    console.warn('[inception-svc] WARNING: INCEPTION_PASSWORD is empty (insecure for production)');
  }

  await app.register(cors, { origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:5173', 'http://localhost:3000'] });
  await app.register(sensible);

  // Initialize PostgreSQL
  let db: DatabasePool | undefined;
  if (process.env.DATABASE_URL) {
    db = new DatabasePool({ connectionString: process.env.DATABASE_URL });
    await db.connect();
    console.log('[inception-svc] PostgreSQL connected');
  }

  const pool = db ?? new NoopPool();
  const auditRepo = new SqlAuditRepository(pool);
  app.decorate('sqlAuditRepository', auditRepo);

  // Health check
  app.get('/healthz', async () => ({
    status: 'ok',
    service: 'orion-inception-svc',
    timestamp: new Date().toISOString(),
    database: db ? 'connected' : 'disconnected',
  }));

  await app.register(inceptionRoutes, { prefix: '/api/v1/inception' });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`[inception-svc] Received ${signal}, shutting down gracefully...`);
    if (db) await db.close();
    await app.close();
    process.exit(0);
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  try {
    await app.listen({ port: config.port, host: config.host });
    console.log(`[inception-svc] Listening on http://${config.host}:${config.port}`);
  } catch (err) {
    console.error('[inception-svc] Failed to start:', err);
    process.exit(1);
  }
}

start();
export default app;
