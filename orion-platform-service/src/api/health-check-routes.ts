/**
 * Health Check API Routes
 *
 * Provides REST API for managing and executing health checks:
 * - List all registered health checks
 * - Register a new health check
 * - Get check details
 * - Execute a health check manually
 * - Execute all health checks
 * - Delete a health check
 *
 * TASK-4.34: Real Health Check Execution
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import { HealthCheckerService } from '../services/health-check';
import { OrionError, ValidationError, NotFoundError, ErrorCode, handleError } from '../errors';
import { createLogger } from '../utils/logger';

const logger = createLogger('health-check-routes');

// Minimal db mock for type compatibility — the service methods that use
// the database (listChecks, registerCheck, etc.) will return empty results
// until a real database connection is wired in.
const mockDb = { query: async () => ({ rows: [] as any[], rowCount: 0 }) };

export default async function healthCheckRoutes(app: FastifyInstance): Promise<void> {
  const healthCheckService = new HealthCheckerService(mockDb);

  // ==================== List Checks ====================

  app.get('/health-checks', {
    onRequest: [authenticateUser, requirePermission({ resource: 'health-check', action: 'read' })],
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const checks = await healthCheckService.listChecks('');
      return reply.status(200).send({
        success: true,
        data: { checks, count: checks.length },
      });
    } catch (error: any) {
      return handleError(reply, new OrionError('LIST_ERROR', ErrorCode.INTERNAL_ERROR));
    }
  });

  // ==================== Get Check Detail ====================

  app.get('/health-checks/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'health-check', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const params = request.params as { id: string };
      const check = healthCheckService.getCheck(params.id);

      if (!check) {
        return handleError(reply, new NotFoundError('NOT_FOUND'));
      }

      return reply.status(200).send({
        success: true,
        data: { check },
      });
    } catch (error: any) {
      return handleError(reply, new OrionError('GET_ERROR', ErrorCode.INTERNAL_ERROR));
    }
  });

  // ==================== Register Check ====================

  app.post('/health-checks', {
    onRequest: [authenticateUser, requirePermission({ resource: 'health-check', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as any;

      // Validate required fields
      if (!body.name || !body.type) {
        return handleError(reply, new ValidationError('VALIDATION_ERROR'));
      }

      const validTypes = ['endpoint', 'database', 'redis', 'kubernetes'];
      if (!validTypes.includes(body.type)) {
        return handleError(reply, new ValidationError('VALIDATION_ERROR'));
      }

      // Validate type-specific config
      if (body.type === 'endpoint' && !body.config?.url) {
        return handleError(reply, new ValidationError('VALIDATION_ERROR'));
      }
      if (body.type === 'database' && !body.config?.connectionString) {
        return handleError(reply, new ValidationError('VALIDATION_ERROR'));
      }
      if (body.type === 'redis' && !body.config?.connectionString) {
        return handleError(reply, new ValidationError('VALIDATION_ERROR'));
      }

      const check = await healthCheckService.registerCheck({
        serviceName: body.name,
        serviceUrl: body.config?.url || body.config?.connectionString || `${body.type}-check`,
        checkType: body.type,
        intervalSeconds: body.intervalMs ? Math.round(body.intervalMs / 1000) : undefined,
      });

      return reply.status(201).send({
        success: true,
        message: 'Health check registered',
        data: { check },
      });
    } catch (error: any) {
      return handleError(reply, new OrionError('REGISTER_ERROR', ErrorCode.INTERNAL_ERROR));
    }
  });

  // ==================== Execute Single Check ====================

  app.post('/health-checks/:id/execute', {
    onRequest: [authenticateUser, requirePermission({ resource: 'health-check', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const params = request.params as { id: string };
      const check = await healthCheckService.getCheck(params.id);
      if (!check) {
        return handleError(reply, new NotFoundError('NOT_FOUND'));
      }

      const result = await healthCheckService.runCheck(check);

      return reply.status(200).send({
        success: true,
        data: { result },
      });
    } catch (error: any) {
      if (error.message?.includes('not found')) {
        return handleError(reply, new NotFoundError('NOT_FOUND'));
      }
      return handleError(reply, new OrionError('EXECUTE_ERROR', ErrorCode.INTERNAL_ERROR));
    }
  });

  // ==================== Execute All Checks ====================

  app.post('/health-checks/execute-all', {
    onRequest: [authenticateUser, requirePermission({ resource: 'health-check', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as any || {};

      const options = {
        timeoutMs: body.timeoutMs,
        retries: body.retries,
      };

      const allChecks = await healthCheckService.listChecks('');
      const results = await Promise.all(allChecks.map(c => healthCheckService.runCheck(c)));

      // Summarize results
      const upCount = results.filter((r: any) => r.status === 'up').length;
      const downCount = results.filter((r: any) => r.status === 'down').length;
      const degradedCount = results.filter((r: any) => r.status === 'degraded').length;

      return reply.status(200).send({
        success: true,
        data: {
          results,
          summary: {
            total: results.length,
            up: upCount,
            down: downCount,
            degraded: degradedCount,
          },
        },
      });
    } catch (error: any) {
      return handleError(reply, new OrionError('EXECUTE_ALL_ERROR', ErrorCode.INTERNAL_ERROR));
    }
  });

  // ==================== Delete Check ====================

  app.delete('/health-checks/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'health-check', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const params = request.params as { id: string };
      const deleted = healthCheckService.unregisterCheck(params.id);

      if (!deleted) {
        return handleError(reply, new NotFoundError('NOT_FOUND'));
      }

      return reply.status(200).send({
        success: true,
        message: 'Health check deleted',
      });
    } catch (error: any) {
      return handleError(reply, new OrionError('DELETE_ERROR', ErrorCode.INTERNAL_ERROR));
    }
  });

  // ==================== Quick Health Check (no registration required) ====================

  /**
   * Execute a one-off health check without registering it
   * POST /health-checks/quick
   */
  app.post('/health-checks/quick', {
    onRequest: [authenticateUser, requirePermission({ resource: 'health-check', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as any;

      if (!body.type) {
        return handleError(reply, new ValidationError('VALIDATION_ERROR'));
      }

      const validTypes = ['endpoint', 'database', 'redis', 'kubernetes'];
      if (!validTypes.includes(body.type)) {
        return handleError(reply, new ValidationError('VALIDATION_ERROR'));
      }

      const timeout = body.timeoutMs || 5000;
      let result: { status: 'healthy' | 'unhealthy' | 'degraded' | 'timeout' | 'error'; latencyMs: number; errorMessage?: string | null; details?: Record<string, unknown> };

      switch (body.type) {
        case 'endpoint': {
          if (!body.url) {
            return handleError(reply, new ValidationError('VALIDATION_ERROR'));
          }
          const service = new HealthCheckerService(mockDb);
          result = await service.checkEndpoint(body.url, timeout);
          break;
        }
        case 'database': {
          if (!body.connectionString) {
            return handleError(reply, new ValidationError('VALIDATION_ERROR'));
          }
          const service = new HealthCheckerService(mockDb);
          result = await service.checkDatabase(body.connectionString, timeout);
          break;
        }
        case 'redis': {
          if (!body.connectionString) {
            return handleError(reply, new ValidationError('VALIDATION_ERROR'));
          }
          const service = new HealthCheckerService(mockDb);
          result = await service.checkRedis(body.connectionString, timeout);
          break;
        }
        case 'kubernetes': {
          const service = new HealthCheckerService(mockDb);
          result = await service.checkKubernetes(timeout, body.kubeconfig, body.resources);
          break;
        }
        default:
          return handleError(reply, new ValidationError('VALIDATION_ERROR'));
      }

      return reply.status(200).send({
        success: true,
        data: {
          type: body.type,
          ...result,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error: any) {
      return handleError(reply, new OrionError('QUICK_CHECK_ERROR', ErrorCode.INTERNAL_ERROR));
    }
  });
}
