/**
 * AI Code Review Controller
 *
 * 处理 /api/v1/ai-review 下的所有请求。
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { AIReviewService } from '../../../services/ai-review/AIReviewService';
import {
  ReviewRequest,
  ReviewHistoryQuery,
  RuleCreateRequest,
  RuleUpdateRequest,
} from '../../../services/ai-review/types';

export class AIReviewController {
  private aiReviewService: AIReviewService;

  constructor(aiReviewService: AIReviewService) {
    this.aiReviewService = aiReviewService;
  }

  /**
   * 触发 PR 审查
   * POST /api/v1/ai-review/review
   */
  async reviewPR(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const body = request.body as any || {};
      const { prId, repoId, diff, repoType, context } = body;

      if (!prId || !repoId || !diff) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          code: '40001',
          message: 'Missing required fields: prId, repoId, diff',
        });
        return;
      }

      const reviewRequest: ReviewRequest = {
        prId,
        repoId,
        diff,
        repoType,
        context,
      };

      const response = await this.aiReviewService.reviewPR(reviewRequest);

      if (response.success) {
        await reply.status(200).send({
          success: true,
          data: response.result,
        });
      } else {
        await reply.status(500).send({
          error: 'REVIEW_FAILED',
          code: '50001',
          message: response.error,
        });
      }
    } catch (error) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: '50000',
        message: error instanceof Error ? error.message : 'Failed to review PR',
      });
    }
  }

  /**
   * 仅审查 diff (不发布评论)
   * POST /api/v1/ai-review/review-diff
   */
  async reviewDiff(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const body = request.body as any || {};
      const { diff, prId } = body;

      if (!diff) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          code: '40001',
          message: 'Missing required field: diff',
        });
        return;
      }

      const result = this.aiReviewService.reviewDiff(diff, prId);

      await reply.status(200).send({
        success: true,
        data: result,
      });
    } catch (error) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: '50000',
        message: error instanceof Error ? error.message : 'Failed to review diff',
      });
    }
  }

  /**
   * 获取审查历史
   * GET /api/v1/ai-review/history
   */
  async getReviewHistory(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const query = request.query as any || {};
      const historyQuery: ReviewHistoryQuery = {
        repoId: query.repoId,
        prId: query.prId,
        status: query.status,
        page: query.page ? parseInt(query.page, 10) : undefined,
        perPage: query.perPage ? parseInt(query.perPage, 10) : undefined,
      };

      const history = this.aiReviewService.getReviewHistory(historyQuery);

      await reply.status(200).send({
        success: true,
        data: history,
      });
    } catch (error) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: '50000',
        message: error instanceof Error ? error.message : 'Failed to get review history',
      });
    }
  }

  /**
   * 获取审查详情
   * GET /api/v1/ai-review/history/:reviewId
   */
  async getReviewDetail(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const { reviewId } = request.params as any;

      if (!reviewId) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          code: '40001',
          message: 'Missing reviewId',
        });
        return;
      }

      const detail = this.aiReviewService.getReviewDetail(reviewId);

      if (!detail) {
        await reply.status(404).send({
          error: 'NOT_FOUND',
          code: '40401',
          message: 'Review not found',
        });
        return;
      }

      await reply.status(200).send({
        success: true,
        data: detail,
      });
    } catch (error) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: '50000',
        message: error instanceof Error ? error.message : 'Failed to get review detail',
      });
    }
  }

  /**
   * 获取所有规则
   * GET /api/v1/ai-review/rules
   */
  async getRules(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const rules = this.aiReviewService.getRules();

      await reply.status(200).send({
        success: true,
        data: rules,
      });
    } catch (error) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: '50000',
        message: error instanceof Error ? error.message : 'Failed to get rules',
      });
    }
  }

  /**
   * 获取启用的规则
   * GET /api/v1/ai-review/rules/enabled
   */
  async getEnabledRules(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const rules = this.aiReviewService.getEnabledRules();

      await reply.status(200).send({
        success: true,
        data: rules,
      });
    } catch (error) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: '50000',
        message: error instanceof Error ? error.message : 'Failed to get enabled rules',
      });
    }
  }

  /**
   * 获取单个规则
   * GET /api/v1/ai-review/rules/:ruleId
   */
  async getRule(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const { ruleId } = request.params as any;

      if (!ruleId) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          code: '40001',
          message: 'Missing ruleId',
        });
        return;
      }

      const rule = this.aiReviewService.getRule(ruleId);

      if (!rule) {
        await reply.status(404).send({
          error: 'NOT_FOUND',
          code: '40401',
          message: 'Rule not found',
        });
        return;
      }

      await reply.status(200).send({
        success: true,
        data: rule,
      });
    } catch (error) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: '50000',
        message: error instanceof Error ? error.message : 'Failed to get rule',
      });
    }
  }

  /**
   * 创建规则
   * POST /api/v1/ai-review/rules
   */
  async createRule(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const body = request.body as any || {};
      const { name, category, severity, pattern, description, suggestion, fileExtensions } = body;

      if (!name || !category || !severity || !pattern || !description) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          code: '40001',
          message: 'Missing required fields: name, category, severity, pattern, description',
        });
        return;
      }

      const ruleRequest: RuleCreateRequest = {
        name,
        category,
        severity,
        pattern,
        description,
        suggestion,
        fileExtensions,
      };

      const rule = this.aiReviewService.createRule(ruleRequest);

      await reply.status(201).send({
        success: true,
        data: rule,
      });
    } catch (error) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: '50000',
        message: error instanceof Error ? error.message : 'Failed to create rule',
      });
    }
  }

  /**
   * 更新规则
   * PUT /api/v1/ai-review/rules/:ruleId
   */
  async updateRule(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const { ruleId } = request.params as any;

      if (!ruleId) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          code: '40001',
          message: 'Missing ruleId',
        });
        return;
      }

      const body = request.body as any || {};
      const updateRequest: RuleUpdateRequest = body;

      const rule = this.aiReviewService.updateRule(ruleId, updateRequest);

      if (!rule) {
        await reply.status(404).send({
          error: 'NOT_FOUND',
          code: '40401',
          message: 'Rule not found',
        });
        return;
      }

      await reply.status(200).send({
        success: true,
        data: rule,
      });
    } catch (error) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: '50000',
        message: error instanceof Error ? error.message : 'Failed to update rule',
      });
    }
  }

  /**
   * 删除规则
   * DELETE /api/v1/ai-review/rules/:ruleId
   */
  async deleteRule(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const { ruleId } = request.params as any;

      if (!ruleId) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          code: '40001',
          message: 'Missing ruleId',
        });
        return;
      }

      const deleted = this.aiReviewService.deleteRule(ruleId);

      if (!deleted) {
        await reply.status(404).send({
          error: 'NOT_FOUND',
          code: '40401',
          message: 'Rule not found',
        });
        return;
      }

      await reply.status(200).send({
        success: true,
        message: 'Rule deleted',
      });
    } catch (error) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: '50000',
        message: error instanceof Error ? error.message : 'Failed to delete rule',
      });
    }
  }

  /**
   * 启用/禁用规则
   * PATCH /api/v1/ai-review/rules/:ruleId/toggle
   */
  async toggleRule(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const { ruleId } = request.params as any;
      const body = request.body as any || {};

      if (!ruleId) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          code: '40001',
          message: 'Missing ruleId',
        });
        return;
      }

      if (typeof body.enabled !== 'boolean') {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          code: '40001',
          message: 'Missing required field: enabled (boolean)',
        });
        return;
      }

      const rule = this.aiReviewService.toggleRule(ruleId, body.enabled);

      if (!rule) {
        await reply.status(404).send({
          error: 'NOT_FOUND',
          code: '40401',
          message: 'Rule not found',
        });
        return;
      }

      await reply.status(200).send({
        success: true,
        data: rule,
      });
    } catch (error) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: '50000',
        message: error instanceof Error ? error.message : 'Failed to toggle rule',
      });
    }
  }

  /**
   * 获取配置
   * GET /api/v1/ai-review/config
   */
  async getConfig(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const config = this.aiReviewService.getConfig();

      await reply.status(200).send({
        success: true,
        data: config,
      });
    } catch (error) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: '50000',
        message: error instanceof Error ? error.message : 'Failed to get config',
      });
    }
  }

  /**
   * 更新配置
   * PUT /api/v1/ai-review/config
   */
  async updateConfig(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const body = request.body as any || {};
      const config = this.aiReviewService.updateConfig(body);

      await reply.status(200).send({
        success: true,
        data: config,
      });
    } catch (error) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: '50000',
        message: error instanceof Error ? error.message : 'Failed to update config',
      });
    }
  }
}
