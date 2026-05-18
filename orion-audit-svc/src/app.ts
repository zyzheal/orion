import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { config } from './config';
import { getPool, closePool, initializeDatabase } from './utils/database';
import { AuditService } from './services/AuditService';
import { SecurityComplianceService } from './services/SecurityComplianceService';
import { auditRoutes } from './routes/audit';
import { complianceRoutes } from './routes/compliance';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/logger';

let auditService: AuditService | null = null;
let complianceService: SecurityComplianceService | null = null;

export function getServices() {
  const pool = getPool();
  if (!auditService) auditService = new AuditService();
  if (!complianceService) complianceService = new SecurityComplianceService(pool);
  return { auditService, complianceService };
}

export async function createApp() {
  const fastify = Fastify({
    logger: {
      level: config.logging.level,
      transport: config.logging.pretty
        ? { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss Z', ignore: 'pid,hostname' } }
        : undefined,
    },
  });

  // Initialize database
  try {
    const dbUrl = process.env.DATABASE_URL;
    if (dbUrl) {
      await initializeDatabase();
      fastify.log.info('[audit] Database initialized');
    } else {
      fastify.log.warn('[audit] DATABASE_URL not set, skipping database initialization');
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    fastify.log.warn(`[audit] Database initialization failed: ${msg}`);
  }

  await fastify.register(cors, { origin: config.security.corsOrigin });
  await fastify.register(helmet, { contentSecurityPolicy: false });
  await fastify.register(rateLimit, { max: config.security.rateLimitMax, timeWindow: config.security.rateLimitWindow });

  requestLogger(fastify);

  // Decorate fastify with services
  const { auditService: auditSvc, complianceService: complianceSvc } = getServices();
  fastify.decorate('auditService', auditSvc);
  fastify.decorate('complianceService', complianceSvc);

  await fastify.register(auditRoutes, { prefix: '/api/v1/audit' });
  await fastify.register(complianceRoutes, { prefix: '/api/v1' });

  fastify.get('/healthz', async () => {
    try {
      const pool = getPool();
      await pool.query('SELECT 1');
      return { status: 'ok', service: 'orion-audit-svc', timestamp: new Date().toISOString(), checks: { database: 'up' } };
    } catch {
      return { status: 'degraded', service: 'orion-audit-svc', timestamp: new Date().toISOString(), checks: { database: 'down' } };
    }
  });

  fastify.addHook('onClose', async () => { await closePool(); });

  fastify.setErrorHandler(errorHandler);
  fastify.setNotFoundHandler(notFoundHandler);

  return fastify;
}
