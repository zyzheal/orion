import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { config } from './config';
import { governanceRoutes } from './routes/governance';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/logger';
import { getPool, initializeDatabase, closePool } from './utils/database.js';
import { ContractRepository } from './repositories/ContractRepository.js';
import { VersionRepository } from './repositories/VersionRepository.js';
import { DeprecationRepository } from './repositories/DeprecationRepository.js';

export async function createApp() {
  const fastify = Fastify({
    logger: {
      level: config.logging.level,
      transport: config.logging.pretty
        ? { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss Z', ignore: 'pid,hostname' } }
        : undefined,
    },
  });

  // Initialize database connection and tables
  await initializeDatabase();
  const pool = getPool();

  // Wire repositories
  const contractRepo = new ContractRepository(pool);
  const versionRepo = new VersionRepository(pool);
  const deprecationRepo = new DeprecationRepository(pool);

  // Make repositories available via Fastify decorators
  fastify.decorate('contractRepository', contractRepo);
  fastify.decorate('versionRepository', versionRepo);
  fastify.decorate('deprecationRepository', deprecationRepo);

  await fastify.register(cors, { origin: config.cors.origin === '*' ? true : config.cors.origin });
  await fastify.register(helmet, { contentSecurityPolicy: false });
  await fastify.register(rateLimit, { max: config.rateLimit.max, timeWindow: config.rateLimit.windowMs });

  fastify.addHook('onRequest', requestLogger);

  await fastify.register(governanceRoutes, { prefix: '/api/v1/api-governance' });

  fastify.get('/healthz', async () => ({
    status: 'ok',
    service: 'orion-governance-svc',
    timestamp: new Date().toISOString(),
  }));

  // Graceful shutdown
  fastify.addHook('onClose', async () => {
    await closePool();
  });

  fastify.setErrorHandler(errorHandler);

  return fastify;
}

// Fastify decorator type declarations
declare module 'fastify' {
  interface FastifyInstance {
    contractRepository: ContractRepository;
    versionRepository: VersionRepository;
    deprecationRepository: DeprecationRepository;
  }
}
