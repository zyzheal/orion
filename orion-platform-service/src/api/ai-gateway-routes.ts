/**
 * AI Gateway API Routes
 *
 * AI 服务网关，提供模型路由、降级处理、规则引擎功能
 *
 * Prefix: /api/v1/ai-gateway
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { AIGateway } from '../services/ai/AIGateway';
import { AIDegradationRouter } from '../services/ai/AIDegradationRouter';
import { RuleEngine } from '../services/ai/RuleEngine';
import { AIRequest, AIScenario } from '../services/ai/types';

interface AIRequestCreate {
  scenario: AIScenario;
  input: Record<string, unknown>;
  options?: {
    timeout?: number;
    priority?: 'high' | 'medium' | 'low';
    requireConfidence?: number;
    fallbackEnabled?: boolean;
  };
  context?: {
    userId?: string;
    tenantId?: string;
    traceId?: string;
  };
}

export default async function aiGatewayRoutes(app: FastifyInstance): Promise<void> {
  // Initialize services
  const degradationRouter = new AIDegradationRouter();
  const ruleEngine = new RuleEngine();
  const aiGateway = new AIGateway({} as any, degradationRouter);

  // Set LLM caller placeholder
  aiGateway.setLLMCaller(async (request: AIRequest) => {
    // TODO: Integrate with actual AI API (Anthropic, OpenAI, etc.)
    return {
      success: true,
      data: { content: 'AI response placeholder' },
      confidence: 0.8,
      source: 'llm',
      latency: 100,
    };
  });

  // ==================== AI Gateway Core ====================

  // POST /ai-gateway/execute - 执行 AI 请求
  app.post('/execute', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as AIRequestCreate;

    try {
      const aiRequest: AIRequest = {
        scenario: body.scenario,
        input: body.input,
        options: body.options,
        context: body.context,
      };

      const result = await aiGateway.execute(aiRequest);
      return reply.send(result);
    } catch (error: any) {
      return reply.status(500).send({
        error: 'AI_GATEWAY_ERROR',
        message: error.message,
      });
    }
  });

  // GET /ai-gateway/health/:scenario - 获取场景健康状态
  app.get('/health/:scenario', async (request: FastifyRequest, reply: FastifyReply) => {
    const { scenario } = request.params as { scenario: AIScenario };

    try {
      const health = await aiGateway.checkHealth(scenario);
      return reply.send(health);
    } catch (error: any) {
      return reply.status(500).send({
        error: 'HEALTH_CHECK_ERROR',
        message: error.message,
      });
    }
  });

  // GET /ai-gateway/health/all - 获取所有场景健康状态
  app.get('/health/all', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const health = await aiGateway.getAllHealth();
      return reply.send({ health });
    } catch (error: any) {
      return reply.status(500).send({
        error: 'HEALTH_CHECK_ERROR',
        message: error.message,
      });
    }
  });

  // GET /ai-gateway/status - 获取网关状态
  app.get('/status', async (request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      status: 'healthy',
    });
  });

  // ==================== Rule Engine ====================

  // GET /ai-gateway/rules - 获取所有规则集
  app.get('/rules', async (request: FastifyRequest, reply: FastifyReply) => {
    // RuleEngine.getRuleSet requires a scenario parameter, return all built-in rules info
    return reply.send({
      rules: {
        description: 'Built-in degradation rules for 15 AI scenarios',
        scenarios: [
          'aegis-risk-assessment',
          'auto-scheduling',
          'root-cause-diagnosis',
          'code-review',
          'test-selection',
          'changelog-generation',
          'incident-summary',
          'runbook-suggestion',
          'metric-anomaly-detection',
          'log-pattern-analysis',
          'dependency-analysis',
          'capacity-forecast',
          'sla-prediction',
          'knowledge-extraction',
          'alert-correlation',
          'automation-suggestion',
        ],
      },
    });
  });

  // GET /ai-gateway/engine/status - 获取规则引擎状态
  app.get('/engine/status', async (request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      cacheEnabled: true,
      auditEnabled: true,
    });
  });
}
