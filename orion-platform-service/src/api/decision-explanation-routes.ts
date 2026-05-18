/**
 * AI Decision Explanation API Routes
 *
 * Provides SHAP decision explanations, quality stats, and feedback.
 * Backed by PostgreSQL (ai_decision_feedback table).
 *
 * Routes:
 *   GET    /api/v1/decisions/:id/explain          - Get decision explanation with SHAP factors
 *   POST   /api/v1/decisions/:id/feedback         - Submit decision feedback
 *   GET    /api/v1/decisions/quality/:scenario    - Get quality statistics
 *   GET    /api/v1/decisions/quality/:scenario/trend - Get quality trend
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DatabasePool } from '../services/database';
import {
  DecisionExplanationService,
  DecisionExplanationRepository,
} from '../services/decision-explanation';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';

interface DecisionExplanationRoutesOptions {
  database?: DatabasePool;
}

export default async function decisionExplanationRoutes(
  app: FastifyInstance,
  options: DecisionExplanationRoutesOptions
): Promise<void> {
  if (!options.database) {
    console.warn('[DecisionExplanationRoutes] No database pool provided, routes will not be functional');
    return;
  }

  const repository = new DecisionExplanationRepository(options.database);
  const service = new DecisionExplanationService(repository);

  // GET /api/v1/decisions/:id/explain - Get decision explanation
  app.get('/decisions/:id/explain', { onRequest: [authenticateUser, requirePermission({ resource: 'decision', action: 'read' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const explanation = await service.getExplanation(id);
      if (!explanation) {
        return reply.status(404).send({ error: 'NOT_FOUND', message: 'Decision explanation not found' });
      }
      return reply.status(200).send({ success: true, data: explanation });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'EXPLAIN_ERROR';
      return reply.status(500).send({ error: 'EXPLAIN_ERROR', message });
    }
  });

  // POST /api/v1/decisions/:id/feedback - Submit decision feedback
  app.post('/decisions/:id/feedback', { onRequest: [authenticateUser, requirePermission({ resource: 'decision', action: 'write' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as any;
      const tenantId = (request as any).tenantId || 'system';
      const feedback = await service.submitFeedback({
        tenant_id: tenantId,
        decision_id: id,
        rating: body.rating,
        comment: body.comment,
        created_by: body.created_by,
      });
      return reply.status(201).send({ success: true, data: feedback });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'FEEDBACK_ERROR';
      return reply.status(400).send({ error: 'FEEDBACK_ERROR', message });
    }
  });

  // GET /api/v1/decisions/quality/:scenario - Get quality statistics
  app.get('/decisions/quality/:scenario', { onRequest: [authenticateUser, requirePermission({ resource: 'decision', action: 'read' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { scenario } = request.params as { scenario: string };
      const days = parseInt((request.query as any)?.days) || 30;
      const stats = await service.getQualityStats(scenario, days);
      return reply.status(200).send({ success: true, data: stats });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'QUALITY_ERROR';
      return reply.status(500).send({ error: 'QUALITY_ERROR', message });
    }
  });

  // GET /api/v1/decisions/quality/:scenario/trend - Get quality trend
  app.get('/decisions/quality/:scenario/trend', { onRequest: [authenticateUser, requirePermission({ resource: 'decision', action: 'read' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { scenario } = request.params as { scenario: string };
      const days = parseInt((request.query as any)?.days) || 30;
      const trend = await service.getQualityTrend(scenario, days);
      return reply.status(200).send({ success: true, data: trend.data });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'TREND_ERROR';
      return reply.status(500).send({ error: 'TREND_ERROR', message });
    }
  });
}
