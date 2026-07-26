import Fastify from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import { errorHandler } from './middleware/errorHandler';
import { dbaRoutes } from './routes/dba';
import { DatabasePool } from './db/database.js';
import { SqlOrderRepository } from './repositories/SqlOrderRepository.js';
import { DataSourceRepository } from './repositories/DataSourceRepository.js';
import { AuditRuleRepository } from './repositories/AuditRuleRepository.js';

/** Noop pool for fallback (in-memory mode, same API shape) */
class NoopPool {
  async query(): Promise<{ rows: any[]; rowCount: null }> { return { rows: [], rowCount: null }; }
  async connect(): Promise<void> {}
  async close(): Promise<void> {}
}

async function buildApp() {
  const fastify = Fastify({ logger: { level: process.env.LOG_LEVEL || 'info' } });

  await fastify.register(cors, { origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:5173', 'http://localhost:3000'] });
  await fastify.register(sensible);
  errorHandler(fastify);

  // Initialize PostgreSQL
  let db: DatabasePool | undefined;
  if (process.env.DATABASE_URL) {
    db = new DatabasePool({ connectionString: process.env.DATABASE_URL });
    await db.connect();
    fastify.log.info('Database connected');
  } else {
    const cfg = {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      database: process.env.DB_NAME || 'orion_dba',
      user: process.env.DB_USER || 'orion',
      password: process.env.DB_PASSWORD || '',
    };
    try {
      db = new DatabasePool(cfg);
      await db.connect();
      fastify.log.info('Database connected via config');
    } catch (err: any) {
      fastify.log.warn(`Database connection failed: ${err.message}, falling back to in-memory mode`);
    }
  }

  // Initialize repositories
  const pool = db || new NoopPool();
  const sqlOrderRepo = new SqlOrderRepository(pool);
  const dataSourceRepo = new DataSourceRepository(pool);
  const auditRuleRepo = new AuditRuleRepository(pool);

  // Decorate fastify with repositories for route access
  fastify.decorate('sqlOrderRepo', sqlOrderRepo);
  fastify.decorate('dataSourceRepo', dataSourceRepo);
  fastify.decorate('auditRuleRepo', auditRuleRepo);

  await fastify.register(dbaRoutes, { prefix: '/api/v1/dba' });

  fastify.get('/health', async () => ({
    status: 'ok',
    service: 'orion-dba-svc',
    database: db ? 'connected' : 'disconnected',
    yearningBackend: process.env.YEARNING_URL || 'http://localhost:8000',
    timestamp: new Date().toISOString(),
  }));

  // Graceful shutdown
  fastify.addHook('onClose', async () => {
    if (db) {
      await db.close();
    }
  });

  return { fastify };
}

async function main() {
  const { fastify } = await buildApp();
  const port = parseInt(process.env.PORT || '3031', 10);
  await fastify.listen({ port, host: '0.0.0.0' });
  fastify.log.info(`DBA Service listening on http://0.0.0.0:${port}`);
}

if (process.argv[1] === new URL(import.meta.url).pathname) { main(); }
export { buildApp };
