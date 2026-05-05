/**
 * AI Decision API Routes — 决策解释和模型版本管理
 *
 * 前缀: /api/v1
 *
 * 决策解释:
 *   POST   /api/v1/ai-decisions/explain              生成决策解释
 *   GET    /api/v1/ai-decisions/:id/feature-importance  特征重要性
 *   GET    /api/v1/ai-decisions/confidence/:level      置信度解释
 *
 * 模型版本:
 *   POST   /api/v1/ai-models                         注册模型
 *   GET    /api/v1/ai-models                         模型列表
 *   GET    /api/v1/ai-models/:modelId                 模型详情
 *   GET    /api/v1/ai-models/:modelName/versions       版本列表
 *   POST   /api/v1/ai-models/:modelId/activate         激活模型
 *   POST   /api/v1/ai-models/:modelId/deprecate        废弃模型
 *   GET    /api/v1/ai-models/:modelName/ab-test        A/B 测试结果
 *   GET    /api/v1/ai-models/:modelName/performance    性能概览
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DecisionExplanationService, type DecisionFeature } from '../services/ai/DecisionExplanationService';
import { ModelVersionService, type ModelRegistrationInput } from '../services/ai/ModelVersionService';
import { DecisionExplanationController } from './controllers/DecisionExplanationController';
import { ModelVersionController } from './controllers/ModelVersionController';

export interface AIDecisionRoutesOptions {
  decisionExplanationService?: DecisionExplanationService;
  modelVersionService?: ModelVersionService;
}

export default async function aiDecisionRoutes(
  app: FastifyInstance,
  options: AIDecisionRoutesOptions
): Promise<void> {
  const decisionService = options.decisionExplanationService || new DecisionExplanationService();
  const modelService = options.modelVersionService || new ModelVersionService();

  const decisionController = new DecisionExplanationController(decisionService);
  const modelController = new ModelVersionController(modelService);

  // ==================== 决策解释 ====================

  // POST /ai-decisions/explain — 生成决策解释
  app.post(
    '/ai-decisions/explain',
    async (
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
    ) => {
      return decisionController.explain(request, reply);
    }
  );

  // GET /ai-decisions/:id/feature-importance — 特征重要性
  app.get(
    '/ai-decisions/:id/feature-importance',
    async (
      request: FastifyRequest<{
        Params: { id: string };
        Querystring: { features?: string };
      }>,
      reply: FastifyReply
    ) => {
      return decisionController.getFeatureImportance(request, reply);
    }
  );

  // GET /ai-decisions/confidence/:level — 置信度解释
  app.get(
    '/ai-decisions/confidence/:level',
    async (
      request: FastifyRequest<{
        Params: { level: string };
        Querystring: { score?: string };
      }>,
      reply: FastifyReply
    ) => {
      return decisionController.getConfidenceExplanation(request, reply);
    }
  );

  // ==================== 模型版本管理 ====================

  // POST /ai-models — 注册模型
  app.post(
    '/ai-models',
    async (
      request: FastifyRequest<{ Body: ModelRegistrationInput }>,
      reply: FastifyReply
    ) => {
      return modelController.registerModel(request, reply);
    }
  );

  // GET /ai-models — 模型列表
  app.get(
    '/ai-models',
    async (
      request: FastifyRequest<{
        Querystring: {
          status?: string;
          framework?: string;
          name?: string;
        };
      }>,
      reply: FastifyReply
    ) => {
      return modelController.listModels(request, reply);
    }
  );

  // GET /ai-models/:modelId — 模型详情
  app.get(
    '/ai-models/:modelId',
    async (
      request: FastifyRequest<{ Params: { modelId: string } }>,
      reply: FastifyReply
    ) => {
      return modelController.getModelById(request, reply);
    }
  );

  // GET /ai-models/:modelName/versions — 版本列表
  app.get(
    '/ai-models/:modelName/versions',
    async (
      request: FastifyRequest<{
        Params: { modelName: string };
        Querystring: { include_deprecated?: string };
      }>,
      reply: FastifyReply
    ) => {
      return modelController.getModelVersions(request, reply);
    }
  );

  // POST /ai-models/:modelId/activate — 激活模型
  app.post(
    '/ai-models/:modelId/activate',
    async (
      request: FastifyRequest<{ Params: { modelId: string } }>,
      reply: FastifyReply
    ) => {
      return modelController.activateModel(request, reply);
    }
  );

  // POST /ai-models/:modelId/deprecate — 废弃模型
  app.post(
    '/ai-models/:modelId/deprecate',
    async (
      request: FastifyRequest<{ Params: { modelId: string } }>,
      reply: FastifyReply
    ) => {
      return modelController.deprecateModel(request, reply);
    }
  );

  // GET /ai-models/:modelName/ab-test — A/B 测试结果
  app.get(
    '/ai-models/:modelName/ab-test',
    async (
      request: FastifyRequest<{
        Params: { modelName: string };
        Querystring: { action?: string };
        Body?: any;
      }>,
      reply: FastifyReply
    ) => {
      return modelController.getABTestResults(request, reply);
    }
  );

  // GET /ai-models/:modelName/performance — 模型性能概览
  app.get(
    '/ai-models/:modelName/performance',
    async (
      request: FastifyRequest<{ Params: { modelName: string } }>,
      reply: FastifyReply
    ) => {
      return modelController.getModelPerformance(request, reply);
    }
  );

  // ==================== 解释历史 ====================

  // GET /ai-decisions/explanations/:id — 根据 ID 获取解释
  app.get(
    '/ai-decisions/explanations/:id',
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ) => {
      return decisionController.getExplanationById(request, reply);
    }
  );

  // GET /ai-decisions/explanations/history — 获取解释历史
  app.get(
    '/ai-decisions/explanations/history',
    async (
      request: FastifyRequest<{
        Querystring: { limit?: string; decisionType?: string };
      }>,
      reply: FastifyReply
    ) => {
      return decisionController.getExplanationHistory(request, reply);
    }
  );

  // POST /ai-models/:modelId/rollback — 回滚模型
  app.post(
    '/ai-models/:modelId/rollback',
    async (
      request: FastifyRequest<{
        Params: { modelId: string };
        Body?: { targetVersion?: string };
      }>,
      reply: FastifyReply
    ) => {
      return modelController.rollbackModel(request, reply);
    }
  );
}
