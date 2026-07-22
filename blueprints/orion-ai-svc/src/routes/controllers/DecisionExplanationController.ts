/**
 * DecisionExplanationController - Stub
 * Handles AI decision explanation API requests.
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { DecisionExplanationService } from '../../services/DecisionExplanationService';

export class DecisionExplanationController {
  private service: DecisionExplanationService;

  constructor(service: DecisionExplanationService) {
    this.service = service;
  }

  async explain(request: FastifyRequest, reply: FastifyReply): Promise<unknown> {
    const body = request.body as Record<string, unknown>;
    const result = this.service.explainDecision({
      decisionId: body.decisionId as string,
      decisionType: body.decisionType as string,
      decision: body.decision as 'pass' | 'fail' | 'warn' | 'manual_review',
      features: (body.features as any[]) ?? [],
      confidence: (body.confidence as number) ?? 0,
      threshold: (body.threshold as number) ?? 0.5,
      context: (body.context as Record<string, unknown>) ?? {},
    });
    return reply.send(result);
  }

  async getFeatureImportance(request: FastifyRequest, reply: FastifyReply): Promise<unknown> {
    const params = request.params as { id: string };
    return reply.send({ decisionId: params.id, features: [] });
  }

  async getConfidenceExplanation(request: FastifyRequest, reply: FastifyReply): Promise<unknown> {
    const params = request.params as { level: string };
    const query = request.query as { score?: string };
    const score = query.score ? parseFloat(query.score) : 0.8;
    return reply.send(this.service.getConfidenceExplanation(score));
  }

  async getExplanationById(request: FastifyRequest, reply: FastifyReply): Promise<unknown> {
    const params = request.params as { id: string };
    const explanation = this.service.getExplanationById(params.id);
    if (!explanation) return reply.code(404).send({ error: 'Not found' });
    return reply.send(explanation);
  }

  async getExplanationHistory(request: FastifyRequest, reply: FastifyReply): Promise<unknown> {
    const query = request.query as { limit?: string; decisionType?: string };
    const limit = query.limit ? parseInt(query.limit, 10) : 50;
    const items = this.service.getExplanationHistory(limit, query.decisionType);
    return reply.send({ items });
  }
}
