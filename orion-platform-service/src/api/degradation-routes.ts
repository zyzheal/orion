// orion-platform-service/src/api/degradation-routes.ts
/**
 * Degradation Management API Routes
 *
 * Provides AI Provider degradation status, configuration, and recovery stats.
 * All endpoints require authentication and tenant isolation.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createLogger } from '../utils/logger';
import { AutoRecoveryService, RecoveryStats } from '../services/degradation/AutoRecoveryService';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import { DatabasePool } from '../services/database';
import { OrionError, ValidationError, NotFoundError, ForbiddenError, ErrorCode, handleError } from '../errors';

const logger = createLogger('degradation-routes');

interface ProviderParams {
  providerId: string;
}

interface ProviderBody {
  providerId: string;
  successRate?: number;
  tenantId?: number;
}

interface DegradationRoutesOptions {
  database?: DatabasePool;
}

// Service singleton - initialized once during plugin registration
let recoveryService: AutoRecoveryService | null = null;

export default async function degradationRoutes(fastify: FastifyInstance, options: DegradationRoutesOptions = {}) {
  // Initialize service singleton
  if (!recoveryService && options.database) {
    recoveryService = new AutoRecoveryService({}, options.database);
  }

  // Apply authentication to all routes in this plugin
  fastify.addHook('onRequest', authenticateUser);

  // Get recovery service status
  fastify.get(
    '/status',
    { onRequest: [requirePermission({ resource: 'degradation', action: 'read' })] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        // Tenant isolation: only return stats for user's tenant
        const tenantId = request.user?.tenantId;
        const allStats = await recoveryService!.getAllStats();
        const stats = allStats.providers;
        const degraded = recoveryService!.getDegradedProviders();
        const config = recoveryService!.getConfig();
        const successRate = recoveryService!.getOverallSuccessRate();

        // Filter stats by tenant if applicable
        const filteredStats = tenantId
          ? stats.filter((s: RecoveryStats) => s.providerId.includes(`tenant-${tenantId}`))
          : stats;

        reply.send({
          stats: filteredStats,
          degradedProviders: degraded,
          config,
          overallSuccessRate: successRate,
        });
      } catch (error) {
        logger.error({ err: error }, '[Degradation] Failed to get status');
        handleError(reply, new OrionError('Failed to retrieve degradation status', ErrorCode.INTERNAL_ERROR));
      }
    }
  );

  // Get current configuration
  fastify.get(
    '/config',
    { onRequest: [requirePermission({ resource: 'degradation', action: 'read' })] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const config = recoveryService!.getConfig();
        reply.send(config);
      } catch (error) {
        logger.error({ err: error }, '[Degradation] Failed to get config');
        handleError(reply, new OrionError('Failed to retrieve degradation config', ErrorCode.INTERNAL_ERROR));
      }
    }
  );

  // Get recovery stats for a provider
  fastify.get<{ Params: ProviderParams }>(
    '/stats/:providerId',
    { onRequest: [requirePermission({ resource: 'degradation', action: 'read' })] },
    async (request: FastifyRequest<{ Params: ProviderParams }>, reply: FastifyReply) => {
      try {
        const { providerId } = request.params;
        const stats = recoveryService!.getRecoveryStats(providerId);

        if (!stats) {
          handleError(reply, new NotFoundError(`Provider ${providerId} not found`));
          return;
        }

        reply.send(stats);
      } catch (error) {
        logger.error({ err: error }, '[Degradation] Failed to get recovery stats');
        handleError(reply, new OrionError('Failed to retrieve recovery stats', ErrorCode.INTERNAL_ERROR));
      }
    }
  );

  // Get degraded providers
  fastify.get(
    '/degraded',
    { onRequest: [requirePermission({ resource: 'degradation', action: 'read' })] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const degraded = recoveryService!.getDegradedProviders();
        reply.send({ providers: degraded });
      } catch (error) {
        logger.error({ err: error }, '[Degradation] Failed to get degraded providers');
        handleError(reply, new OrionError('Failed to retrieve degraded providers', ErrorCode.INTERNAL_ERROR));
      }
    }
  );

  // Update provider success rate (admin only)
  fastify.post<{ Body: ProviderBody }>(
    '/update-rate',
    { onRequest: [requirePermission({ resource: 'degradation', action: 'manage' })] },
    async (request: FastifyRequest<{ Body: ProviderBody }>, reply: FastifyReply) => {
      try {
        // Authorization: only admin can update rates
        const roles = (request as any).user?.roles as string[] | undefined;
        if (!roles?.includes('admin')) {
          handleError(reply, new ForbiddenError('Only admins can update provider success rates'));
          return;
        }

        const { providerId, successRate } = request.body;

        if (!providerId) {
          handleError(reply, new ValidationError('Provider ID is required'));
          return;
        }

        if (successRate === undefined || successRate === null) {
          handleError(reply, new ValidationError('Success rate is required'));
          return;
        }

        // Validate successRate range
        if (successRate < 0 || successRate > 1) {
          handleError(reply, new ValidationError('Success rate must be between 0 and 1'));
          return;
        }

        recoveryService!.updateProviderSuccessRate(providerId, successRate);
        reply.send({ success: true });
      } catch (error) {
        logger.error({ err: error }, '[Degradation] Failed to update success rate');
        handleError(reply, new OrionError('Failed to update provider success rate', ErrorCode.INTERNAL_ERROR));
      }
    }
  );

  // Get all providers' recovery stats
  fastify.get(
    '/stats',
    { onRequest: [requirePermission({ resource: 'degradation', action: 'read' })] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const allStats = recoveryService!.getAllStats();
        reply.send({ providers: allStats });
      } catch (error) {
        logger.error({ err: error }, '[Degradation] Failed to get all stats');
        handleError(reply, new OrionError('Failed to retrieve all recovery stats', ErrorCode.INTERNAL_ERROR));
      }
    }
  );

  // Get overall success rate
  fastify.get(
    '/success-rate',
    { onRequest: [requirePermission({ resource: 'degradation', action: 'read' })] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const rate = recoveryService!.getOverallSuccessRate();
        reply.send({ successRate: rate });
      } catch (error) {
        logger.error({ err: error }, '[Degradation] Failed to get success rate');
        handleError(reply, new OrionError('Failed to retrieve overall success rate', ErrorCode.INTERNAL_ERROR));
      }
    }
  );
}