import Fastify from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import approvalRoutes from './routes/approval';
import confirmationRoutes from './routes/confirmation';
import { createDatabasePool } from './services/database';
import { errorHandler } from './middleware/errorHandler';

async function buildApp() {
  const fastify = Fastify({ logger: { level: 'info' } });

  await fastify.register(cors, { origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:5173', 'http://localhost:3000'] });
  await fastify.register(sensible);
  errorHandler(fastify);

  // Initialize database pool
  const database = await createDatabasePool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'approval_db',
    poolSize: parseInt(process.env.DB_POOL_SIZE || '10', 10),
  });

  // Register routes with database pool
  await fastify.register(approvalRoutes, { prefix: '/api/v1/approvals', database });
  await fastify.register(confirmationRoutes, { prefix: '/api/v1/confirmations', database });

  // Health check
  fastify.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

  return { fastify, database };
}

async function main() {
  const { fastify, database } = await buildApp();
  const port = parseInt(process.env.PORT || '3023', 10);
  await fastify.listen({ port, host: '0.0.0.0' });
  fastify.log.info(`Approval Service listening on http://0.0.0.0:${port}`);

  // Graceful shutdown
  const shutdown = async () => {
    fastify.log.info('Shutting down...');
    await fastify.close();
    await database.end();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

if (process.argv[1] === new URL(import.meta.url).pathname) { main(); }
export { buildApp };
