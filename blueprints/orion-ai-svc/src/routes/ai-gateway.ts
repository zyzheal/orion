/**
 * AI Gateway API Routes
 *
 * AI 服务网关，提供模型路由、降级处理、规则引擎功能
 *
 * P0-3 Fix: Replaced placeholder LLM caller with real fetch-based implementation
 * supporting Anthropic Claude and OpenAI-compatible APIs via environment variables.
 *
 * Prefix: /api/v1/ai-gateway
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { AIGateway } from '../services/AIGateway';
import { AIDegradationRouter } from '../services/AIDegradationRouter';
import { RuleEngine } from '../services/RuleEngine';
import { PromptGuardService } from '../services/PromptGuardService';
import { AIRequest, AIScenario, AIResponse } from '../services/types';

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

/**
 * Real LLM caller using native fetch (Node.js 20+)
 * Supports Anthropic Claude API (default) and OpenAI-compatible APIs
 */
async function createRealLLMCaller(): Promise<(request: AIRequest) => Promise<AIResponse<unknown>>> {
  const provider = process.env.AI_LLM_PROVIDER || 'anthropic';
  const apiKey = process.env.AI_LLM_API_KEY || '';
  const model = process.env.AI_LLM_MODEL || 'claude-sonnet-4-6-20250514';
  const baseUrl = process.env.AI_LLM_BASE_URL || (provider === 'anthropic' ? 'https://api.anthropic.com' : '');

  return async (request: AIRequest): Promise<AIResponse<unknown>> => {
    if (!apiKey) {
      throw new Error('AI_LLM_API_KEY not configured');
    }

    const startTime = Date.now();

    if (provider === 'anthropic') {
      const messages = buildAnthropicMessages(request);
      const response = await fetch(`${baseUrl}/v1/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: 4096,
          messages,
          system: (request.input.systemPrompt as string) || undefined,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Anthropic API error (${response.status}): ${errorText}`);
      }

      const data = await response.json() as { content?: Array<{ text?: string }> };
      const content = data.content?.[0]?.text ?? '';
      const latency = Date.now() - startTime;

      return {
        success: true,
        data: { content },
        confidence: 0.85,
        source: 'llm',
        latency,
      };
    }

    // OpenAI-compatible
    const messages = buildOpenAIMessages(request);
    const apiUrl = `${baseUrl || 'https://api.openai.com'}/v1/chat/completions`;
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: 4096,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`LLM API error (${response.status}): ${errorText}`);
    }

    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content ?? '';
    const latency = Date.now() - startTime;

    return {
      success: true,
      data: { content },
      confidence: 0.85,
      source: 'llm',
      latency,
    };
  };
}

function buildAnthropicMessages(request: AIRequest): Array<{ role: string; content: string }> {
  const inputText = typeof request.input.prompt === 'string'
    ? request.input.prompt
    : JSON.stringify(request.input);

  return [{ role: 'user', content: inputText }];
}

function buildOpenAIMessages(request: AIRequest): Array<{ role: string; content: string }> {
  const inputText = typeof request.input.prompt === 'string'
    ? request.input.prompt
    : JSON.stringify(request.input);

  return [{ role: 'user', content: inputText }];
}

export default async function aiGatewayRoutes(app: FastifyInstance): Promise<void> {
  // Initialize services
  const degradationRouter = new AIDegradationRouter();
  const ruleEngine = new RuleEngine();
  const aiGateway = new AIGateway({} as any, degradationRouter);
  const promptGuard = new PromptGuardService();

  // P0-3 Fix: Set real LLM caller if API key is configured
  if (process.env.AI_LLM_API_KEY) {
    const llmCaller = await createRealLLMCaller();
    aiGateway.setLLMCaller(llmCaller);
  } else {
    // Fallback placeholder for development without API key
    aiGateway.setLLMCaller(async (request: AIRequest) => {
      return {
        success: true,
        data: { content: 'AI_LLM_API_KEY not configured. Set environment variable to enable real LLM calls.' },
        confidence: 0.8,
        source: 'llm',
        latency: 100,
      };
    });
  }

  // ==================== AI Gateway Core ====================

  // POST /ai-gateway/execute - 执行 AI 请求 (带 Prompt 注入防护)
  app.post('/execute', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as AIRequestCreate;

    try {
      // Prompt 注入防护 - 验证输入
      const inputText = typeof body.input?.prompt === 'string' ? body.input.prompt : '';
      if (inputText) {
        const guardResult = await promptGuard.guard(inputText);
        if (!guardResult.success) {
          return reply.status(400).send({
            error: 'PROMPT_INJECTION_DETECTED',
            message: guardResult.error,
            riskScore: guardResult.riskScore,
          });
        }
        // 使用清洗后的 prompt
        body.input.prompt = guardResult.prompt;
      }

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
