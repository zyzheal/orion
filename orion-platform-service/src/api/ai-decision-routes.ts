/**
 * AI Decision Routes — 决策解释路由
 *
 * 提供决策解释、模型版本管理、A/B 测试等 API 端点
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DecisionExplanationController } from './controllers/DecisionExplanationController';
import { DecisionExplanationService } from '../services/ai/DecisionExplanationService';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';

export default async function aiDecisionRoutes(
  app: FastifyInstance,
  options: { database?: any } = {}
): Promise<void> {
  // 初始化服务和控制器
  const service = new DecisionExplanationService();
  const controller = new DecisionExplanationController(service);

  // POST /api/v1/ai-decisions/explain - 生成决策解释
  app.post('/explain', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ai-decision', action: 'create' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.explain(request as any, reply);
  });

  // GET /api/v1/ai-decisions/:id/feature-importance - 获取特征重要性
  app.get('/:id/feature-importance', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getFeatureImportance(request as any, reply);
  });

  // GET /api/v1/ai-decisions/confidence/:level - 按置信度查询决策
  app.get('/confidence/:level', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getConfidenceExplanation(request as any, reply);
  });

  // GET /api/v1/ai-decisions/explanations/:id - 获取解释详情
  app.get('/explanations/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getExplanationById(request as any, reply);
  });

  // GET /api/v1/ai-decisions/explanations/history - 获取解释历史
  app.get('/explanations/history', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getExplanationHistory(request as any, reply);
  });
}
