/**
 * Quality Gate Trend API Routes
 *
 * Routes under /api/v1/quality-gates
 * Provides trend analysis, violation distribution, top failing policies,
 * exemption stats, and recommendations.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DatabasePool } from '../services/database';
import { QualityGateTrendService } from '../services/policy/QualityGateTrendService';
import { EventBusService } from '../services/event-bus-service';

interface QualityGateRoutesOptions {
  database?: DatabasePool;
  eventBus?: EventBusService;
}

export default async function qualityGateRoutes(
  app: FastifyInstance,
  options: QualityGateRoutesOptions
): Promise<void> {
  if (!options.database) {
    console.warn('[QualityGateRoutes] No database pool provided, quality gate routes will not be functional');
    return;
  }

  const trendService = new QualityGateTrendService(options.database);

  // ==================== Trend Analysis ====================

  app.get('/trend', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as any;
      const days = query.days ? parseInt(query.days, 10) : 30;
      const trend = await trendService.getPassRateTrend(days, query.policyId);
      return reply.send({ code: 200, message: 'OK', data: trend });
    } catch (error: any) {
      return reply.status(500).send({ code: 500, message: error.message });
    }
  });

  // ==================== Violation Distribution ====================

  app.get('/distribution', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as any;
      const days = query.days ? parseInt(query.days, 10) : 30;
      const groupBy = (query.groupBy === 'policy' ? 'policy' : 'severity') as 'severity' | 'policy';
      const distribution = await trendService.getViolationDistribution(days, groupBy);
      return reply.send({ code: 200, message: 'OK', data: distribution });
    } catch (error: any) {
      return reply.status(500).send({ code: 500, message: error.message });
    }
  });

  // ==================== Top Failing Policies ====================

  app.get('/top-failing', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as any;
      const limit = query.limit ? parseInt(query.limit, 10) : 5;
      const days = query.days ? parseInt(query.days, 10) : 30;
      const topFailing = await trendService.getTopFailingPolicies(limit, days);
      return reply.send({ code: 200, message: 'OK', data: topFailing });
    } catch (error: any) {
      return reply.status(500).send({ code: 500, message: error.message });
    }
  });

  // ==================== Exemption Statistics ====================

  app.get('/exemption-stats', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const stats = await trendService.getExemptionStats();
      return reply.send({ code: 200, message: 'OK', data: stats });
    } catch (error: any) {
      return reply.status(500).send({ code: 500, message: error.message });
    }
  });

  // ==================== Recommendations ====================

  app.get('/recommendations', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as any;
      const recommendations = await trendService.getRecommendations(query.policyId);
      return reply.send({ code: 200, message: 'OK', data: recommendations });
    } catch (error: any) {
      return reply.status(500).send({ code: 500, message: error.message });
    }
  });
}
