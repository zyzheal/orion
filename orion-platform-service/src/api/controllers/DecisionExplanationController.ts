/**
 * Decision Explanation Controller — 决策解释控制器
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import {
  DecisionExplanationService,
  DecisionFeature,
} from '../../services/ai/DecisionExplanationService';

export class DecisionExplanationController {
  private service: DecisionExplanationService;

  constructor(service: DecisionExplanationService) {
    this.service = service;
  }

  /**
   * POST /api/v1/ai-decisions/explain
   * 生成决策解释
   */
  async explain(
    request: FastifyRequest<{
      Body: {
        decisionId: string;
        decisionType: string;
        decision: 'pass' | 'fail' | 'warn' | 'manual_review';
        features: DecisionFeature[];
        confidence?: number;
        threshold?: number;
        context?: Record<string, unknown>;
      };
    }>,
    reply: FastifyReply
  ) {
    const { decisionId, decisionType, decision, features, confidence, threshold, context } =
      request.body;

    if (!decisionId || !decisionType || !decision || !features || features.length === 0) {
      return reply.status(400).send({
        error: 'BAD_REQUEST',
        message: 'decisionId, decisionType, decision, and features are required',
      });
    }

    try {
      const explanation = this.service.explainDecision({
        decisionId,
        decisionType,
        decision,
        features,
        confidence,
        threshold,
        context,
      });

      return reply.status(201).send({
        data: explanation,
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      return reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: err.message,
      });
    }
  }

  /**
   * GET /api/v1/ai-decisions/:id/feature-importance
   * 获取特征重要性
   */
  async getFeatureImportance(
    request: FastifyRequest<{
      Params: { id: string };
      Querystring: { features?: string };
    }>,
    reply: FastifyReply
  ) {
    const { features: featuresJson } = request.query;

    if (!featuresJson) {
      return reply.status(400).send({
        error: 'BAD_REQUEST',
        message: 'Query parameter "features" is required (JSON array of DecisionFeature)',
      });
    }

    try {
      const features: DecisionFeature[] = JSON.parse(featuresJson);
      if (!Array.isArray(features)) {
        throw new Error('features must be an array');
      }

      const importance = this.service.calculateFeatureImportance(features);

      return reply.send({
        data: {
          decisionId: request.params.id,
          featureImportance: importance,
        },
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      if (err.message === 'Unexpected token' || err.message.includes('JSON')) {
        return reply.status(400).send({
          error: 'BAD_REQUEST',
          message: 'Invalid JSON in features parameter',
        });
      }
      return reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: err.message,
      });
    }
  }

  /**
   * GET /api/v1/ai-decisions/confidence/:level
   * 获取置信度解释
   */
  async getConfidenceExplanation(
    request: FastifyRequest<{
      Params: { level: string };
      Querystring: { score?: string };
    }>,
    reply: FastifyReply
  ) {
    const { level } = request.params;
    const { score } = request.query;

    let confidence: number;

    // 如果提供了具体分数，使用分数
    if (score !== undefined) {
      confidence = parseFloat(score);
      if (isNaN(confidence) || confidence < 0 || confidence > 1) {
        return reply.status(400).send({
          error: 'BAD_REQUEST',
          message: 'score must be a number between 0 and 1',
        });
      }
    } else {
      // 根据 level 参数推断
      switch (level.toLowerCase()) {
        case 'high':
          confidence = 0.9;
          break;
        case 'medium':
          confidence = 0.7;
          break;
        case 'low':
          confidence = 0.5;
          break;
        case 'very_low':
          confidence = 0.2;
          break;
        default: {
          const parsed = parseFloat(level);
          if (!isNaN(parsed) && parsed >= 0 && parsed <= 1) {
            confidence = parsed;
          } else {
            return reply.status(400).send({
              error: 'BAD_REQUEST',
              message:
                'level must be one of: high, medium, low, very_low, or a numeric value between 0 and 1',
            });
          }
        }
      }
    }

    try {
      const explanation = this.service.getConfidenceExplanation(confidence);

      return reply.send({
        data: explanation,
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      return reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: err.message,
      });
    }
  }

  /**
   * GET /api/v1/ai-decisions/explanations/:id
   * 根据 ID 获取解释
   */
  async getExplanationById(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    const { id } = request.params;

    try {
      const explanation = this.service.getExplanationById(id);

      if (!explanation) {
        return reply.status(404).send({
          error: 'NOT_FOUND',
          message: `Explanation not found: ${id}`,
        });
      }

      return reply.send({
        data: explanation,
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      return reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: err.message,
      });
    }
  }

  /**
   * GET /api/v1/ai-decisions/explanations/history
   * 获取解释历史记录
   */
  async getExplanationHistory(
    request: FastifyRequest<{
      Querystring: { limit?: string; decisionType?: string };
    }>,
    reply: FastifyReply
  ) {
    const { limit, decisionType } = request.query;
    const limitNum = limit ? parseInt(limit, 10) : 50;

    try {
      const history = this.service.getExplanationHistory(limitNum, decisionType);

      return reply.send({
        data: history,
        meta: {
          total: history.length,
          limit: limitNum,
        },
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      return reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: err.message,
      });
    }
  }
}
