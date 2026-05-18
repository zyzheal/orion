// orion-ai-svc/src/routes/chatops.ts
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { AIGateway } from '../services/AIGateway';
import { AIDegradationRouter } from '../services/AIDegradationRouter';
import { IntentClassifier } from '../services/IntentClassifier';
import { ToolExecutor } from '../services/ToolExecutor';
import { ToolRegistry } from '../services/agent/ToolRegistry';
import { AIRequest, AIResponse } from '../services/types';

interface ChatRequest {
  message: string;
  context?: Record<string, string>;
  stream?: boolean;
}

interface ChatResponse {
  message: string;
  intent: string;
  confidence: number;
  toolCalls?: Array<{
    tool: string;
    params: Record<string, unknown>;
    status: string;
    result?: unknown;
  }>;
  suggestions?: string[];
}

/**
 * Create real LLM caller for ChatOps (same pattern as ai-gateway)
 */
async function createLLMCaller(): Promise<(request: AIRequest) => Promise<AIResponse<unknown>>> {
  const provider = process.env.AI_LLM_PROVIDER || 'anthropic';
  const apiKey = process.env.AI_LLM_API_KEY || '';
  const model = process.env.AI_LLM_MODEL || 'claude-sonnet-4-6-20250514';
  const baseUrl = process.env.AI_LLM_BASE_URL || (provider === 'anthropic' ? 'https://api.anthropic.com' : '');

  return async (request: AIRequest): Promise<AIResponse<unknown>> => {
    if (!apiKey) {
      return {
        success: true,
        data: { content: 'AI_LLM_API_KEY not configured. Set environment variable to enable real LLM calls.' },
        confidence: 0.5,
        source: 'llm',
        latency: 50,
      };
    }

    const startTime = Date.now();
    const inputText = typeof request.input.prompt === 'string' ? request.input.prompt : JSON.stringify(request.input);
    const systemPrompt = (request.input.systemPrompt as string) || undefined;

    if (provider === 'anthropic') {
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
          messages: [{ role: 'user', content: inputText }],
          system: systemPrompt,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Anthropic API error (${response.status}): ${errorText}`);
      }

      const data = await response.json() as { content?: Array<{ text?: string }> };
      const content = data.content?.[0]?.text ?? '';
      return {
        success: true,
        data: { content },
        confidence: 0.85,
        source: 'llm',
        latency: Date.now() - startTime,
      };
    }

    const apiUrl = `${baseUrl || 'https://api.openai.com'}/v1/chat/completions`;
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: inputText }],
        max_tokens: 4096,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`LLM API error (${response.status}): ${errorText}`);
    }

    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content ?? '';
    return {
      success: true,
      data: { content },
      confidence: 0.85,
      source: 'llm',
      latency: Date.now() - startTime,
    };
  };
}

const INTENT_TOOL_MAP: Record<string, string> = {
  query_metrics: 'prometheus_query',
  query_logs: 'log_query',
  diagnose: 'diagnose',
  get_status: 'prometheus_query',
};

export async function chatopsRoutes(fastify: FastifyInstance, options: any): Promise<void> {
  const toolRegistry = new ToolRegistry();
  toolRegistry.registerBuiltinTools();

  const degradationRouter = new AIDegradationRouter();
  const aiGateway = new AIGateway({}, degradationRouter);
  const intentClassifier = new IntentClassifier(aiGateway);
  const toolExecutor = new ToolExecutor(toolRegistry);

  // Set up LLM caller
  if (process.env.AI_LLM_API_KEY) {
    const llmCaller = await createLLMCaller();
    aiGateway.setLLMCaller(llmCaller);
  }

  // POST /chat - 聊天接口
  fastify.post<{ Body: ChatRequest }>(
    '/chat',
    async (request: FastifyRequest<{ Body: ChatRequest }>, reply: FastifyReply) => {
      const { message, context, stream } = request.body;

      if (!message) {
        return reply.status(400).send({ error: 'Message is required' });
      }

      // 1. 意图识别
      const intentResult = await intentClassifier.classify(message, context);

      // 2. 根据意图执行工具
      const toolCalls = [];
      const toolName = INTENT_TOOL_MAP[intentResult.intent];
      if (toolName) {
        const toolResult = await toolExecutor.execute({
          tool: toolName,
          params: { ...intentResult.entities, query: message },
          userId: (request as any).user?.id,
          traceId: crypto.randomUUID(),
        });

        if (toolResult.success) {
          toolCalls.push({
            tool: toolName,
            params: intentResult.entities,
            status: 'completed',
            result: toolResult.result,
          });
        }
      }

      // 3. 生成回复
      let responseText = '';
      if (toolCalls.length > 0) {
        const lastResult = toolCalls[toolCalls.length - 1];
        responseText = `已执行 ${lastResult.tool}：${JSON.stringify(lastResult.result, null, 2)}`;
      } else if (intentResult.intent === 'general_chat') {
        responseText = '你好！我是 Orion AI 助手，可以用自然语言帮你执行运维操作。试试："查询 CPU 使用率" 或 "部署应用到生产"。';
      } else if (intentResult.suggestedActions.length > 0) {
        responseText = `我理解你的意图是"${intentResult.intent}"。建议操作：${intentResult.suggestedActions.join(', ')}`;
      } else {
        responseText = '我明白你的需求了。请问具体需要我做什么？';
      }

      const response: ChatResponse = {
        message: responseText,
        intent: intentResult.intent,
        confidence: intentResult.confidence,
        toolCalls,
        suggestions: intentResult.suggestedActions,
      };

      return reply.send(response);
    }
  );

  // GET /chat/stream - SSE 流式接口
  fastify.get('/chat/stream', async (request: FastifyRequest, reply: FastifyReply) => {
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });

    const interval = setInterval(() => {
      reply.raw.write(`data: ${JSON.stringify({ time: new Date().toISOString(), status: 'streaming' })}\n\n`);
    }, 2000);

    request.raw.on('close', () => {
      clearInterval(interval);
    });
  });

  // GET /tools - 获取可用工具列表
  fastify.get('/tools', async (request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      tools: toolExecutor.listAvailableTools().map((name) => {
        const tool = toolRegistry.get(name);
        return tool ? {
          name: tool.name,
          version: tool.version,
          description: tool.description,
          parameters: tool.parameters,
          requiresApproval: tool.requiresApproval,
        } : { name };
      }),
    });
  });
}
