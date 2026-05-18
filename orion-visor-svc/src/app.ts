import Fastify from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import { errorHandler } from './middleware/errorHandler';
import { visorRoutes } from './routes/visor-routes';
import { DatabasePool } from './db/database.js';
import { HostRepository } from './repositories/HostRepository.js';
import { ScriptRepository } from './repositories/ScriptRepository.js';
import { TaskRepository } from './repositories/TaskRepository.js';

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
      database: process.env.DB_NAME || 'orion_visorsvc',
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
  const hostRepo = new HostRepository(pool);
  const scriptRepo = new ScriptRepository(pool);
  const taskRepo = new TaskRepository(pool);

  // Decorate fastify with repositories for route access
  fastify.decorate('hostRepo', hostRepo);
  fastify.decorate('scriptRepo', scriptRepo);
  fastify.decorate('taskRepo', taskRepo);

  await fastify.register(visorRoutes, { prefix: '/api/v1/visor' });

  fastify.get('/health', async () => ({
    status: 'ok',
    service: 'orion-visor-svc',
    database: db ? 'connected' : 'disconnected',
    visorBackend: process.env.VISOR_URL || 'http://localhost:8080',
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
  const port = parseInt(process.env.PORT || '3032', 10);
  await fastify.listen({ port, host: '0.0.0.0' });
  fastify.log.info(`Visor Service listening on http://0.0.0.0:${port}`);
}

if (process.argv[1] === new URL(import.meta.url).pathname) { main(); }
export { buildApp };
