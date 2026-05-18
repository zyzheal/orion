// orion-platform-service/src/api/degradation-routes.ts
/**
 * Degradation Management API Routes
 *
 * Provides AI Provider degradation status, configuration, and recovery stats.
 * All endpoints require authentication and tenant isolation.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { AutoRecoveryService, RecoveryStats } from '../services/degradation/AutoRecoveryService';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';

interface ProviderParams {
  providerId: string;
}

interface ProviderBody {
  providerId: string;
  successRate?: number;
  tenantId?: number;
}

// Service singleton - initialized once during plugin registration
let recoveryService: AutoRecoveryService | null = null;

export default async function degradationRoutes(fastify: FastifyInstance) {
  // Initialize service singleton
  if (!recoveryService) {
    recoveryService = new AutoRecoveryService();
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
        const allStats = recoveryService!.getAllStats();
        const stats = allStats.providers;
        const degraded = recoveryService!.getDegradedProviders();
        const config = recoveryService!.getConfig();
        const successRate = recoveryService!.getOverallSuccessRate();

        // Filter stats by tenant if applicable
        const filteredStats = tenantId
          ? stats.filter(s => s.providerId.includes(`tenant-${tenantId}`))
          : stats;

        reply.send({
          stats: filteredStats,
          degradedProviders: degraded,
          config,
          overallSuccessRate: successRate,
        });
      } catch (error) {
        reply.code(500).send({
          code: 500,
          error: 'INTERNAL_ERROR',
          message: 'Failed to get degradation status',
        });
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
        reply.code(500).send({
          code: 500,
          error: 'INTERNAL_ERROR',
          message: 'Failed to get configuration',
        });
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
          reply.code(404).send({
            code: 404,
            error: 'NOT_FOUND',
            message: 'Provider not found',
          });
          return;
        }

        reply.send(stats);
      } catch (error) {
        reply.code(500).send({
          code: 500,
          error: 'INTERNAL_ERROR',
          message: 'Failed to get provider stats',
        });
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
        reply.code(500).send({
          code: 500,
          error: 'INTERNAL_ERROR',
          message: 'Failed to get degraded providers',
        });
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
        if (request.user?.role !== 'admin') {
          reply.code(403).send({
            code: 403,
            error: 'FORBIDDEN',
            message: 'Only admin can update provider success rates',
          });
          return;
        }

        const { providerId, successRate } = request.body;

        if (!providerId || successRate === undefined) {
          reply.code(400).send({
            code: 400,
            error: 'BAD_REQUEST',
            message: 'providerId and successRate are required',
          });
          return;
        }

        // Validate successRate range
        if (successRate < 0 || successRate > 1) {
          reply.code(400).send({
            code: 400,
            error: 'BAD_REQUEST',
            message: 'successRate must be between 0 and 1',
          });
          return;
        }

        recoveryService!.updateProviderSuccessRate(providerId, successRate);
        reply.send({ success: true });
      } catch (error) {
        reply.code(500).send({
          code: 500,
          error: 'INTERNAL_ERROR',
          message: 'Failed to update success rate',
        });
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
        reply.code(500).send({
          code: 500,
          error: 'INTERNAL_ERROR',
          message: 'Failed to get all stats',
        });
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
        reply.code(500).send({
          code: 500,
          error: 'INTERNAL_ERROR',
          message: 'Failed to get success rate',
        });
      }
    }
  );
}