/**
 * AI Cost Optimization API Routes
 *
 * Routes under /api/v1/ai/cost
 *
 * Provides cost optimization analysis, savings history, summary, and alerts
 * via the CostOptimizerService.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import { CostOptimizerService } from '../services/ai/CostOptimizerService';
import { DatabasePool } from '../services/database';
import { createLogger } from '../utils/logger';
import { OrionError, ErrorCode, handleError } from '../errors';

const logger = pino({ name: 'ai-cost-routes' });

export interface AICostRoutesOptions {
  database?: DatabasePool;
  costOptimizerService?: CostOptimizerService;
}

export default async function aiCostRoutes(
  app: FastifyInstance,
  options: AICostRoutesOptions
): Promise<void> {
  const service = options.costOptimizerService || new CostOptimizerService(options.database);

  // ==================== Cost Optimization ====================

  /**
   * POST /api/v1/ai/cost/optimize
   * Run cost optimization analysis and get recommendations
   */
  app.post(
    '/optimize',
    {
      onRequest: [
        authenticateUser,
        requirePermission({ resource: 'ai-cost', action: 'write' }),
      ],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = request.body as { tenantId?: string };
        const tenantId = body.tenantId || (request as any).tenantContext?.getCurrentTenant()?.tenantId || 'default';

        const analysis = service.analyzeCostSavings(tenantId);
        const recommendations = await service.recommendOptimization(tenantId);

        return reply.status(201).send({
          data: {
            analysis,
            recommendations,
          },
        });
      } catch (error: any) {
        logger.error({ error }, 'Cost optimization failed');
        return handleError(reply, new OrionError('OPTIMIZATION_FAILED', ErrorCode.INTERNAL_ERROR))
      }
    }
  );

  // ==================== Savings History ====================

  /**
   * GET /api/v1/ai/cost/history
   * Get savings tracking history for a tenant
   */
  app.get(
    '/history',
    {
      onRequest: [
        authenticateUser,
        requirePermission({ resource: 'ai-cost', action: 'read' }),
      ],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const query = request.query as { tenantId?: string };
        const tenantId = query.tenantId || (request as any).tenantContext?.getCurrentTenant()?.tenantId || 'default';

        const history = await service.getSavingsHistory(tenantId);

        return reply.send({
          data: history,
          meta: { total: history.length },
        });
      } catch (error: any) {
        logger.error({ error }, 'Failed to get savings history');
        return handleError(reply, new OrionError('HISTORY_FETCH_FAILED', ErrorCode.INTERNAL_ERROR))
      }
    }
  );

  // ==================== Cost Summary ====================

  /**
   * GET /api/v1/ai/cost/summary
   * Get cost analysis summary for a tenant
   */
  app.get(
    '/summary',
    {
      onRequest: [
        authenticateUser,
        requirePermission({ resource: 'ai-cost', action: 'read' }),
      ],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const query = request.query as { tenantId?: string };
        const tenantId = query.tenantId || (request as any).tenantContext?.getCurrentTenant()?.tenantId || 'default';

        const analysis = service.analyzeCostSavings(tenantId);
        const totalSavings = await service.getTotalSavings(tenantId);

        return reply.send({
          data: {
            ...analysis,
            totalSavingsToDate: totalSavings,
          },
        });
      } catch (error: any) {
        logger.error({ error }, 'Failed to get cost summary');
        return handleError(reply, new OrionError('SUMMARY_FETCH_FAILED', ErrorCode.INTERNAL_ERROR))
      }
    }
  );

  // ==================== Cost Alerts ====================

  /**
   * GET /api/v1/ai/cost/alerts
   * Get cost-related alerts (high-spending opportunities, applied recommendations status)
   */
  app.get(
    '/alerts',
    {
      onRequest: [
        authenticateUser,
        requirePermission({ resource: 'ai-cost', action: 'read' }),
      ],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const query = request.query as { tenantId?: string };
        const tenantId = query.tenantId || (request as any).tenantContext?.getCurrentTenant()?.tenantId || 'default';

        const analysis = service.analyzeCostSavings(tenantId);

        // Generate alerts from high-priority opportunities
        const alerts = analysis.opportunities
          .filter((opp) => opp.estimatedMonthlySavings > 500)
          .map((opp) => ({
            type: 'high_savings_opportunity',
            category: opp.category,
            resourceName: opp.resourceName,
            estimatedMonthlySavings: opp.estimatedMonthlySavings,
            riskLevel: opp.riskLevel,
            description: opp.description,
          }));

        return reply.send({
          data: alerts,
          meta: { total: alerts.length },
        });
      } catch (error: any) {
        logger.error({ error }, 'Failed to get cost alerts');
        return handleError(reply, new OrionError('ALERTS_FETCH_FAILED', ErrorCode.INTERNAL_ERROR))
      }
    }
  );
}
