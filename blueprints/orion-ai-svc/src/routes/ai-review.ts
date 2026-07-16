/**
 * AI Code Review API 路由注册
 *
 * 提供代码审查触发、规则管理、审查历史查询等 API 端点。
 * 路由前缀: /api/v1/ai-review
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { AIReviewController } from '../controllers/AIReviewController';
import { AIReviewService } from '../services/ai-review/AIReviewService';
import { PromptSecurity } from '../services/PromptSecurity';

let aiReviewController: AIReviewController | null = null;

/**
 * 获取或创建 AIReviewController 单例
 */
function getController(): AIReviewController {
  if (!aiReviewController) {
    const aiReviewService = new AIReviewService();
    aiReviewController = new AIReviewController(aiReviewService);
  }
  return aiReviewController;
}

export default async function aiReviewRoutes(app: FastifyInstance): Promise<void> {
  const controller = getController();

  // ==================== 审查触发 ====================

  // POST /review - 触发 PR 审查
  app.post('/review', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.reviewPR(request, reply);
  });

  // POST /review-diff - 仅审查 diff (不发布评论)
  app.post('/review-diff', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.reviewDiff(request, reply);
  });

  // ==================== 审查历史 ====================

  // GET /history - 获取审查历史
  app.get('/history', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getReviewHistory(request, reply);
  });

  // GET /history/:reviewId - 获取审查详情
  app.get('/history/:reviewId', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getReviewDetail(request, reply);
  });

  // ==================== 规则管理 ====================

  // GET /rules - 获取所有规则
  app.get('/rules', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getRules(request, reply);
  });

  // GET /rules/enabled - 获取启用的规则
  app.get('/rules/enabled', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getEnabledRules(request, reply);
  });

  // GET /rules/:ruleId - 获取单个规则
  app.get('/rules/:ruleId', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getRule(request, reply);
  });

  // POST /rules - 创建规则
  app.post('/rules', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.createRule(request, reply);
  });

  // PUT /rules/:ruleId - 更新规则
  app.put('/rules/:ruleId', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.updateRule(request, reply);
  });

  // DELETE /rules/:ruleId - 删除规则
  app.delete('/rules/:ruleId', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.deleteRule(request, reply);
  });

  // PATCH /rules/:ruleId/toggle - 启用/禁用规则
  app.patch('/rules/:ruleId/toggle', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.toggleRule(request, reply);
  });

  // ==================== 配置管理 ====================

  // GET /config - 获取配置
  app.get('/config', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getConfig(request, reply);
  });

  // PUT /config - 更新配置
  app.put('/config', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.updateConfig(request, reply);
  });

  // ==================== Prompt Security ====================

  // POST /analyze - Analyze prompt security
  app.post('/analyze', async (request: FastifyRequest, reply: FastifyReply) => {
    const { prompt } = request.body as { prompt: string };
    if (!prompt) return reply.status(400).send({ error: 'PROMPT_REQUIRED' });

    const promptSecurity = new PromptSecurity();
    const analysis = promptSecurity.analyze(prompt);
    return reply.send(analysis);
  });
}
