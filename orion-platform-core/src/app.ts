import type { FastifyInstance } from 'fastify';
import Fastify from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyRateLimit from '@fastify/rate-limit';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import jwtAuth from './middleware/jwtAuth.js';
import tenantIsolation from './middleware/tenantIsolation.js';
import requirePermission from './middleware/requirePermission.js';
import apiKeyAuth from './middleware/apiKeyAuth.js';
import { tenantRoutes } from './routes/tenant.js';
import { projectRoutes } from './routes/project.js';
import { userRoutes } from './routes/user.js';
import { rbacRoutes } from './routes/rbac.js';
import { configRoutes } from './routes/config.js';
import { serviceDiscoveryRoutes } from './routes/serviceDiscovery.js';
import { initDatabase, runMigrations, closeDatabase } from './utils/database.js';
import { closeEventBus } from './utils/eventBus.js';

export interface AppOptions {
  port?: number;
  host?: string;
  runMigrations?: boolean;
}

export async function createApp(opts: AppOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
      transport:
        process.env.NODE_ENV === 'development'
          ? {
              target: 'pino-pretty',
              options: {
                translateTime: 'HH:MM:ss Z',
                ignore: 'pid,hostname',
              },
            }
          : undefined,
    },
  });

  // --- Plugins ---
  await app.register(fastifyCors, {
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  });

  await app.register(fastifyRateLimit, {
    max: Number(process.env.RATE_LIMIT_MAX) || 100,
    timeWindow: process.env.RATE_LIMIT_WINDOW || '1 minute',
  });

  await app.register(fastifySwagger, {
    openapi: {
      info: {
        title: 'Orion Platform Core API',
        description: 'Foundation service for tenant isolation, RBAC, API Key management, and system configuration',
        version: '1.0.0',
      },
      servers: [
        {
          url: process.env.BASE_URL || 'http://localhost:3001',
          description: 'Development server',
        },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
          apiKeyAuth: {
            type: 'apiKey',
            name: 'X-API-Key',
            in: 'header',
          },
        },
      },
    },
  });

  await app.register(fastifySwaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
    },
  });

  // --- Authentication & Authorization Middleware ---
  const jwtSecret = process.env.JWT_SECRET;
  if (jwtSecret) {
    await app.register(jwtAuth, { secret: jwtSecret });
  }
  await app.register(tenantIsolation, { headerName: 'X-Tenant-ID' });
  await app.register(requirePermission);
  await app.register(apiKeyAuth, { headerName: 'X-API-Key' });

  // --- Health Check ---
  app.get('/health', async () => {
    const checks: Record<string, string> = {};

    // Database health
    try {
      const { getPool } = await import('./utils/database.js');
      const pool = getPool();
      await pool.query('SELECT 1');
      checks.database = 'ok';
    } catch {
      checks.database = 'error';
    }

    // Redis health
    try {
      const { getRedis } = await import('./utils/redis.js');
      const redis = getRedis();
      await redis.ping();
      checks.redis = 'ok';
    } catch {
      checks.redis = 'error';
    }

    const hasError = Object.values(checks).includes('error');

    return {
      status: hasError ? 'degraded' : 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      checks,
    };
  });

  // --- Routes ---
  await app.register(tenantRoutes, { prefix: '/api/v1' });
  await app.register(projectRoutes, { prefix: '/api/v1' });
  await app.register(userRoutes, { prefix: '/api/v1' });
  await app.register(rbacRoutes, { prefix: '/api/v1' });
  await app.register(configRoutes, { prefix: '/api/v1' });
  await app.register(serviceDiscoveryRoutes, { prefix: '/api/v1' });

  return app;
}

export async function bootstrap(opts: AppOptions = {}): Promise<FastifyInstance> {
  const port = opts.port || Number(process.env.PORT) || 3001;
  const host = opts.host || process.env.HOST || '0.0.0.0';

  // Initialize database
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }
  await initDatabase(databaseUrl, process.env.NODE_ENV === 'production');

  // Run migrations if requested
  if (opts.runMigrations !== false) {
    await runMigrations();
  }

  // Create app
  const app = await createApp(opts);

  // Start server
  await app.listen({ port, host });
  app.log.info(`Platform Core API listening on http://${host}:${port}`);
  app.log.info(`Swagger docs available at http://${host}:${port}/docs`);

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    app.log.info(`${signal} received, shutting down gracefully...`);

    // Stop accepting new connections
    await app.close();

    // Close database connections
    await closeDatabase();

    // Close event bus
    await closeEventBus();

    app.log.info('Shutdown complete');
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  return app;
}

const start = async (): Promise<void> => {
  try {
    await bootstrap();
  } catch (err) {
    console.error('Failed to start application', err);
    process.exit(1);
  }
};

// Only start the server if this file is executed directly
const main = async () => {
  const url = import.meta.url;
  const argv1 = process.argv[1];
  if (url && argv1 && (url.endsWith(argv1) || url.endsWith('/' + argv1))) {
    await start();
  }
};

void main();

export { start };
