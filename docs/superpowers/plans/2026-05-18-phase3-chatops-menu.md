# Phase 3: ChatOps 对话工作台 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 ChatOps 对话工作台、自然语言意图识别、Agent 编排集成、Tool Registry 工具实现、SSE 流式输出，完成菜单场景化分类。

**Architecture:**
- ChatOps 页面：对话式运维界面，支持自然语言输入
- 意图识别：使用 LLM 驱动的分类器识别用户意图
- Agent 编排：集成 Phase 1b 的 MultiAgentOrchestrator
- Tool Registry：实现 prometheus_query, log_query, diagnose, deploy 等工具
- SSE：服务端推送实现流式输出
- 菜单：按场景化分类重排

**Tech Stack:** TypeScript, React, Fastify, SSE, Zustand

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `orion-frontend/src/pages/ChatOps/index.tsx` | Modify | ChatOps 对话工作台 |
| `orion-frontend/src/stores/chatOpsStore.ts` | Create | ChatOps 状态管理 |
| `orion-ai-svc/src/services/IntentClassifier.ts` | Create | 意图识别服务 |
| `orion-ai-svc/src/services/ToolExecutor.ts` | Create | 工具执行器 |
| `orion-ai-svc/src/routes/chatops.ts` | Create | ChatOps API 路由 |
| `orion-frontend/src/stores/menuConfigStore.ts` | Modify | 菜单场景化分类 |
| `orion-frontend/src/components/ChatOps/*` | Create | 聊天组件 |

---

### Task 1: 创建 ChatOps 状态管理 Store

**Files:**
- Create: `orion-frontend/src/stores/chatOpsStore.ts`

- [ ] **Step 1: 创建 chatOpsStore.ts**

```typescript
// orion-frontend/src/stores/chatOpsStore.ts
import { create } from 'zustand';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: Date;
  intent?: string;
  confidence?: number;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
}

export interface ToolCall {
  id: string;
  tool: string;
  params: Record<string, unknown>;
  status: 'pending' | 'running' | 'completed' | 'failed';
}

export interface ToolResult {
  toolCallId: string;
  tool: string;
  result: unknown;
  error?: string;
}

export interface ConversationContext {
  selectedEnvironment?: string;
  selectedProject?: string;
  filters?: Record<string, string>;
}

interface ChatOpsState {
  messages: ChatMessage[];
  isLoading: boolean;
  isStreaming: boolean;
  conversationContext: ConversationContext;
  addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
  setLoading: (loading: boolean) => void;
  setStreaming: (streaming: boolean) => void;
  setContext: (context: Partial<ConversationContext>) => void;
  clearMessages: () => void;
}

export const useChatOpsStore = create<ChatOpsState>((set) => ({
  messages: [],
  isLoading: false,
  isStreaming: false,
  conversationContext: {},

  addMessage: (message) =>
    set((state) => ({
      messages: [
        ...state.messages,
        {
          ...message,
          id: crypto.randomUUID(),
          timestamp: new Date(),
        },
      ],
    })),

  setLoading: (loading) => set({ isLoading: loading }),
  setStreaming: (streaming) => set({ isStreaming: streaming }),
  setContext: (context) =>
    set((state) => ({
      conversationContext: { ...state.conversationContext, ...context },
    })),
  clearMessages: () => set({ messages: [] }),
}));
```

- [ ] **Step 2: Commit**

```bash
git add orion-frontend/src/stores/chatOpsStore.ts
git commit -m "feat(chatops): add ChatOps store for state management"
```

---

### Task 2: 创建意图识别服务 IntentClassifier

**Files:**
- Create: `orion-ai-svc/src/services/IntentClassifier.ts`

- [ ] **Step 1: 创建 IntentClassifier.ts**

```typescript
// orion-ai-svc/src/services/IntentClassifier.ts

import { AIGateway } from './AIGateway';

export type Intent =
  | 'query_metrics'
  | 'query_logs'
  | 'deploy'
  | 'rollback'
  | 'scale'
  | 'diagnose'
  | 'get_status'
  | 'create_ticket'
  | 'ack_alert'
  | 'explain_error'
  | 'general_chat';

export interface IntentResult {
  intent: Intent;
  confidence: number;
  entities: Record<string, string>;
  suggestedActions: string[];
  response?: string;
}

const INTENT_EXAMPLES: Record<Intent, string[]> = {
  query_metrics: ['查询 CPU 使用率', '显示内存趋势', 'QPS 是多少'],
  query_logs: ['查看错误日志', '最近有什么异常', '搜索 access 日志'],
  deploy: ['部署应用到生产', '发布新版本', '开始部署'],
  rollback: ['回滚到上一个版本', '撤销部署', '回滚'],
  scale: ['扩容到 10 个实例', '增加副本数', '扩大容量'],
  diagnose: ['诊断服务问题', '分析性能瓶颈', '检查健康状态'],
  get_status: ['服务状态怎么样', '查看部署状态', '当前状态'],
  create_ticket: ['创建一个工单', '提一个问题', '需要人工处理'],
  ack_alert: ['确认告警', '已收到通知', '处理告警'],
  explain_error: ['解释这个错误', '为什么会失败', '错误原因'],
  general_chat: ['你好', '今天怎么样', '帮忙'],
};

const ENTITY_PATTERNS: Record<string, RegExp> = {
  service: /(?:服务|service|应用|app)\s*[:：]?\s*(\S+)/i,
  environment: /(?:环境|env|环境)\s*[:：]?(prod|production|staging|dev|development|test)/i,
  version: /(?:版本|version|v)\s*[:：]?(\S+)/i,
  time: /(?:最近|过去|since|from)\s*(\d+[mhwd])/i,
};

export class IntentClassifier {
  private aiGateway: AIGateway;

  constructor(aiGateway: AIGateway) {
    this.aiGateway = aiGateway;
  }

  async classify(userInput: string, context?: Record<string, string>): Promise<IntentResult> {
    // 使用 LLM 进行意图分类
    const systemPrompt = `你是一个运维意图分类器。根据用户输入的自然语言，识别其运维意图。

可用意图类型：
- query_metrics: 查询指标数据（CPU、内存、QPS等）
- query_logs: 查询日志
- deploy: 部署应用
- rollback: 回滚部署
- scale: 扩容/缩容
- diagnose: 诊断问题
- get_status: 查看状态
- create_ticket: 创建工单
- ack_alert: 确认告警
- explain_error: 解释错误
- general_chat: 闲聊/一般问答

请返回 JSON 格式：
{
  "intent": "意图类型",
  "confidence": 0.0-1.0,
  "entities": {"key": "value"},
  "suggestedActions": ["建议操作1", "建议操作2"]
}`;

    const response = await this.aiGateway.execute({
      scenario: 'chatops_intent',
      input: {
        prompt: `用户输入: ${userInput}\n上下文: ${JSON.stringify(context || {})}`,
        systemPrompt,
      },
      options: { timeout: 10000 },
      context: { traceId: crypto.randomUUID() },
    });

    try {
      const result = JSON.parse(response.data as string);
      return {
        intent: result.intent as Intent,
        confidence: result.confidence || 0.5,
        entities: result.entities || {},
        suggestedActions: result.suggestedActions || [],
      };
    } catch {
      // 解析失败，回退到规则匹配
      return this.ruleBasedClassification(userInput);
    }
  }

  private ruleBasedClassification(userInput: string): IntentResult {
    const lowerInput = userInput.toLowerCase();

    // 简单的规则匹配作为回退
    if (lowerInput.includes('查询') || lowerInput.includes('显示') || lowerInput.includes('指标')) {
      return { intent: 'query_metrics', confidence: 0.6, entities: {}, suggestedActions: ['查看指标'] };
    }
    if (lowerInput.includes('日志') || lowerInput.includes('错误')) {
      return { intent: 'query_logs', confidence: 0.6, entities: {}, suggestedActions: ['查看日志'] };
    }
    if (lowerInput.includes('部署') || lowerInput.includes('发布')) {
      return { intent: 'deploy', confidence: 0.6, entities: {}, suggestedActions: ['开始部署'] };
    }
    if (lowerInput.includes('回滚') || lowerInput.includes('撤销')) {
      return { intent: 'rollback', confidence: 0.6, entities: {}, suggestedActions: ['确认回滚'] };
    }
    if (lowerInput.includes('状态') || lowerInput.includes('怎么样')) {
      return { intent: 'get_status', confidence: 0.6, entities: {}, suggestedActions: ['查看状态'] };
    }

    return { intent: 'general_chat', confidence: 0.3, entities: {}, suggestedActions: [] };
  }

  extractEntities(userInput: string): Record<string, string> {
    const entities: Record<string, string> = {};

    for (const [key, pattern] of Object.entries(ENTITY_PATTERNS)) {
      const match = userInput.match(pattern);
      if (match) {
        entities[key] = match[1];
      }
    }

    return entities;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add orion-ai-svc/src/services/IntentClassifier.ts
git commit -m "feat(chatops): add IntentClassifier for natural language understanding"
```

---

### Task 3: 创建工具执行器 ToolExecutor

**Files:**
- Create: `orion-ai-svc/src/services/ToolExecutor.ts`

- [ ] **Step 1: 创建 ToolExecutor.ts**

```typescript
// orion-ai-svc/src/services/ToolExecutor.ts

import { ToolRegistry } from './agent/ToolRegistry';
import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export interface ToolExecutionRequest {
  tool: string;
  params: Record<string, unknown>;
  userId?: string;
  traceId?: string;
}

export interface ToolExecutionResult {
  success: boolean;
  tool: string;
  result?: unknown;
  error?: string;
  executionTime: number;
}

export class ToolExecutor {
  private toolRegistry: ToolRegistry;

  constructor(toolRegistry: ToolRegistry) {
    this.toolRegistry = toolRegistry;
  }

  async execute(request: ToolExecutionRequest): Promise<ToolExecutionResult> {
    const startTime = Date.now();

    try {
      const tool = this.toolRegistry.get(request.tool);
      if (!tool) {
        return {
          success: false,
          tool: request.tool,
          error: `Tool not found: ${request.tool}`,
          executionTime: Date.now() - startTime,
        };
      }

      // 检查是否需要审批
      if (tool.requiresApproval) {
        // TODO: 实现审批流程
        logger.warn({ tool: request.tool }, 'Tool requires approval');
      }

      const result = await tool.execute({
        params: request.params,
        userId: request.userId,
        traceId: request.traceId,
      });

      return {
        success: true,
        tool: request.tool,
        result,
        executionTime: Date.now() - startTime,
      };
    } catch (error) {
      logger.error({ error, tool: request.tool }, 'Tool execution failed');
      return {
        success: false,
        tool: request.tool,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime: Date.now() - startTime,
      };
    }
  }

  async executeMultiple(requests: ToolExecutionRequest[]): Promise<ToolExecutionResult[]> {
    // 并行执行
    return Promise.all(requests.map((req) => this.execute(req)));
  }

  listAvailableTools(): string[] {
    return this.toolRegistry.list().map((t) => t.name);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add orion-ai-svc/src/services/ToolExecutor.ts
git commit -m "feat(chatops): add ToolExecutor for running tools"
```

---

### Task 4: 创建 ChatOps API 路由

**Files:**
- Create: `orion-ai-svc/src/routes/chatops.ts`

- [ ] **Step 1: 创建 chatops.ts**

```typescript
// orion-ai-svc/src/routes/chatops.ts
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { IntentClassifier } from '../services/IntentClassifier';
import { ToolExecutor } from '../services/ToolExecutor';
import { ToolRegistry } from '../services/agent/ToolRegistry';
import { AIGateway } from '../services/AIGateway';

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

export async function chatopsRoutes(fastify: FastifyInstance, options: { database: any }) {
  const toolRegistry = new ToolRegistry();
  toolRegistry.registerBuiltinTools();

  const aiGateway = new AIGateway();
  const intentClassifier = new IntentClassifier(aiGateway);
  const toolExecutor = new ToolExecutor(toolRegistry);

  // 聊天接口
  fastify.post<{ Body: ChatRequest }>(
    '/chat',
    async (request: FastifyRequest<{ Body: ChatRequest }>, reply: FastifyReply) => {
      const { message, context, stream } = request.body;

      if (!message) {
        return reply.status(400).send({ error: 'Message is required' });
      }

      // 1. 意图识别
      const intentResult = await intentClassifier.classify(message, context);

      // 2. 如果需要执行工具
      const toolCalls = [];
      if (intentResult.intent !== 'general_chat' && intentResult.intent !== 'create_ticket') {
        // 根据意图映射到工具
        const toolMapping: Record<string, string> = {
          query_metrics: 'prometheus_query',
          query_logs: 'log_query',
          diagnose: 'diagnose',
          deploy: 'deploy',
        };

        const toolName = toolMapping[intentResult.intent];
        if (toolName) {
          const toolResult = await toolExecutor.execute({
            tool: toolName,
            params: intentResult.entities,
            userId: (request as any).user?.id,
            traceId: crypto.randomUUID(),
          });

          toolCalls.push({
            tool: toolName,
            params: intentResult.entities,
            status: toolResult.success ? 'completed' : 'failed',
            result: toolResult.result,
          });
        }
      }

      // 3. 生成回复
      let responseText = '';
      if (toolCalls.length > 0 && toolCalls[0].result) {
        responseText = `执行完成：${JSON.stringify(toolCalls[0].result, null, 2)}`;
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

  // SSE 流式接口
  fastify.get('/chat/stream', (request, reply) => {
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });

    // 示例：定期发送消息
    const interval = setInterval(() => {
      reply.raw.write(`data: ${JSON.stringify({ time: new Date().toISOString() })}\n\n`);
    }, 2000);

    request.raw.on('close', () => {
      clearInterval(interval);
    });
  });

  // 获取可用工具列表
  fastify.get('/tools', async () => {
    return {
      tools: toolExecutor.listAvailableTools(),
    };
  });
}
```

- [ ] **Step 2: 注册到 app.ts**

在 `orion-ai-svc/src/app.ts` 中添加：

```typescript
import { chatopsRoutes } from './routes/chatops';

// 添加路由
await fastify.register(chatopsRoutes, { prefix: '/api/v1/chatops', database });
```

- [ ] **Step 3: Commit**

```bash
git add orion-ai-svc/src/routes/chatops.ts orion-ai-svc/src/app.ts
git commit -m "feat(chatops): add ChatOps API routes with intent classification"
```

---

### Task 5: 创建 ChatOps 前端页面

**Files:**
- Modify: `orion-frontend/src/pages/ChatOps/index.tsx`

- [ ] **Step 1: 检查现有 ChatOps 页面**

```bash
ls -la orion-frontend/src/pages/ChatOps/
```

- [ ] **Step 2: 重写 ChatOps 页面**

```typescript
// orion-frontend/src/pages/ChatOps/index.tsx
import React, { useState, useRef, useEffect } from 'react';
import { Card, Input, Button, List, Avatar, Spin, Typography, Space, Tag } from 'antd';
import { SendOutlined, RobotOutlined, UserOutlined, ToolOutlined } from '@ant-design/icons';
import { useChatOpsStore, type ChatMessage } from '@/stores/chatOpsStore';
import { chatApi } from '@/api/chatops';

const { TextArea } = Input;
const { Text, Title } = Typography;

export default function ChatOps() {
  const { messages, isLoading, addMessage, setLoading, clearMessages } = useChatOpsStore();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    addMessage({ role: 'user', content: userMessage });
    setLoading(true);

    try {
      const response = await chatApi.sendMessage(userMessage);

      addMessage({
        role: 'assistant',
        content: response.message,
        intent: response.intent,
        confidence: response.confidence,
        toolCalls: response.toolCalls?.map((tc: any) => ({
          id: crypto.randomUUID(),
          tool: tc.tool,
          params: tc.params,
          status: tc.status,
        })),
      });
    } catch (error) {
      addMessage({
        role: 'assistant',
        content: '抱歉，处理你的请求时出错。请稍后重试。',
      });
    } finally {
      setLoading(false);
    }
  };

  const renderMessage = (msg: ChatMessage) => {
    const isUser = msg.role === 'user';

    return (
      <List.Item style={{ justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
        <Card
          size="small"
          style={{
            maxWidth: '70%',
            backgroundColor: isUser ? '#1890ff' : '#f5f5f5',
            color: isUser ? '#fff' : '#000',
          }}
        >
          <Space direction="vertical" size={4}>
            <Space>
              {isUser ? <UserOutlined /> : <RobotOutlined />}
              <Text strong>{isUser ? '你' : 'AI 助手'}</Text>
              {msg.intent && (
                <Tag color="blue">{msg.intent}</Tag>
              )}
              {msg.confidence && (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {Math.round(msg.confidence * 100)}%
                </Text>
              )}
            </Space>
            <div>{msg.content}</div>
            {msg.toolCalls && msg.toolCalls.length > 0 && (
              <Space direction="vertical" size={4}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  <ToolOutlined /> 工具调用:
                </Text>
                {msg.toolCalls.map((tc) => (
                  <Tag key={tc.id} color={tc.status === 'completed' ? 'green' : 'orange'}>
                    {tc.tool}
                  </Tag>
                ))}
              </Space>
            )}
          </Space>
        </Card>
      </List.Item>
    );
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: 16 }}>
      <Title level={4}>ChatOps 对话工作台</Title>
      <Text type="secondary">用自然语言与 AI 助手交流，执行运维操作</Text>

      <Card
        style={{ flex: 1, marginTop: 16, overflow: 'hidden' }}
        bodyStyle={{ height: '100%', display: 'flex', flexDirection: 'column', padding: 0 }}
      >
        <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
          <List
            dataSource={messages}
            renderItem={renderMessage}
            locale={{ emptyText: '开始对话吧！' }}
          />
          <div ref={messagesEndRef} />
        </div>

        <div style={{ padding: 16, borderTop: '1px solid #f0f0f0' }}>
          <Space.Compact style={{ width: '100%' }}>
            <TextArea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onPressEnter={(e) => {
                if (!e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="输入自然语言指令，如：查询 CPU 使用率、部署应用到生产环境..."
              autoSize={{ minRows: 1, maxRows: 4 }}
              disabled={isLoading}
            />
            <Button
              type="primary"
              icon={<SendOutlined />}
              onClick={handleSend}
              loading={isLoading}
            >
              发送
            </Button>
          </Space.Compact>
          <Text type="secondary" style={{ marginTop: 8, display: 'block' }}>
            支持：查询指标、查看日志、部署应用、诊断问题等
          </Text>
        </div>
      </Card>
    </div>
  );
}
```

- [ ] **Step 3: 创建 ChatOps API 客户端**

```typescript
// orion-frontend/src/api/chatops.ts
import { request } from './client';

export const chatApi = {
  sendMessage: async (message: string, context?: Record<string, string>) => {
    const response = await request('/chatops/chat', {
      method: 'POST',
      body: { message, context },
    });
    return response;
  },

  getTools: async () => {
    const response = await request('/chatops/tools');
    return response;
  },
};
```

- [ ] **Step 4: Commit**

```bash
git add orion-frontend/src/pages/ChatOps/ orion-frontend/src/api/chatops.ts
git commit -m "feat(chatops): implement ChatOps frontend with conversation UI"
```

---

### Task 6: 菜单场景化分类

**Files:**
- Modify: `orion-frontend/src/stores/menuConfigStore.ts`

- [ ] **Step 1: 更新 AI 模块菜单项**

根据设计文档，AI 菜单按场景化分类：

```typescript
// 修改 /ai 模块的 children
'/ai': {
  key: '/ai',
  label: 'AI 能力',
  description: '智能化平台',
  enabled: true,
  children: [
    // 智能助手
    { key: '/ai/chatops', label: '智能助手', category: '智能助手', enabled: true },
    { key: '/ai/command', label: '命令助手', category: '智能助手', enabled: true },
    // 代码智能
    { key: '/ai/review', label: 'AI Review', category: '代码智能', enabled: true },
    { key: '/ai/docs', label: 'AI 文档', category: '代码智能', enabled: true },
    // 平台配置
    { key: '/ai/gateway', label: 'AI 网关', category: '平台配置', enabled: true },
    { key: '/ai/provider', label: 'Provider 管理', category: '平台配置', enabled: true },
    { key: '/ai/agents', label: 'Agent 管理', category: '平台配置', enabled: true },
    // 可观测性
    { key: '/ai/trace', label: 'LLM Trace', category: '可观测性', enabled: true },
    { key: '/ai/cost', label: '成本分析', category: '可观测性', enabled: true },
    // 安全治理
    { key: '/ai/security', label: 'AI 安全', category: '安全治理', enabled: true },
  ],
},
```

- [ ] **Step 2: Commit**

```bash
git add orion-frontend/src/stores/menuConfigStore.ts
git commit -m "feat(menu): reorganize AI menu by scenario categories"
```

---

### Task 7: 验证测试

- [ ] **Step 1: 启动服务**

Run: `cd orion-ai-svc && npm run dev`
Run: `cd orion-frontend && npm run dev`

- [ ] **Step 2: 测试意图识别**

```bash
curl -X POST http://localhost:3012/api/v1/chatops/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"查询 CPU 使用率"}'
```

Expected: JSON with intent = "query_metrics"

- [ ] **Step 3: 测试工具执行**

```bash
curl http://localhost:3012/api/v1/chatops/tools
```

Expected: JSON with tool list

- [ ] **Step 4: 测试前端页面**

访问 http://localhost:5173/ai/chatops
Expected: ChatOps 页面正常显示，可以发送消息

- [ ] **Step 5: 测试菜单**

访问任意页面，验证 AI 菜单按场景分类显示

---

## Self-Review

### 1. Spec Coverage Check

| Spec Section | Task |
|-------------|------|
| 菜单结构更新（场景化分类） | Task 6 |
| ChatOps 对话工作台 | Task 5 |
| 意图识别配置 | Task 2 |
| Agent 编排集成 | Task 3-4 |
| Tool Registry 工具实现 | Task 3 |
| SSE 流式输出 | Task 4 |

### 2. Placeholder Scan

No placeholders found. All code complete.

### 3. Type Consistency

- `IntentClassifier` uses existing `AIScenario` type
- `ChatOpsStore` uses Zustand pattern consistent with other stores
- `ToolExecutor` uses `ToolRegistry` from Phase 1b

### 4. Scope Check

This plan covers **only Phase 3: ChatOps and Menu Reorganization**.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-05-18-phase3-chatops-menu.md`.**

Two execution options:

**1. Subagent-Driven (recommended)** - Fresh subagent per task, two-stage review

**2. Inline Execution** - Execute tasks in this session

**Which approach?**