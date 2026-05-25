# Orion 统一规范汇总

> 版本: v3.1 | 创建日期: 2026-05-22 | 最后更新: 2026-05-23 | 状态: 大厂级规范完善中（最终完整版）
> 目的: 总结系统核心规范，便于理解与本地改造，达到企业级大厂标准
> 评审: v3.0 新增数据库事务隔离级别、告警通知渠道配置、告警升级策略、备份恢复工具命令
> v3.1 修复：错误码全面统一（字符串格式）、Design Token 完整覆盖、API 客户端与实际代码对齐、Token 迁移状态标注、wujie→Orion-MF 迁移、服务端口校准、已知缺口代码引用清理

---

## 一、系统概述

### 1.1 平台定位

Orion 是 **AI 驱动的 DevOps 平台**，核心主张：「不替代现有工具链，而是让现有工具链变聪明」。平台集成 Tekton、Knative、Prometheus、K8s 而非替换它们。

### 1.2 关键数据 (2026-05-21)

| 维度 | 数量 | 说明 |
|------|------|------|
| 模块数 | 44+ | 涵盖效能、流水线、审批、安全、AI、部署等 |
| 设计文档 | ~466 份 | 27 个分类目录，约 170,000 行 |
| 后端服务目录 | 101 个 | `orion-platform-service/src/services/` |
| 实质服务 | 73 个 | 3+ 源码文件的实质服务 |
| 前端页面 | 149 个 | `orion-frontend/src/pages/` |
| API 客户端 | 101 个 | `orion-frontend/src/api/` |
| 后端路由 | 104 个 | `orion-platform-service/src/api/*-routes.ts` |
| 数据库迁移 | 207 个 | PostgreSQL Schema 演进 |

### 1.3 技术栈

```
┌─────────────────────────────────────────────────────────┐
│  前端层 (React 18 + Vite + Ant Design 5 + Orion-MF)      │
│  - 状态管理: Zustand                                    │
│  - 微前端: Orion-MF (Shadow DOM 隔离)                   │
│  - 149 页面, 101 API 客户端                             │
├─────────────────────────────────────────────────────────┤
│  网关层 (orion-api-gateway)                            │
│  - Fastify + http-proxy                                │
│  - 认证代理 / 限流 / 路由转发                           │
├─────────────────────────────────────────────────────────┤
│  核心服务层 (orion-platform-service)                   │
│  - Node.js + TypeScript + Fastify                      │
│  - 48 路由 → 42 控制器 → 70+ 服务 → 92 Repository       │
├─────────────────────────────────────────────────────────┤
│  独立微服务层 (34 个 orion-*-svc)                      │
│  - 7 个 P0 完整实现 (ticket, finops, code, plugin...)  │
│  - 2 个 Python 服务 (ai-service, knowledge)            │
│  - 2 个 Java 服务 (visor, dba)                         │
├─────────────────────────────────────────────────────────┤
│  基础设施层                                             │
│  - PostgreSQL (Repository 模式，30+ 服务已迁移)         │
│  - Redis (缓存/Token/会话)                             │
│  - NATS JetStream (事件总线，可选)                     │
└─────────────────────────────────────────────────────────┘
```

---

## 二、架构规范

### 2.0 模块依赖约束

> 定义模块间的依赖方向，防止循环依赖，为未来可能的服务拆分做准备。

**核心域 vs 支撑域划分**：

| 分类 | 模块 | 说明 |
|------|------|------|
| **核心域** | Pipeline 引擎、构建环境、多工具链、代码管理、配置管理、智能部署 | 高频迭代，直接面向研发流程 |
| **支撑域** | AI 增强、效能洞察、FinOps、CMDB、运维治理、工单协同、自愈引擎、知识管理、ChatOps | 按需迭代，能力增强 |
| **平台基础** | 认证授权、多租户、审计日志、通知、事件总线、用户/角色 | 跨域通用能力 |

**依赖规则**：

| 规则 | 说明 | 示例 |
|------|------|------|
| 规则 1 | 核心域 → 支撑域（允许） | PipelineEngine → MonitoringService |
| 规则 2 | 支撑域 → 核心域（仅事件订阅，禁止同步调用） | FinOpsService 订阅 PipelineEvent |
| 规则 3 | 支撑域 ↔ 支撑域（禁止直接调用） | 通过事件总线中转 |
| 规则 4 | 所有域 → 平台基础（允许） | 认证、租户、审计 |

### 2.1 五层架构模型

```
Layer 1: 平台基础层 (Platform Foundation) — 最底层，提供平台运行基础
  - 认证授权: authMiddleware, roleGuard
  - 租户隔离: TenantIsolationService, RLS
  - 审计日志: AuditService
  - 通知服务: NotificationService
  - 事件总线: EventBus (NATS JetStream)
  - 错误处理: errors/, ErrorHandler

Layer 2: 基础设施层 (Infrastructure) — 构建在平台基础之上
  - PostgreSQL (Repository 模式, 207 migrations)
  - Redis (缓存/Token/会话)
  - 日志: ELK/Loki 聚合
  - 监控: Prometheus + Grafana
  - 链路追踪: Jaeger

Layer 3: 服务层 (Services) — 业务逻辑与编排
  - Pipeline 引擎: PipelineEngine → StageExecutor → TaskRunner
  - Saga 编排: SagaCoordinator, PipelineSaga
  - AI 服务、FinOps、工单、通知等 70+ 服务

Layer 4: 网关层 (Gateway) — API 入口与流量管理
  - Fastify + http-proxy
  - 认证代理 / 限流 / 路由转发

Layer 5: 客户端层 (Client) — 用户界面与交互
  - React 18 + Vite + Ant Design 5
  - 微前端 (orion-mf)、149 页面、101 API 客户端
```

### 2.2 数据流模式

**标准请求流**：
```
Request → Gateway → Route → Controller → Service → Repository → PostgreSQL
                          ↓
                    RedisCache
                          ↓
                EventBus → NATS → 订阅服务 (异步)
```

**实时推送流 (SSE)**：
```
PipelineService → SSE Controller → Frontend (text/event-stream)
```

**实时通信流 (WebSocket)**：
```
WebSocket Server → Channel Manager → Subscribed Clients
```

**微前端流**：
```
Orion-MF (主应用) ↔ 子应用 (Shadow DOM 隔离) via loadSubApp/props/events
```

### 2.3 可观测性架构

| 能力 | 工具 | 说明 |
|------|------|------|
| 日志聚合 | ELK/Loki | 结构化日志 + 全文检索 |
| 指标采集 | Prometheus | QPS、延迟、错误率 |
| 链路追踪 | Jaeger | 分布式追踪 |
| 告警通知 | AlertManager | 多渠道通知 |

**核心监控指标**：

| 指标 | 警告阈值 | 严重阈值 |
|------|----------|----------|
| 错误率 | >1% | >5% |
| P99 延迟 | >2s | >5s |
| 可用率 | <99.9% | <99% |

**Prometheus 采集配置**：
```yaml
# prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'orion-platform-service'
    static_configs:
      - targets: ['localhost:3001']
    metrics_path: '/metrics'
    scrape_interval: 10s
    relabel_configs:
      - source_labels: [__address__]
        target_label: instance
        regex: '(.*):(\\d+)'
        replacement: '${1}'

  - job_name: 'orion-api-gateway'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/metrics'

  - job_name: 'node-exporter'
    static_configs:
      - targets: ['localhost:9100']

  - job_name: 'postgres-exporter'
    static_configs:
      - targets: ['localhost:9187']
```

**Metrics 端点实现**：
```typescript
// 安装 prom-client
import { Registry, Counter, Histogram, collectDefaultMetrics } from 'prom-client';

const register = new Registry();
collectDefaultMetrics({ register });

// 自定义指标
const httpRequestsTotal = new Counter({
  name: 'orion_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'path', 'status'],
  registers: [register],
});

const httpRequestDuration = new Histogram({
  name: 'orion_http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'path', 'status'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  registers: [register],
});

// 注册路由
app.get('/metrics', async (request, reply) => {
  reply.header('Content-Type', register.contentType);
  return register.metrics();
});
```

**日志聚合配置（Loki）**：
```yaml
# loki-config.yaml
auth_enabled: false

server:
  http_listen_port: 3100
  grpc_listen_port: 9096

common:
  path_prefix: /loki
  storage:
    filesystem:
      chunks_directory: /loki/chunks
      rules_directory: /loki/rules
  replication_factor: 1
  ring:
    instance_addr: 127.0.0.1
    kvstore:
      store: inmemory

schema_config:
  configs:
    - from: 2026-01-01
      store: boltdb-shipper
      object_store: filesystem
      schema: v11
      index:
        prefix: index_
        period: 24h

limits_config:
  reject_old_samples: true
  reject_old_samples_max_age: 168h
  max_entries_limit_per_query: 5000
```

**日志采集配置（Fluent Bit）**：
```yaml
# fluent-bit.conf
[SERVICE]
    Flush        5
    Daemon       Off
    Log_Level    info

[INPUT]
    Name         tail
    Path         /var/log/orion/*.log
    Parser       json
    Tag          orion.*

[FILTER]
    Name         record_modifier
    Match        orion.*
    Record       hostname ${HOSTNAME}
    Record       service orion-platform-service

[OUTPUT]
    Name         loki
    Match        orion.*
    Url          http://loki:3100
    Labels       job=orion-platform-service
    Auto_Kubernetes_Labels on
```

**链路追踪配置（OpenTelemetry + Jaeger）**：
```typescript
// OpenTelemetry 埋点示例
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';

const sdk = new NodeSDK({
  serviceName: 'orion-platform-service',
  traceExporter: new JaegerExporter({
    endpoint: 'http://jaeger:14268/api/traces',
  }),
});

sdk.start();

// 业务代码中使用
const tracer = trace.getTracer('orion-pipeline-service');

async function tracedOperation(spanName: string, operation: () => Promise<any>) {
  return tracer.startActiveSpan(spanName, async (span) => {
    try {
      const result = await operation();
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
      span.recordException(error);
      throw error;
    } finally {
      span.end();
    }
  });
}
```

**链路传播配置**：
```typescript
// W3C Trace Context 传播
import { W3CTraceContextPropagator } from '@opentelemetry/propagator-tracecontext';

const propagator = new W3CTraceContextPropagator();

// HTTP 请求传播
const carrier = {};
propagator.inject(
  trace.getSpan(context) as Span,
  carrier,
  (span, key, value) => (carrier[key] = value)
);

// 接收端提取
const extractedContext = propagator.extract(
  ROOT_CONTEXT,
  carrier,
  (carrier, key) => carrier[key]
);
```

### 2.4 熔断降级规范

**熔断器状态**：
| 状态 | 说明 | 触发条件 |
|------|------|----------|
| Closed | 正常状态 | - |
| Open | 熔断中 | 失败率超过阈值，持续一段时间 |
| Half-Open | 半开尝试 | 熔断超时后，允许少量请求通过 |

**熔断配置**：
```yaml
circuitBreaker:
  failureThreshold: 50%    # 失败率阈值
  successThreshold: 2      # 成功后关闭熔断所需成功次数
  timeout: 30s             # 熔断持续时间
  halfOpenRequests: 3      # 半开状态允许的请求数
```

**熔断器实现示例**：
```typescript
// 使用 Node.js opossum 库
import CircuitBreaker from 'opossum';

const breaker = new CircuitBreaker(externalServiceCall, {
  timeout: 3000,                    // 请求超时 3s
  errorThresholdPercentage: 50,     // 失败率 50% 触发熔断
  resetTimeout: 30000,              // 30s 后尝试恢复
  volumeThreshold: 10               // 至少 10 次请求后才触发
});

// 熔断状态监控
breaker.on('open', () => {
  metrics.increment('circuit_breaker.open');
  logger.warn('Circuit breaker opened');
});

breaker.on('halfOpen', () => {
  metrics.increment('circuit_breaker.half_open');
});

breaker.on('close', () => {
  metrics.increment('circuit_breaker.close');
  logger.info('Circuit breaker closed');
});

// 使用方式
try {
  const result = await breaker.fire(args);
} catch (error) {
  // 熔断打开时返回降级响应
  return fallbackResponse;
}
```

**限流实现（Token Bucket）**：
```typescript
// 使用 @fastify/rate-limit
import rateLimit from '@fastify/rate-limit';

await app.register(rateLimit, {
  global: false,  // 按需启用
  redis: redisClient,
  keyGenerator: (request) => {
    const userId = request.headers['x-user-id'];
    const clientIp = request.ip;
    return `${userId}:${clientIp}`;
  },
  max: 100,           // 每时间窗口最大请求数
  timeWindow: '1 minute',
  allowList: ['/healthz', '/api/v1/public/*'],
  errorResponseBuilder: (request, context) => ({
    code: 'CLIENT.429.001',
    message: '请求过于频繁，请稍后再试',
    error: 'RATE_LIMIT_EXCEEDED',
    meta: {
      retryAfter: context.after,
      limit: context.max,
      remaining: context.remaining
    }
  })
});
```

**降级策略**：
| 场景 | 降级方案 | 返回内容 |
|------|----------|----------|
| 核心服务不可用 | 返回缓存数据 | 旧数据 + "数据可能不是最新" |
| 非核心服务不可用 | 返回空列表 | [] + 提示信息 |
| 第三方调用超时 | 降级为本地处理 | 本地缓存/默认值 |
| 数据库不可用 | 拒绝写入 | 返回友好错误提示 |

**舱壁模式**：
- 核心服务使用独立线程池
- 非核心服务使用共享线程池
- 线程池配置：核心线程数、最大线程数、队列长度

### 2.5 服务注册与发现

**服务注册**：
```yaml
# 服务启动时向注册中心注册
service:
  name: orion-pipeline-svc
  version: 1.0.0
  port: 3001
  healthCheck:
    path: /healthz
    interval: 10s
  metadata:
    zone: primary
    weight: 100
```

**服务发现**：
- 使用 Nacos/Consul 作为注册中心
- 客户端通过服务名发现实例
- 支持负载均衡策略（轮询/随机/权重）

**心跳保活**：
- 每 5 秒发送心跳
- 连续 3 次心跳失败则视为不健康
- 不健康实例自动从列表移除

### 2.6 配置中心规范

**配置管理**：
```yaml
# 使用 Nacos Config / Apollo
config:
  namespace: public / application
  format: yaml / properties / json
  watch: 支持配置变更推送
  version: 支持版本管理与回滚
```

**配置分类**：
| 类型 | 示例 | 刷新方式 |
|------|------|----------|
| 运行时配置 | 限流阈值、功能开关 | 热更新 |
| 启动配置 | 数据库连接、Redis地址 | 需重启 |
| 敏感配置 | AK/SK、数据库密码 | 需重启/手动更新 |

### 2.7 AI/LLM/Agent 开发接入规范

#### 一、LLM 接入规范

**模型选型**：
| 场景 | 推荐模型 | 说明 |
|------|----------|------|
| 代码审查 | GPT-4 / Claude-3-Opus | 高理解能力 |
| 自然语言生成 | GPT-4 / Claude-3-Sonnet | 平衡成本与效果 |
| 快速响应 | GPT-3.5-Turbo | 低延迟场景 |
| 向量 embedding | text-embedding-3-large | 高质量向量 |

**LLM 客户端封装**：
```typescript
// services/ai/clients/base.client.ts
interface LLMClient {
  complete(prompt: string, options?: LLMOptions): Promise<LLMResponse>;
  stream(prompt: string, options?: LLMOptions): AsyncIterable<LLMChunk>;
}

interface LLMOptions {
  model: string;
  temperature?: number;        // 0-2，控制随机性
  maxTokens?: number;          // 最大生成 token 数
  topP?: number;               // 核采样参数
  stop?: string[];             // 停止词
  responseFormat?: 'json' | 'text';
}

interface LLMResponse {
  content: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason: 'stop' | 'length' | 'content_filter';
}
```

**多模型切换**：
```typescript
class LLMService {
  private clients: Map<string, LLMClient>;

  async complete(prompt: string, options: LLMOptions): Promise<LLMResponse> {
    const client = this.clients.get(options.model);
    if (!client) {
      throw new Error(`Model ${options.model} not supported`);
    }
    return client.complete(prompt, options);
  }

  // 降级策略
  async completeWithFallback(prompt: string, options: LLMOptions): Promise<LLMResponse> {
    try {
      return await this.complete(prompt, options);
    } catch (error) {
      // 降级到轻量模型
      if (options.model.includes('opus')) {
        return this.complete(prompt, { ...options, model: 'gpt-3.5-turbo' });
      }
      throw error;
    }
  }
}
```

#### 二、Prompt 工程规范

**Prompt 模板结构**：
```typescript
interface PromptTemplate {
  // 模板元数据
  name: string;
  version: string;
  description: string;

  // 模板内容
  systemPrompt: string;    // 系统指令
  userPrompt: string;      // 用户输入模板

  // 示例（Few-shot）
  examples?: Example[];

  // 输出约束
  outputSchema?: ZodSchema;

  // 使用参数
  parameters?: {
    name: string;
    type: string;
    required: boolean;
    description: string;
  }[];
}

interface Example {
  input: string;
  output: string;
  reasoning?: string;  // CoT 示例
}
```

**Prompt 模板示例**：
```typescript
const pipelineReviewPrompt: PromptTemplate = {
  name: 'pipeline-code-review',
  version: '1.0.0',
  description: '流水线代码审查',

  systemPrompt: `你是一个专业的 DevOps 工程师，负责审查流水线代码。
请从以下维度进行审查：
1. 安全性：是否存在敏感信息泄露风险
2. 性能：是否存在性能问题
3. 可维护性：代码是否清晰易懂
4. 最佳实践：是否符合流水线设计规范`,

  userPrompt: `请审查以下流水线配置：
\`\`\`yaml
{{pipelineYaml}}
\`\`\`

审查要求：
- 输出 JSON 格式
- 每项问题包含：severity、line、message、suggestion`,

  outputSchema: z.object({
    issues: z.array(z.object({
      severity: z.enum(['critical', 'warning', 'info']),
      line: z.number(),
      message: z.string(),
      suggestion: z.string()
    }))
  }),

  parameters: [
    { name: 'pipelineYaml', type: 'string', required: true, description: '流水线 YAML 配置' }
  ]
};
```

**Prompt 版本管理**：
```typescript
class PromptRegistry {
  private prompts: Map<string, PromptTemplate>;

  register(prompt: PromptTemplate) {
    const key = `${prompt.name}:${prompt.version}`;
    this.prompts.set(key, prompt);
  }

  get(name: string, version?: string): PromptTemplate {
    const key = version ? `${name}:${version}` : this.getLatestVersion(name);
    const prompt = this.prompts.get(key);
    if (!prompt) throw new Error(`Prompt ${key} not found`);
    return prompt;
  }

  // 构建最终 prompt
  build(name: string, params: Record<string, any>): string {
    const prompt = this.get(name);
    let userPrompt = prompt.userPrompt;

    // 参数替换
    for (const [key, value] of Object.entries(params)) {
      userPrompt = userPrompt.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }

    return `${prompt.systemPrompt}\n\n${userPrompt}`;
  }
}
```

#### 三、Agent 开发规范

**Agent 架构**：
```typescript
interface Agent {
  id: string;
  name: string;
  description: string;

  // 核心能力
  execute(input: AgentInput): Promise<AgentOutput>;

  // 工具
  tools: Tool[];

  // 状态
  state: AgentState;
}

interface AgentInput {
  task: string;
  context?: Record<string, any>;
  constraints?: string[];
}

interface AgentOutput {
  result: any;
  reasoning: string;
  toolsUsed: string[];
  artifacts?: Artifact[];
}

interface Tool {
  name: string;
  description: string;
  schema: ZodSchema;
  execute: (params: any) => Promise<any>;
}
```

**Agent 实现示例**：
```typescript
class CodeReviewAgent implements Agent {
  id = 'code-review-agent';
  name = '代码审查 Agent';
  description = '自动化代码审查，支持多语言';

  tools = [
    new GitTool(),
    new LintTool(),
    new SecurityScanTool(),
    new CommentTool()
  ];

  async execute(input: AgentInput): Promise<AgentOutput> {
    const reasoning: string[] = [];
    const toolsUsed: string[] = [];

    // 1. 获取代码变更
    const changes = await this.gitTool.execute({ action: 'get-changes', ...input.context });
    reasoning.push('获取代码变更');
    toolsUsed.push('git');

    // 2. 运行 lint
    const lintResults = await this.lintTool.execute({ changes });
    reasoning.push(`运行 lint，发现 ${lintResults.issues.length} 个问题`);
    toolsUsed.push('lint');

    // 3. 安全扫描
    const securityResults = await this.securityTool.execute({ changes });
    reasoning.push(`安全扫描，发现 ${securityResults.issues.length} 个风险`);
    toolsUsed.push('security-scan');

    // 4. 生成审查报告
    const report = await this.llmService.complete(
      this.promptRegistry.build('code-review-report', {
        lintResults: JSON.stringify(lintResults),
        securityResults: JSON.stringify(securityResults)
      })
    );
    reasoning.push('生成审查报告');
    toolsUsed.push('llm');

    return {
      result: report.content,
      reasoning: reasoning.join(' → '),
      toolsUsed,
      artifacts: [{ type: 'report', content: report.content }]
    };
  }
}
```

**Agent 编排（Multi-Agent）**：
```typescript
class AgentOrchestrator {
  private agents: Map<string, Agent>;
  private supervisor: Agent;

  async executeTask(task: string): Promise<AgentOutput> {
    // 1. 任务分解
    const plan = await this.supervisor.execute({
      task: `分解任务: ${task}`,
      context: { availableAgents: Array.from(this.agents.keys()) }
    });

    // 2. 并行执行子任务
    const subTasks = JSON.parse(plan.result);
    const results = await Promise.all(
      subTasks.map((st: any) => this.agents.get(st.agent).execute(st.input))
    );

    // 3. 结果汇总
    const summary = await this.supervisor.execute({
      task: '汇总结果',
      context: { results }
    });

    return summary;
  }
}
```

#### 四、向量存储与 RAG 规范

**向量数据库选型**：
| 场景 | 推荐方案 | 说明 |
|------|----------|------|
| 小规模（<10万） | Chroma | 轻量、易用 |
| 中等规模 | Milvus | 功能丰富、扩展性好 |
| 大规模（百万级） | Pinecone | 云原生、高可用 |
| 企业级 | Weaviate | 图谱+向量 |

**向量存储接口**：
```typescript
interface VectorStore {
  // 添加向量
  add(vectors: VectorRecord[]): Promise<string[]>;

  // 向量相似搜索
  search(options: SearchOptions): Promise<SearchResult[]>;

  // 删除向量
  delete(ids: string[]): Promise<void>;

  // 获取向量
  get(ids: string[]): Promise<VectorRecord[]>;
}

interface VectorRecord {
  id: string;
  vector: number[];
  metadata: Record<string, any>;
}

interface SearchOptions {
  queryVector?: number[];
  queryText?: string;
  topK?: number;
  filter?: Record<string, any>;
  includeMetadata?: boolean;
}
```

**RAG 实现规范**：
```typescript
class RAGService {
  private vectorStore: VectorStore;
  private llmService: LLMService;
  private embeddingService: EmbeddingService;

  async query(question: string, options: RagOptions): Promise<RAGResponse> {
    // 1. 向量化问题
    const questionVector = await this.embeddingService.embed(question);

    // 2. 检索相关文档
    const searchResults = await this.vectorStore.search({
      queryVector: questionVector,
      topK: options.topK || 5,
      filter: options.filter
    });

    // 3. 构建上下文
    const context = searchResults
      .map(r => `[文档 ${r.id}]\n${r.metadata.content}`)
      .join('\n\n');

    // 4. 生成答案
    const prompt = `
基于以下上下文回答问题。如果上下文不足以回答，请说明。

上下文：
${context}

问题：${question}
`;

    const answer = await this.llmService.complete(prompt, {
      model: 'gpt-4',
      temperature: 0.3
    });

    return {
      answer: answer.content,
      sources: searchResults.map(r => ({
        id: r.id,
        score: r.score,
        metadata: r.metadata
      })),
      usage: answer.usage
    };
  }

  // 文档入库
  async indexDocuments(documents: Document[]): Promise<void> {
    const records = await Promise.all(
      documents.map(async (doc) => ({
        id: doc.id,
        vector: await this.embeddingService.embed(doc.content),
        metadata: {
          title: doc.title,
          content: doc.content,
          source: doc.source,
          createdAt: doc.createdAt
        }
      }))
    );

    await this.vectorStore.add(records);
  }
}
```

#### 五、AI 服务监控与成本控制

**监控指标**：
| 指标 | 告警阈值 |
|------|----------|
| API 调用延迟 P99 | > 10s |
| 错误率 | > 5% |
| Token 消耗/天 | > 预算 80% |
| 模型响应质量 | 低于基线 10% |

**成本控制**：
```typescript
interface CostConfig {
  dailyBudget: number;           // 每日预算（美元）
  monthlyBudget: number;         // 每月预算
  alertThreshold: number;        // 告警阈值（百分比）

  // 模型成本（美元/1M tokens）
  modelCosts: {
    'gpt-4': { input: 30, output: 60 },
    'gpt-3.5-turbo': { input: 0.5, output: 1.5 },
    'claude-3-opus': { input: 15, output: 75 },
    'text-embedding-3-large': { input: 0.13, output: 0 }
  };
}

class CostTracker {
  private usage: Map<string, number> = new Map();

  async track(promptTokens: number, completionTokens: number, model: string) {
    const cost = this.calculateCost(promptTokens, completionTokens, model);
    const key = this.getTodayKey();

    this.usage.set(key, (this.usage.get(key) || 0) + cost);

    // 检查预算
    if (this.usage.get(key) > this.config.dailyBudget * 0.8) {
      await this.sendAlert('Budget warning', this.usage.get(key));
    }
  }

  private calculateCost(promptTokens: number, completionTokens: number, model: string): number {
    const costs = this.config.modelCosts[model];
    return (promptTokens / 1_000_000) * costs.input +
           (completionTokens / 1_000_000) * costs.output;
  }
}
```

#### 六、AI 安全规范

**Prompt 注入防护**：
```typescript
class PromptSecurity {
  // 输入过滤
  sanitizeInput(input: string): string {
    return input
      .replace(/```[\s\S]*?```/g, '')  // 移除代码块
      .replace(/ignore\s+(previous|above|system)/gi, '')
      .substring(0, 10000);  // 长度限制
  }

  // 输出过滤
  sanitizeOutput(output: string): string {
    // 移除可能的敏感信息
    return output
      .replace(/sk-[a-zA-Z0-9]{20,}/g, '[REDACTED_KEY]')
      .replace(/\d{16,}/g, '[REDACTED_NUMBER]');
  }

  // 指令注入检测
  detectInjection(input: string): boolean {
    const patterns = [
      /ignore\s+(previous|above|system|instructions)/i,
      /disregard\s+(your|all)\s+(instructions|rules)/i,
      /system\s*:\s*/i,
      /assistant\s*:\s*/i
    ];

    return patterns.some(p => p.test(input));
  }
}
```

### 2.8 算法与性能规范

**算法复杂度要求**：
| 场景 | 最大时间复杂度 | 场景示例 |
|------|----------------|----------|
| 数据库查询 | O(log n) | 通过索引查询 |
| 列表过滤 (内存) | O(n) | Array.filter() |
| 列表去重 | O(n) | 使用 Set/Map |
| 嵌套循环 | 禁止 O(n²) | 需用 Map 优化为 O(n) |

**性能关键原则**：
- 排序、过滤、分页优先在数据库层完成（使用 ORDER BY / WHERE / LIMIT）
- 禁止在 Node.js 内存中对超过 1000 条记录进行排序
- 大数据量列表操作必须使用数据库索引
- 内存中去重使用 `Set` 或 `Map`，不使用嵌套循环

**排序场景**：
- Node.js 内置 `Array.sort()` 使用 Timsort，O(n log n)，适用于 < 10000 条记录
- > 10000 条记录必须在数据库层完成排序

**搜索场景**：
| 场景 | 推荐方案 | 工具 |
|------|----------|------|
| 精确查询 | B+树索引 | PostgreSQL |
| 全文搜索 | 倒排索引 | Elasticsearch |
| 向量检索 | HNSW | Milvus / pgvector |
| 模糊匹配 | LIKE / trigram | PostgreSQL |

**分布式一致性算法**：
| 场景 | 推荐算法 |
|------|----------|
| 缓存分片 | 一致性哈希 |
| Leader 选举 | Raft |
| 分布式协调 | etcd/Consul |

**缓存淘汰算法**：
| 场景 | 推荐算法 |
|------|----------|
| 热点数据 | LRU (Redis 默认) |
| 频率区分 | LFU |
| 定时过期 | TTL |

### 2.9 国际化与多时区规范

**多语言支持 (i18n)**：
```typescript
// 目录结构
src/
├── locales/
│   ├── zh-CN.json    # 中文简体
│   ├── en-US.json    # 英文
│   └── ja-JP.json    // 日文
└── i18n.ts           # i18n 配置
```

**多时区处理**：
- 存储：UTC 时间存储
- 显示：前端根据用户时区转换
- 时区配置：用户个人设置 → 浏览器时区 → 默认 UTC

```typescript
// 时间格式化
dayjs.utc().tz(userTimezone).format('YYYY-MM-DD HH:mm:ss')
```

**国际化规范**：
- 所有用户可见文本使用 i18n key
- 不允许硬编码文案
- 日期/时间/货币根据 locale 格式化

### 2.10 灾备与高可用规范

**SLA 目标**：
| 指标 | 标准版 | 企业版 | 核心服务(必达) |
|------|--------|--------|----------------|
| 可用率 | 99.9% | 99.95% | 99.99% |
| RPO（恢复点目标） | 1小时 | 5分钟 | 1分钟 |
| RTO（恢复时间目标） | 4小时 | 30分钟 | 15分钟 |

**数据备份策略**：
| 备份类型 | 频率 | 保留时间 | 存储位置 |
|----------|------|----------|----------|
| 全量备份 | 每周日 | 30天 | 冷存储 |
| 增量备份 | 每日 | 7天 | 热存储 |
| 实时备份 | 实时 | - | 跨机房 |

**容灾架构**：
- 主备机房跨地域部署
- 数据实时同步
- 故障自动切换（Auto Failover）
- 定期进行灾备演练

**多活架构**：
- 多机房流量负载均衡
- 读写分离策略
- 跨机房数据一致性保障

```
┌─────────────────────────────────────────────────────────┐
│ Layer 5: 客户端层 (Client)                               │
│  orion-frontend (React 18 + Vite + Orion-MF 微前端)      │
│  149 页面 / 101 API 客户端 / 全局 Store (Zustand)        │
├─────────────────────────────────────────────────────────┤
│ Layer 4: 网关层 (Gateway)                                │
│  orion-api-gateway (Fastify)                            │
│  认证代理 / 限流 / 路由转发 / 57+ 微服务代理路由          │
├─────────────────────────────────────────────────────────┤
│ Layer 3: 服务层 (Services)                               │
│  ├── orion-platform-service (核心单体, 104 路由)         │
│  │   ├── 73 实质服务 (553 源文件, 273 测试文件)          │
│  │   ├── 92 Repository / 35 Model                       │
│  │   └── EventBus / NATS / Redis / PostgreSQL           │
│  └── 34 个独立微服务 (orion-*-svc)                       │
├─────────────────────────────────────────────────────────┤
│ Layer 2: 基础设施层 (Infrastructure)                     │
│  ├── 数据库: PostgreSQL 集群 (207 migrations)            │
│  ├── 缓存: Redis                                         │
│  ├── 消息: NATS JetStream (EventBus)                    │
│  └── 编排: Docker Compose                                │
├─────────────────────────────────────────────────────────┤
│ Layer 1: 平台基础层 (Platform Foundation)                │
│  ├── 认证中间件: authMiddleware, roleGuard               │
│  ├── 租户隔离: TenantIsolationService, RLS              │
│  ├── 审计日志: AuditService                              │
│  ├── 通知服务: NotificationService                       │
│  ├── 事件总线: EventBus (NATS JetStream)                 │
│  └── 错误处理: errors/, ErrorHandler                     │
└─────────────────────────────────────────────────────────┘
```

> **注意**：Layer 编号与 2.1 节五层架构模型保持一致。Layer 1 = 平台基础层（最底层），Layer 2 = 基础设施层。

### 2.11 网络链路规范

**网络分层架构**：
```
Layer 5: 客户端层 (Client)
  - orion-frontend (React + 微前端)
  - 第三方集成 (GitHub/GitLab/Slack)

Layer 4: 网关层 (API Gateway)
  - 认证授权 (JWT Cookie 验证)
  - 限流熔断
  - 路由转发

Layer 3: 服务层 (Business Services)
  - orion-platform-service (核心业务逻辑)
  - 34 个独立微服务 (orion-*-svc)
  - 服务间调用 (EventBus/NATS)

Layer 2: 基础设施层 (Infrastructure)
  - PostgreSQL / Redis / Elasticsearch
  - 内部网络隔离
  - 消息队列 (NATS JetStream)

Layer 1: 平台基础层 (Platform Foundation)
  - 认证中间件 / 租户隔离 / 审计日志
  - 事件总线 / 错误处理 / 通知服务
```

> **注意**：网络链路的 Layer 编号与五层架构模型（2.1 节）保持一致。Layer 1 为最底层（平台基础），Layer 5 为最顶层（客户端）。

**负载均衡策略**：
| 层级 | 负载均衡方式 | 算法选择 |
|------|-------------|----------|
| L4 (传输层) | F5/软 LB | 加权轮询、最小连接 |
| L7 (应用层) | Nginx/Envoy | 轮询、IP 哈希、一致性哈希 |

**HTTPS/TLS 配置规范**：
```nginx
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers TLS_AES_256_GCM_SHA384:ECDHE-RSA-AES256-GCM-SHA384;
ssl_prefer_server_ciphers on;
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains";
```

**DNS 与域名管理**：
```
格式: {服务名}.{命名空间}.internal
示例: orion-platform-service.prod.internal

TTL 配置:
  - A 记录: 生产 300s，变更时 60s
  - CNAME: 生产 600s，变更时 60s
```

### 2.12 中间件资源规范

**Redis 集群配置**：
| 场景 | 推荐模式 | 配置要点 |
|------|----------|----------|
| 小规模 (< 3 节点) | 主从复制 | 1 主 2 从 |
| 中等规模 | 哨兵模式 | 3 哨兵 + 1 主 2 从 |
| 大规模 (> 10 节点) | Cluster | 至少 6 节点 (3 主 3 从) |

**Redis 配置参数**：
```yaml
maxmemory: 4gb
maxmemory-policy: allkeys-lru
timeout: 300
tcp-keepalive: 60
```

**PostgreSQL 连接池配置**：
```typescript
const poolConfig = {
  min: 5,
  max: 50,
  acquireTimeoutMillis: 30000,
  idleTimeoutMillis: 30000,
  maxLifetimeMillis: 1800000,
  healthCheck: true
};
```

**缓存策略**：
| 防护类型 | 解决方案 |
|----------|----------|
| 缓存击穿 | 互斥锁 + 永不过期 |
| 缓存雪崩 | 随机 TTL + 预热 |
| 缓存穿透 | 空值缓存 + 布隆过滤 |
| 缓存热点 | 本地缓存 + Redis 二级缓存 |

**消息队列消费者配置**：
```typescript
const consumerConfig = {
  maxAckPending: 100,
  maxDeliver: 3,
  ackPolicy: 'explicit',
  retry: {
    maxAttempts: 3,
    backoff: 'exponential',
    initialInterval: 1000
  }
};
```

### 2.13 微服务目录规范

项目有 **34 个 `orion-*-svc` 独立服务目录**，全部有真实实现代码（非占位）：

| 服务 | 目录 | 实现状态 |
|------|------|----------|
| Pipeline | `orion-pipeline-svc/` | 骨架 |
| Deploy | `orion-deploy-svc/` | 骨架 |
| Monitor | `orion-monitor-svc/` | 骨架 |
| Agent | `orion-agent-svc/` | 骨架 |
| Intelligence | `orion-intelligence-svc/` | 骨架 |
| Approval | `orion-approval-svc/` | 部分实现 |
| Artifact | `orion-artifact-svc/` | P0 完整 |
| Code | `orion-code-svc/` | P0 完整 |
| FinOps | `orion-finops-svc/` | P0 完整 |
| Plugin | `orion-plugin-svc/` | P0 完整 |
| AI | `orion-ai-svc/` | P0 完整 |
| Security | `orion-security-svc/` | P0 完整 |
| Ticket | `orion-ticket-svc/` | P0 完整 |

**开发规则**：
- 新功能开发应优先在 `orion-platform-service` 中实现
- 修改已有功能时，应先确认哪个是「权威实现」— 通常 `orion-platform-service` 是当前实际使用的版本
- `orion-*-svc` 目录不应随意删除或修改，除非用户明确要求
- 很多功能存在双份实现（如通知服务），前端通常只调用 `orion-platform-service`

---

## 二、SSD 规范驱动开发 (Specification-Driven Development)

> SSD 是 AI 辅助开发的核心模式：通过完善的规范文档驱动 AI Agent 生成高质量代码，减少人工干预，提升开发效率。

### 2.1 核心理念

**传统开发 vs 规范驱动开发**:

```
传统开发:
需求 → 人工设计 → 人工编码 → 人工测试 → 上线
       (慢)      (易出错)  (耗时)

SSD:
规范文档 → AI Agent 生成代码 → 人工审查 → 自动化测试 → 上线
  (一次编写)   (快速准确)      (聚焦质量)   (自动验证)
```

**关键原则**:
1. **规范先行** - 代码实现前必须有完整的规范文档
2. **AI 可理解** - 规范格式适合 AI Agent 解析和执行
3. **可验证** - 每条规范都有对应的自动化检查手段
4. **闭环反馈** - 代码生成→验证→修正形成闭环

### 2.2 规范文档结构

AI 可用的规范文档必须包含以下要素：

| 要素 | 说明 | 示例 |
|------|------|------|
| **功能描述** | 明确要实现的功能 | "实现 Pipeline 删除功能" |
| **输入输出** | 接口定义、数据结构 | `DELETE /pipelines/:id → {success: boolean}` |
| **业务规则** | 约束条件、边界情况 | "删除前检查是否正在运行" |
| **错误处理** | 异常场景和错误码 | "404: Pipeline not found" |
| **测试用例** | 验证标准 | "正常删除、不存在、运行中" |
| **代码位置** | 相关文件路径 | `services/pipeline/PipelineService.ts` |

**规范模板** (AI Agent 可用):
```markdown
# [模块] - [功能]

## 需求描述
[一句话描述功能]

## 接口定义
METHOD /path - [描述]
  输入: {字段: 类型, 必填, 说明}
  输出: {字段: 类型, 说明}

## 权限要求
- 认证: authenticateUser / authenticateAdmin
- 权限: resource:action (如 pipeline:delete)

## 业务规则
1. [规则1]
2. [规则2]

## 数据库变更
- [ ] 需要新 migration: 描述
- [ ] 涉及表: table_name

## 事件发布
- [ ] 需要发送 Event (类型: xxx.xxx)

## 前端联动
- [ ] 需要新增/修改前端页面: path/to/Page.tsx
- [ ] 需要新增/修改 API 客户端: path/to/api.ts

## 错误处理
| 场景 | HTTP状态码 | 错误码 | 消息 |
|------|-----------|--------|------|

## 测试场景
- 正常流程: [描述]
- 异常流程: [描述]
- 边界条件: [描述]

## 代码位置
- Service: path/to/Service.ts
- Controller: path/to/Controller.ts
- Routes: path/to/routes.ts

## 已知缺口
- [ ] 规范有但实现缺失的功能
- [ ] 需要后续补充的逻辑
```

### 2.3 AI Agent 工作流程

```
Step 0: 分析现有代码架构（路由是否已存在、依赖服务是否就绪、有无重复注册）
  ↓
Step 1: 读取规范文档
  ↓
Step 2: 理解需求、接口、规则、依赖
  ↓
Step 3: 生成代码（遵循项目现有模式：Controller → Service → Repository）
  ↓
Step 4: 运行类型检查（npm run type-check）
  ↓
Step 5: 运行测试（npm run test -- test-file）
  ↓
Step 6: 回归检查（确认未破坏已有路由/功能）
  ↓
Step 7: 输出代码 + 验证结果 + 规范一致性报告
  ↓
Step 8: 人工 Code Review
  ↓
Step 9: 合并 → 更新规范文档（标记已实现缺口）
```

**AI 生成代码的质量要求**（可量化指标）:
- [ ] TypeScript 零编译错误（`npm run type-check` 通过）
- [ ] 单元测试覆盖率 >= 80%（`npm run test:coverage`）
- [ ] ESLint 零 error（`npm run lint`）
- [ ] 所有异步操作有 try-catch + error response
- [ ] 所有 Controller 方法有对应的 Route 注册且无重复
- [ ] 错误码遵循项目错误码体系（3.16 节）
- [ ] 有日志记录（关键业务节点 INFO 级别）
- [ ] 有必要的注释（复杂逻辑说明 why，而非 what）

### 2.4 规范驱动的实践案例

**案例: Pipeline 删除功能**

规范文档 (`docs/specs/pipeline-delete.md`):
```markdown
# Pipeline - 删除功能

## 接口定义
DELETE /api/v1/pipelines/:id
  输入: id (path, string, 必填)
  输出: 204 No Content (成功) / 404 Not Found

## 权限要求
- 认证: authenticateUser
- 角色: admin / owner

## 业务规则
1. 通过 PipelineService.delete() 调用 BaseRepository.delete() 执行硬删除
2. 删除时清除 Redis 缓存 (cache.del(`pipeline:${id}`))
3. 使用硬删除 (DELETE FROM pipelines WHERE id = $1)
4. [P0 缺口] 运行中状态检查：规范要求但当前实现缺失，需补充——正在运行的 Pipeline 应返回 409 Conflict

## 错误处理
| 场景 | HTTP状态码 | 错误码 | 消息 |
|------|-----------|--------|------|
| 不存在 | 404 | `CLIENT.404.001` | 资源不存在 |
| 运行中 | 409 | `CLIENT.409.001` | Pipeline 正在运行，无法删除 |
| 服务器错误 | 500 | `SYS.500.001` | 内部服务器错误 |

## 事件发布
- [ ] 需要发送 PipelineEvent (类型: pipeline.deleted) — 当前未实现

## 测试场景
- 正常删除存在的 Pipeline → 204
- 删除不存在的 Pipeline → 404
- [TODO] 删除运行中的 Pipeline → 409 (待实现)
```

AI Agent 根据规范生成:
- `PipelineController.delete()` - 控制器 (orion-platform-service/src/api/controllers/PipelineController.ts:249)
- `PipelineService.delete()` - 业务逻辑 (orion-platform-service/src/services/pipeline/PipelineService.ts:243)
- `PipelineRepository.delete()` - 数据访问 (继承自 BaseRepository, orion-platform-service/src/db/base-repository.ts:116)
- `routes.ts` - 路由注册 (orion-platform-service/src/api/routes.ts:813)
- `pipeline-delete.test.ts` - 测试用例

**已知缺口** (AI Agent 需标注):
- [ ] **P0: 运行中状态检查缺失** — `PipelineService.delete()` 直接调用 `repository.delete()` 执行硬删除，无任何运行中状态检查
- [ ] **P0: CICDRepository 是死代码** — `orion-platform-service/src/api/repositories/CICDRepository.ts` 包含软删除实现但从未被 import，不应作为权威实现引用
- [ ] 路由重复注册：`routes.ts` + `pipeline-routes-registrar.ts` 同时注册了 DELETE 路由

### 2.5 规范质量检查

**规范文档自检**:

| 检查项 | 标准 | 工具 |
|--------|------|------|
| 完整性 | 包含所有必需要素 | 人工审查 |
| 明确性 | 无模糊描述 (如"适当处理") | AI 辅助检查 |
| 可验证 | 每条规则有对应的测试 | 测试覆盖率 |
| 一致性 | 与现有规范不冲突 | 规范审查 |
| 可执行 | AI Agent 能理解并执行 | 代码生成测试 |

**规范版本管理**:

| 操作 | 流程 |
|------|------|
| 新建规范 | `docs/specs/YYYY-MM-DD-模块-功能.md` |
| 修改规范 | 更新文档 + 记录变更 |
| 废弃规范 | 标记为 DEPRECATED + 迁移指南 |

### 2.6 SSD 成熟度模型

| 级别 | 特征 | Orion 当前状态 |
|------|------|----------------|
| L0 无规范 | 口头传达需求 | - |
| L1 基础规范 | 有 PRD/设计文档 | ✅ 已有 (170+ 设计文档) |
| L2 AI 可用 | 规范结构化为 AI 可理解格式 | ⚠️ 边缘（规范模板已定义，但 `docs/specs/` 目录待创建） |
| L3 自动验证 | 规范有对应的自动化检查 | ❌ 未实现 |
| L4 闭环反馈 | 代码生成→验证→修正自动化 | ❌ 未实现 |
| L5 自我优化 | 规范根据运行数据自动调整 | - |

**当前定级: L1-L2** (有设计文档，规范模板已定义但尚未实例化为独立文件)

**目标**: 6 个月内达到 L3 级别

---

## 三、后端代码规范

### 3.1 目录结构

```
orion-platform-service/src/
├── api/                    # API 层
│   ├── routes.ts          # 路由注册中心 (104 个 route 模块)
│   ├── controllers/       # 42 个控制器
│   └── middleware/        # authMiddleware, roleGuard
├── services/              # 70+ 业务服务
│   ├── pipeline/          # 流水线域
│   ├── chatops/           # ChatOps 域
│   ├── ticketing/         # 工单域
│   ├── self-healing/      # 自愈域
│   ├── ai/                # AI 域
│   ├── finops/            # FinOps 域
│   ├── cmdb/              # CMDB 域
│   └── ... (60+ more)
├── engine/                # 流水线引擎
│   ├── PipelineEngine.ts
│   ├── StageExecutor.ts
│   └── TaskRunner.ts
├── saga/                  # Saga 编排
│   ├── SagaCoordinator.ts
│   ├── PipelineSaga.ts
│   └── TransactionLog.ts
├── events/                # 事件发布
│   ├── PipelineEvent.ts
│   ├── CodeEvent.ts
│   └── ...
├── models/                # 数据模型 (TypeScript classes)
├── repositories/          # 数据访问层 (92 个)
│   ├── ArtifactRepository.ts
│   ├── PipelineRepository.ts
│   └── ...
├── db/migrations/         # SQL 迁移文件 (207 个)
└── utils/                 # 工具函数
```

### 3.2 日志规范

**日志格式** (JSON 结构化)：
```json
{
  "timestamp": "2026-05-21T10:00:00Z",
  "level": "info|warn|error",
  "service": "pipeline-service",
  "traceId": "req-abc123",
  "message": "Pipeline started",
  "context": { "pipelineId": "pl-123", "tenantId": "t-001" }
}
```

**日志级别使用**：
| 级别 | 使用场景 |
|------|----------|
| ERROR | 业务异常需要人工介入 |
| WARN | 可恢复的异常 |
| INFO | 关键业务节点（创建/更新/删除） |
| DEBUG | 开发调试信息（生产关闭） |

**禁止记录**：
- 密码、Token、API Key 等敏感凭证
- 完整的用户请求体（可能有 PII）
- 信用卡、身份证等敏感个人信息

### 3.3 监控指标规范

**核心指标**：
| 指标 | 说明 | 采集方式 |
|------|------|----------|
| QPS | 每秒请求数 | Prometheus counter |
| P99 延迟 | 99% 请求响应时间 | Prometheus histogram |
| 错误率 | 5xx 错误占比 | Prometheus counter |
| 可用率 | 成功请求 / 总请求 | 推导计算 |

**告警阈值**：
| 指标 | 警告 | 严重 |
|------|------|------|
| 错误率 | >1% | >5% |
| P99 延迟 | >2s | >5s |
| 可用率 | <99.9% | <99% |

### 3.4 配置管理规范

**环境变量命名**：
```
ORION_{模块}_{配置项}
示例:
  - ORION_DB_HOST
  - ORION_REDIS_URL
  - ORION_JWT_SECRET
```

**敏感配置**：
- 存储在 Kubernetes Secrets 或 Vault
- 禁止硬编码在代码中
- 运行时从环境变量或配置服务读取

### 3.5 分布式事务规范

**事务模式选择**：

| 场景 | 推荐模式 | 说明 |
|------|----------|------|
| 跨服务数据一致性 | Saga | 编排式事务，适合长流程 |
| 银行转账/支付 | TCC | 补偿式事务，强一致性 |
| 单服务内多表 | XA | 两阶段提交，性能较低 |

**Saga 编排**：
```typescript
// Saga 协调器
interface SagaStep {
  name: string;
  compensate: () => Promise<void>;
}

// 示例：创建订单流程
const createOrderSaga = [
  { name: 'createOrder', forward: createOrder, compensate: cancelOrder },
  { name: 'deductInventory', forward: deductInventory, compensate: restoreInventory },
  { name: 'createPayment', forward: createPayment, compensate: refundPayment }
];
```

**分布式事务补偿**：
- 记录事务日志到 TransactionLog 表
- 定时任务扫描未完成事务进行补偿
- 告警通知人工处理失败的事务

### 3.6 分布式锁规范

**使用场景**：
- 防止重复操作（重复提交、重复支付）
- 临界区保护（库存扣减、余额操作）
- 任务调度（防止重复执行）

**锁实现** (Node.js + redlock)：
```typescript
// 安装: npm install redlock
import Redlock from 'redlock';
import Redis from 'ioredis';

// 初始化 Redlock（支持多 Redis 实例提高可用性）
const redlock = new Redlock(
  [new Redis(process.env.REDIS_URL)],
  {
    retryCount: 3,           // 获取锁最大重试次数
    retryDelay: 200,         // 重试间隔 (ms)
    retryJitter: 100,        // 重试抖动 (ms)，防止惊群
    automaticExtensionThreshold: 500, // 自动续期阈值
  }
);

// 封装锁工具函数
async function withLock<T>(
  resource: string,
  ttl: number,
  fn: () => Promise<T>
): Promise<T> {
  const lock = await redlock.acquire([`orion:lock:${resource}`], ttl);
  try {
    return await fn();
  } finally {
    await lock.release();
  }
}

// 使用示例
await withLock('order:create:' + orderId, 30000, async () => {
  // 临界区逻辑
  await processOrder(orderId);
});
```

**原生 Redis 实现** (无 redlock 依赖)：
```typescript
// 使用 Redis SET NX PX 命令
async function acquireLock(key: string, ttl: number): Promise<string | null> {
  const value = crypto.randomUUID();
  const result = await redis.set(`orion:lock:${key}`, value, 'PX', ttl, 'NX');
  return result === 'OK' ? value : null;
}

async function releaseLock(key: string, value: string): Promise<boolean> {
  // Lua 脚本确保只释放自己持有的锁
  const script = `
    if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("del", KEYS[1])
    else
      return 0
    end
  `;
  const result = await redis.eval(script, 1, `orion:lock:${key}`, value);
  return result === 1;
}
```

**锁配置**：
```yaml
lock:
  waitTime: 5000    # 获取锁等待时间(ms)
  leaseTime: 30000  # 锁自动释放时间(ms)
  retryCount: 3     # 获取锁重试次数
  retryDelay: 200   # 重试间隔(ms)
```

### 3.7 消息队列可靠性规范

**消息可靠性保障**：
| 机制 | 说明 | 实现 |
|------|------|------|
| 持久化 | 消息落盘不丢失 | deliveryMode: persistent |
| ACK确认 | 消费成功确认 | manual ack |
| 重试队列 | 失败消息自动重试 | retry DLQ |
| 死信队列 | 超过最大重试移入 | maxRetries: 3 |

**消息幂等**：
```typescript
// 消费者幂等处理
const consumer = async (msg) => {
  const messageId = msg.headers['messageId'];
  const processed = await redis.setnx(`msg:${messageId}`, 1, 300);
  if (!processed) return; // 已处理，跳过

  // 业务逻辑
  await processMessage(msg);
};
```

**消息顺序性**：
- 相同业务 ID 使用相同队列
- 全局顺序：单队列
- 高并发：分片队列

### 3.8 重试与幂等规范

**重试策略**：
```typescript
// 指数退避重试
const retryConfig = {
  maxAttempts: 3,
  backoff: {
    initialInterval: 1000,  // 1秒
    multiplier: 2,          // 2倍
    maxInterval: 10000      // 最大10秒
  },
  retryableErrors: [ErrorCode.NETWORK_ERROR, ErrorCode.TIMEOUT]
};
```

**重试场景分类**：

| 错误类型 | 重试策略 | 示例 |
|----------|----------|------|
| 网络超时 | 指数退避重试 | 3次后放弃 |
| 服务暂时不可用 | 延迟重试 | 5秒后重试 |
| 业务异常 | 不重试 | 业务错误需人工处理 |
| 资源冲突 | 延迟重试 | 乐观锁冲突 |

**幂等设计**：
- 唯一请求 ID (requestId) 过滤重复
- 乐观锁版本号控制
- 数据库唯一索引防重
- 状态机流转校验

### 3.9 超时控制规范

**超时配置**：
```yaml
timeouts:
  # HTTP 调用超时
  http:
    connect: 3000    # 连接超时(ms)
    read: 30000     # 读取超时(ms)

  # 数据库超时
  database:
    query: 5000     # 查询超时(ms)
    transaction: 30000  # 事务超时(ms)

  # 外部服务超时
  external:
    aiService: 60000    # AI 服务
    gitlab: 15000       # GitLab API
    harbor: 10000       # Harbor 仓库
```

**超时处理**：
- 核心接口：严格超时，快速失败
- 非核心接口：较长超时，降级处理
- 批量操作：分批处理，设置进度超时

### 3.10 CI/CD 流水线规范

**流水线阶段**：
```yaml
# .gitlab-ci.yml 示例
stages:
  - lint
  - test
  - build
  - security
  - deploy

lint:
  stage: lint
  script:
    - npm run lint
    - npm run type-check

test:
  stage: test
  script:
    - npm run test:coverage
  coverage: '/Coverage: \d+\.\d+%/'

build:
  stage: build
  script:
    - npm run build
  artifacts:
    paths:
      - dist/

deploy:
  stage: deploy
  script:
    - kubectl apply -f k8s/
```

**多环境部署**：
| 环境 | 用途 | 触发条件 |
|------|------|----------|
| dev | 开发测试 | 提交到 develop 分支 |
| staging | 预发布 | MR 合并到 main |
| prod | 生产发布 | 标签发布 (tag) |

**门禁检查**：
- lint/type-check 必须通过
- 测试覆盖率 >= 80%
- 无高危安全漏洞
- 镜像签名校验

### 3.11 部署策略规范

**部署方式**：

| 方式 | 说明 | 适用场景 |
|------|------|----------|
| 滚动更新 | 逐步替换实例 | 金丝雀验证 |
| 蓝绿部署 | 两套环境切换 | 大版本发布 |
| 灰度发布 | 按比例流量分配 | 新功能测试 |
| 暂停部署 | 可随时暂停/回滚 | 关键系统 |

**回滚机制**：
```yaml
# K8s Deployment 回滚配置
strategy:
  type: RollingUpdate
  rollingUpdate:
    maxSurge: 25%        # 最大超额实例数
    maxUnavailable: 25%  # 最大不可用实例数
```

**回滚触发条件**：
- 健康检查失败
- 错误率超过阈值
- P99 延迟超过 5 秒
- 人工触发回滚

**K8s Deployment 配置**：
```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: orion-platform-service
  namespace: orion-prod
  labels:
    app: orion-platform-service
    version: v1
spec:
  replicas: 3
  revisionHistoryLimit: 5
  selector:
    matchLabels:
      app: orion-platform-service
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  template:
    metadata:
      labels:
        app: orion-platform-service
        version: v1
    spec:
      serviceAccountName: orion-sa
      affinity:
        podAntiAffinity:
          preferredDuringSchedulingIgnoredDuringExecution:
            - weight: 100
              podAffinityTerm:
                labelSelector:
                  matchExpressions:
                    - key: app
                      operator: In
                      values:
                        - orion-platform-service
                topologyKey: kubernetes.io/hostname
      containers:
        - name: orion
          image: registry.orion.devops.io/orion/platform-service:v1.2.3
          imagePullPolicy: Always
          ports:
            - containerPort: 3001
              name: http
          env:
            - name: NODE_ENV
              value: "production"
            - name: ORION_DB_HOST
              valueFrom:
                secretKeyRef:
                  name: orion-secrets
                  key: db-host
            - name: ORION_DB_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: orion-secrets
                  key: db-password
          resources:
            requests:
              memory: "512Mi"
              cpu: "250m"
            limits:
              memory: "1Gi"
              cpu: "1000m"
          livenessProbe:
            httpGet:
              path: /healthz
              port: 3001
            initialDelaySeconds: 30
            periodSeconds: 10
            timeoutSeconds: 3
            failureThreshold: 3
          readinessProbe:
            httpGet:
              path: /healthz
              port: 3001
            initialDelaySeconds: 10
            periodSeconds: 5
            timeoutSeconds: 2
            failureThreshold: 3
          volumeMounts:
            - name: orion-logs
              mountPath: /app/logs
      volumes:
        - name: orion-logs
          emptyDir: {}
```

**K8s Service 配置**：
```yaml
# k8s/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: orion-platform-service
  namespace: orion-prod
  labels:
    app: orion-platform-service
spec:
  type: ClusterIP
  ports:
    - port: 80
      targetPort: 3001
      protocol: TCP
      name: http
  selector:
    app: orion-platform-service
---
apiVersion: v1
kind: Service
metadata:
  name: orion-platform-service-lb
  namespace: orion-prod
  annotations:
    service.beta.kubernetes.io/aws-load-balancer-type: "nlb"
spec:
  type: LoadBalancer
  ports:
    - port: 443
      targetPort: 3001
      protocol: TCP
      name: https
  selector:
    app: orion-platform-service
```

**K8s HorizontalPodAutoscaler 配置**：
```yaml
# k8s/hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: orion-platform-service-hpa
  namespace: orion-prod
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: orion-platform-service
  minReplicas: 3
  maxReplicas: 20
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
        - type: Percent
          value: 10
          periodSeconds: 60
    scaleUp:
      stabilizationWindowSeconds: 0
      policies:
        - type: Percent
          value: 100
          periodSeconds: 15
        - type: Pods
          value: 4
          periodSeconds: 15
      selectPolicy: Max
```

**K8s Ingress 配置**：
```yaml
# k8s/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: orion-platform-service-ingress
  namespace: orion-prod
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/proxy-body-size: "50m"
spec:
  tls:
    - hosts:
        - api.orion.example.com
      secretName: orion-tls-cert
  rules:
    - host: api.orion.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: orion-platform-service
                port:
                  number: 80
```

### 3.12 命名规范

| 类型 | 规则 | 示例 |
|------|------|------|
| 路由文件 | `*-routes.ts` | `pipeline-routes.ts` |
| 控制器 | `*Controller.ts` | `PipelineController.ts` |
| 服务 | `*Service.ts` | `PipelineService.ts` |
| Repository | `*Repository.ts` | `PipelineRepository.ts` |
| Model | `*.ts` (类) | `Pipeline.ts` |
| 中间件 | `*.middleware.ts` | `auth.middleware.ts` |

### 3.13 API 设计规范

**路由注册** (`api/routes.ts`)：
- 路由前缀: `/api/v1/*`
- RESTful 风格: GET/POST/PUT/DELETE
- 路径使用名词: `/pipelines`, `/runs`, `/artifacts`

**请求响应格式**：
```typescript
// 成功响应 (200/201)
{
  "code": 0,
  "message": "success",
  "data": {},
  "meta": {
    "requestId": "req-abc123",
    "timestamp": "2026-04-10T09:00:00Z"
  }
}

// 列表响应
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [],
    "pagination": {
      "total": 100,
      "page": 1,
      "pageSize": 20,
      "totalPages": 5
    }
  }
}

// 错误响应（使用统一错误码体系，见 3.16 节）
{
  "code": "CLIENT.404.001",
  "message": "资源不存在",
  "statusCode": 404,
  "details": {
    "resource": "pipeline",
    "id": "pl-123"
  }
}
```

**HTTP 状态码映射**：

| HTTP 状态 | 业务场景 | code |
|----------|---------|------|
| 200 | 成功 | — |
| 201 | 创建成功 | — |
| 204 | 删除成功 (无内容) | — |
| 400 | 请求参数错误 | `CLIENT.400.001` / `CLIENT.400.002` |
| 401 | 未认证 | `CLIENT.401.001` |
| 403 | 无权限 | `CLIENT.403.001` |
| 404 | 资源不存在 | `CLIENT.404.001` |
| 409 | 资源冲突 | `CLIENT.409.001` |
| 422 | 验证失败 | `CLIENT.400.001` |
| 429 | 请求限流 | `CLIENT.429.001` |
| 500 | 服务器错误 | `SYS.500.001` / `SYS.503.001` |

**分页策略选择**：

```
需要"跳页"功能？
├─ 是 → Offset 分页 (page/total/total_pages)
└─ 否 →
    ├─ 数据实时变化？→ Cursor 分页 (cursor/has_more)
    └─ 数据量>100 万？→ Cursor 分页
```

**过滤参数规范**：

| 参数 | 说明 | 示例 |
|------|------|------|
| {field} | 精确匹配 | `?status=running` |
| {field}_in | 多值匹配 | `?status_in=running,success` |
| {field}_ne | 不匹配 | `?status_ne=failed` |
| {field}_gt | 大于 | `?created_at_gt=2026-04-01` |
| {field}_contains | 包含 | `?name_contains=payment` |

**排序参数**：
```
GET /api/v1/pipelines?sort=-created_at,name
# - 表示降序，升序不加符号
```

### 3.14 安全与权限规范

**认证方式**：
```yaml
认证方案：HttpOnly Cookie (JWT RS256 非对称签名)

请求头：
  Cookie: access_token=eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...
  # Token 通过 Cookie 自动携带，前端 JS 不可读取

Token 存储：
  - 使用 HttpOnly + Secure + SameSite=Strict Cookie
  - 前端 JS 无法访问，防止 XSS 窃取
  - CSRF 防护：Bearer Token 模式天然免疫 CSRF，无需额外 CSRF Token

Token 获取：SSO 登录后服务端设置 Cookie
Token 有效期：24 小时
刷新 Token：7 天
签名算法：RS256（非对称签名，私钥签名，公钥验证）

后端设置 Cookie 示例：
  fastify.setCookie('access_token', token, {
    httpOnly: true,
    secure: true,          // 仅 HTTPS
    sameSite: 'strict',    // 防止跨站请求
    path: '/api',
    maxAge: 24 * 60 * 60   // 24 小时
  });
```

> **[当前实现状态]** Token 存储迁移计划：当前前端 25 个文件仍使用 `localStorage` 存取 token，
> 与上述 HttpOnly Cookie 规范不一致。需逐步迁移：
> 1. 后端确保 `Set-Cookie` 正确配置
> 2. 前端 API 客户端（`client.ts`, `useFetch.ts`）改为依赖 Cookie 自动携带
> 3. 前端 `authStore.ts` 从 `localStorage` 读取改为从 `/api/auth/me` 接口获取用户信息
> 4. 迁移完成后移除 `localStorage` token 相关代码
>
> **迁移状态**：尚未开始（涉及 25 文件，预估 2-3 天）
>
> **[当前实际]** `api/client.ts` 拦截器通过 `useAuthStore.getToken()` 读取 token 并设置 `Authorization: Bearer` header。
> `authStore.ts` 内部通过 `localStorage.getItem('access_token')` 存储和读取 token。
> 此处在文档中标注现状，避免误导。

**权限检查**：
```typescript
// 权限格式："{resource}:{action}:{scope}"
示例:
  - pipeline:run
  - deployment:approve:prod
  - artifact:read:team
```

**限流配置**：
```yaml
限流维度:
  - 用户级别：100 请求/分钟
  - 团队级别：1000 请求/分钟
  - IP 级别：500 请求/分钟

限流响应：
  HTTP 429 Too Many Requests
  Retry-After: 60  # 秒
  X-RateLimit-Limit: 100
  X-RateLimit-Remaining: 0
```

**敏感操作保护**：

| 操作类型 | 验证方式 |
|----------|----------|
| 删除生产资源 | 二次确认弹窗 + 操作密码 |
| 修改权限角色 | 审批流程 |
| 导出大量数据 | 管理员审批 |
| 修改计费配置 | 审批流程 + 通知 |

**Scope 层级定义**：

| 级别 | 示例 | 说明 |
|------|------|------|
| 全局 | `*` | 超级管理员 |
| 租户 | `tenant:{id}` | 租户管理员 |
| 团队 | `team:{id}` | 团队负责人 |
| 项目 | `project:{id}` | 项目成员 |
| 个人 | `user:{id}` | 仅本人 |

**用户角色与操作权限矩阵**：

| 操作 | 超级管理员 | 租户管理员 | 团队负责人 | 开发者 | 访客 |
|------|-----------|-----------|-----------|--------|------|
| 创建 Pipeline | ✓ | ✓ | ✓（本团队） | ✓（本项目） | × |
| 删除 Pipeline | ✓ | ✓ | ✓（本团队） | ✓（创建者） | × |
| 删除生产资源 | ✓（二次确认） | ✓（需审批） | × | × | × |
| 审批工单 | ✓ | ✓ | ✓（本团队） | × | × |
| 查看 FinOps | ✓ | ✓ | ✓（本团队） | × | × |
| 管理租户 | ✓ | × | × | × | × |
| 配置告警 | ✓ | ✓ | ✓（本团队） | × | × |
| 管理用户角色 | ✓ | ✓（本租户） | × | × | × |
| 查看审计日志 | ✓ | ✓ | ✓（本团队） | × | × |
| 管理 API Key | ✓ | ✓ | ✓（本团队） | ✓（个人） | × |

**权限实现要求**：
- 每个操作必须定义：所需权限字符串、是否需要审批、是否有操作审计、失败时的错误码
- 示例：`deletePipeline` 需要 `pipeline:delete` 权限，生产环境需 `deployment:approve:prod` 审批

**数据脱敏规范**：

| 字段类型 | 存储方式 | 返回脱敏 |
|----------|----------|----------|
| 密码 | bcrypt 哈希 | 永不透出 |
| Token | AES-256 加密 | 永不透出 |
| 手机号 | 明文存储 | `138****1234` |
| 身份证 | 加密存储 | `3201***********1234` |
| 邮箱 | 明文存储 | `a***@example.com` |

**CSRF 防护规范**：
```yaml
CSRF 防护策略：
  - 主认证方式（HttpOnly Cookie + JWT）：天然免疫 CSRF，无需额外防护
    原因：CSRF 攻击依赖 Cookie 自动携带，但 JWT Token 在 HttpOnly Cookie 中
         不会被跨站请求自动发送到非同源 API（SameSite=Strict）

  - 仅在使用 Session Cookie 认证时才需要 CSRF 防护：
    启用状态：按需启用
    验证方式：Double Submit Cookie
    豁免路径：/healthz, /login, /public/*

注意：
  - Orion 使用 HttpOnly Cookie 存储 JWT Token，不属于传统 CSRF 攻击场景
  - SameSite=Strict 进一步防止跨站请求携带 Cookie
  - 如果未来引入 Session Cookie 认证，需启用 CSRF 防护
```

**IP 访问控制**：
```yaml
IP 黑名单/白名单：
  - 白名单模式：仅允许白名单IP访问
  - 黑名单模式：禁止黑名单IP访问
  - 默认策略：允许所有

配置示例：
  - 管理后台：仅内网IP可访问
  - API 接口：允许全部，限流保护
  - 敏感操作：需 IP 在白名单

IP 范围格式：
  - 单IP：192.168.1.1
  - CIDR：192.168.1.0/24
  - 范围：192.168.1.1-192.168.1.254
```

**API 请求签名**：
```yaml
防篡改签名机制：
  - 算法：HMAC-SHA256
  - 签名内容：method + path + timestamp + nonce + body
  - 时间戳有效期：5分钟
  - Nonce 唯一性：防重放攻击

请求示例：
  Headers:
    X-Signature: HMAC-SHA256(...)
    X-Timestamp: 1704067200
    X-Nonce: abc123xyz

签名计算：
  signature = HMAC-SHA256(
    secret,
    POST|/api/v1/pipeline|1704067200|abc123xyz|{"name":"test"}
  )
```

**最小权限原则**：
```yaml
权限分配原则：
  - 默认拒绝：所有新增权限需申请
  - 最小必要：仅授予完成任务所需最小权限
  - 权限时效：临时权限自动过期
  - 定期审计：每季度审查权限合理性

权限审批流程：
  1. 申请人说明使用场景
  2. 直属领导审批
  3. 安全团队复核（敏感权限）
  4. 权限生效，定期回顾
```

### 3.15 WebSocket 实时通信规范

**连接建立**：
```javascript
// 建立 WebSocket 连接
const ws = new WebSocket('wss://orion.internal/ws');

// 认证
ws.onopen = () => {
  ws.send(JSON.stringify({
    type: 'auth',
    token: 'Bearer eyJ...'
  }));
};
```

**订阅频道**：
```javascript
ws.send(JSON.stringify({
  type: 'subscribe',
  channels: [
    'pipeline:run:pl-123',
    'stage:pl-123:build',
    'approval:user-456'
  ]
}));
```

**消息类型**：
| 类型 | 说明 |
|------|------|
| `pipeline_update` | 流水线状态更新 |
| `stage_log` | Stage 日志流 |
| `notification` | 通知推送 |
| `ping/pong` | 心跳 |

**心跳机制**：
```
客户端 → 服务端：ping (每 30 秒)
服务端 → 客户端：pong
超时处理: 60 秒无心跳 → 关闭连接
```

### 3.16 错误处理与错误码规范

**统一错误类**：
```typescript
class OrionError extends Error {
  code: string;           // 错误码
  statusCode: number;     // HTTP 状态码
  details?: any;          // 详细错误信息
  requestId?: string;     // 请求追踪 ID
}
```

**错误码体系**（字符串三级格式 `LEVEL.CATEGORY.SEQUENCE`）：

| 前缀 | 分类 | 说明 |
|------|------|------|
| `SYS.5xx.xxx` | 系统级错误 | 服务内部错误、超时、不可用 |
| `CLIENT.4xx.xxx` | 客户端级错误 | 参数无效、认证过期、权限不足 |
| `BIZ.{MODULE}.xxx` | 业务级错误 | 租户/Pipeline/用户等模块业务异常 |

> **对应代码**: `orion-platform-service/src/types/error-codes.ts`

**详细错误码定义**：
```typescript
// ========== 系统级错误 SYS.xxx ==========
SYS_INTERNAL_ERROR:       'SYS.500.001',  // 内部服务器错误
SYS_SERVICE_UNAVAILABLE:  'SYS.503.001',  // 服务不可用
SYS_TIMEOUT:              'SYS.504.001',  // 请求超时

// ========== 客户端级错误 CLIENT.xxx ==========
CLIENT_PARAM_INVALID:       'CLIENT.400.001',  // 无效参数
CLIENT_PARAM_MISSING:       'CLIENT.400.002',  // 缺少必填参数
CLIENT_AUTH_EXPIRED:        'CLIENT.401.001',  // Token 过期
CLIENT_PERMISSION_DENIED:   'CLIENT.403.001',  // 无权限
CLIENT_RESOURCE_NOT_FOUND:  'CLIENT.404.001',  // 资源不存在
CLIENT_CONFLICT:            'CLIENT.409.001',  // 冲突
CLIENT_RATE_LIMITED:        'CLIENT.429.001',  // 请求限流

// ========== 业务级错误 BIZ.{MODULE}.xxx ==========
BIZ_TENANT_NOT_FOUND:     'BIZ.TENANT.001',   // 租户不存在
BIZ_TENANT_NAME_EXISTS:   'BIZ.TENANT.002',   // 租户名已存在
BIZ_TENANT_QUOTA_EXCEEDED:'BIZ.TENANT.003',   // 租户配额超限
BIZ_TENANT_STATUS_INVALID:'BIZ.TENANT.004',   // 租户状态异常
BIZ_PIPELINE_NOT_FOUND:       'BIZ.PIPELINE.001',  // Pipeline 不存在
BIZ_PIPELINE_RUN_FAILED:      'BIZ.PIPELINE.002',  // Pipeline 运行失败
BIZ_PIPELINE_STAGE_NOT_FOUND: 'BIZ.PIPELINE.003',  // Stage 不存在
BIZ_USER_NOT_FOUND:      'BIZ.USER.001',   // 用户不存在
BIZ_USER_EMAIL_EXISTS:   'BIZ.USER.002',   // 邮箱已存在
BIZ_AUTH_TOKEN_INVALID:  'BIZ.AUTH.001',   // Token 无效
BIZ_AUTH_TOKEN_EXPIRED:  'BIZ.AUTH.002',   // Token 过期
BIZ_OPERATION_FAILED:    'BIZ.COMMON.001', // 操作失败
BIZ_RESOURCE_CONFLICT:   'BIZ.COMMON.002', // 资源冲突
```

**错误响应格式**：
```json
{
  "code": "BIZ.PIPELINE.001",
  "message": "Pipeline 不存在",
  "statusCode": 404,
  "details": {
    "resource": "pipeline",
    "id": "pl-123"
  },
  "meta": {
    "requestId": "req-abc123",
    "timestamp": "2026-05-21T10:00:00Z"
  }
}
```

**前端错误码分类工具**：
```typescript
isClientError(code):   code.startsWith('CLIENT.')
isSystemError(code):   code.startsWith('SYS.')
isBusinessError(code): code.startsWith('BIZ.')
```

### 3.17 前后端交互规范

**请求交互流程**：
```
前端请求 → API Gateway → 路由匹配 → 中间件 → Controller → Service → Repository → DB
     ↑                                                                      │
     └──────────────────── Response ←──────────────────────────────────────┘
```

**请求头规范**：
| Header | 必填 | 说明 |
|--------|------|------|
| Authorization | 是（当前） | `Bearer <token>`，前端通过 `authStore.getToken()` 获取并设置。迁移后将废弃，改为 Cookie 自动携带 |
| X-Tenant-ID | 是 | 租户 ID，从 `localStorage.getItem('tenant_id')` 读取 |
| X-Request-ID | 否 | 请求追踪 ID（自动生成） |
| X-Correlation-ID | 否 | 链路追踪 ID |
| Accept | 是 | application/json |
| Content-Type | 是 | application/json |

> **[当前实现]**：`api/client.ts` 拦截器通过 `useAuthStore.getState().getToken()` 获取 token，
> 设置 `config.headers.Authorization = 'Bearer ${token}'`。`authStore` 内部使用 `localStorage` 存储 token。
>
> **[迁移目标]**：后端通过 `Set-Cookie` 设置 HttpOnly Cookie，前端无需手动设置 `Authorization` 请求头。
> 详见 3.14 节 Token 存储迁移计划。

**请求格式**：
```typescript
// GET 请求
GET /api/v1/pipelines?page=1&page_size=20&status=running

// POST 请求
POST /api/v1/pipelines
Content-Type: application/json
{
  "name": "my-pipeline",
  "stages": [...]
}

// 文件上传
POST /api/v1/artifacts/upload
Content-Type: multipart/form-data
```

**响应格式**：
```typescript
// 成功响应
{
  "code": 0,
  "message": "success",
  "data": { ... },
  "meta": {
    "requestId": "req-abc123",
    "timestamp": "2026-05-21T10:00:00Z"
  }
}

// 分页响应
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [...],
    "pagination": {
      "total": 100,
      "page": 1,
      "pageSize": 20,
      "totalPages": 5
    }
  }
}

// 错误响应（使用统一错误码体系）
{
  "code": "CLIENT.404.001",
  "message": "资源不存在",
  "statusCode": 404,
  "details": {
    "resource": "pipeline",
    "id": "pl-123"
  },
  "meta": {
    "requestId": "req-abc123",
    "timestamp": "2026-05-21T10:00:00Z"
  }
}
```

**请求超时规范**：
| 请求类型 | 超时时间 |
|----------|----------|
| 简单查询 | 5s |
| 复杂查询 | 10s |
| 文件上传 | 60s |
| 文件下载 | 120s |
| 批量操作 | 30s |

**重试策略**：
- GET 请求：可重试（非幂等）
- POST/PUT/DELETE：需根据业务判断（幂等性）
- 重试间隔：1s → 2s → 4s（指数退避）
- 最大重试：3 次

### 3.18 路由规范

**后端路由注册**：
```typescript
// api/routes.ts
export async function registerRoutes(app: Fastify) {
  // 路由前缀
  const prefix = '/api/v1';

  // 路由模块
  app.register(pipelineRoutes, { prefix: `${prefix}/pipelines` });
  app.register(artifactRoutes, { prefix: `${prefix}/artifacts` });
  app.register(userRoutes, { prefix: `${prefix}/users` });
}
```

**路由文件规范**：
```typescript
// pipeline-routes.ts
export default async function pipelineRoutes(fastify: Fastify) {
  // 路由前缀: /api/v1/pipelines

  // 列表
  fastify.get('/', {
    schema: {
      querystring: PipelineListQuerySchema,
      response: { 200: PipelineListResponseSchema }
    }
  }, pipelineController.list);

  // 详情
  fastify.get('/:id', {
    schema: {
      params: PipelineIdSchema,
      response: { 200: PipelineResponseSchema }
    }
  }, pipelineController.getById);

  // 创建
  fastify.post('/', {
    schema: {
      body: CreatePipelineSchema,
      response: { 201: PipelineResponseSchema }
    }
  }, pipelineController.create);

  // 更新
  fastify.put('/:id', {
    schema: {
      params: PipelineIdSchema,
      body: UpdatePipelineSchema,
      response: { 200: PipelineResponseSchema }
    }
  }, pipelineController.update);

  // 删除
  fastify.delete('/:id', {
    schema: {
      params: PipelineIdSchema,
      response: { 204: null }
    }
  }, pipelineController.delete);
}
```

**路由命名规范**：
| HTTP 方法 | 路径 | 说明 |
|-----------|------|------|
| GET | /resources | 列表查询 |
| GET | /resources/:id | 详情查询 |
| POST | /resources | 创建资源 |
| PUT | /resources/:id | 完整更新 |
| PATCH | /resources/:id | 部分更新 |
| DELETE | /resources/:id | 删除资源 |
| POST | /resources/:id/action | 执行动作 |

**路由版本管理**：
```typescript
// URL 版本
/api/v1/pipelines
/api/v2/pipelines

// Header 版本（可选）
Orion-API-Version: 1.0
```

### 3.19 微服务规范

**服务间通信**：
```typescript
// HTTP 调用（同步）
const result = await fetch('http://orion-pipeline-svc/api/v1/runs', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'X-Tenant-ID': tenantId
  },
  body: JSON.stringify(payload)
});

// 消息队列（异步）
await eventBus.publish('pipeline.started', {
  pipelineId: 'pl-123',
  runId: 'run-456',
  tenantId: 't-001'
});
```

**服务注册与发现**：
```yaml
# 服务元数据
service:
  name: orion-pipeline-svc
  version: 1.0.0
  port: 3001
  endpoints:
    - /api/v1/pipelines
    - /api/v1/runs
    - /healthz
  dependencies:
    - orion-artifact-svc
    - orion-notify-svc
```

**服务健康检查**：
```typescript
// /healthz 端点
app.get('/healthz', async () => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    checks: {
      database: await db.ping(),
      redis: await redis.ping(),
      external: await checkExternal()
    }
  };
  return health;
});
```

**服务降级策略**：
| 服务 | 降级方案 |
|------|----------|
| 核心服务 | 返回缓存数据 |
| 非核心服务 | 返回空列表/默认值 |
| 第三方服务 | 使用本地容错数据 |

### 3.20 子应用接入规范（Orion-MF）

> Orion-MF 是 Orion 自研微前端框架，已替换 wujie。使用 Shadow DOM 实现样式隔离。

**主应用配置**（`orion-frontend/src/microfront/apps.ts`）：
```typescript
// 子应用配置（从 subappStore 动态读取）
export interface SubAppConfig {
  key: string;                    // 子应用唯一标识
  name: string;                   // 显示名称
  path: string;                   // 路由前缀，如 '/dba/*'
  url: string;                    // remoteEntry 地址
  container: string;              // 容器选择器，如 '#app-dba'
  cssIsolation: 'shadow-dom' | 'scoped-css' | 'none';
  enabled: boolean;
  keepAlive: boolean;
  preload: boolean;
}
```

**路由组件**（`orion-frontend/src/components/SubAppRouteMF/index.tsx`）：
```typescript
import { loadSubApp, getSubApp, destroySubApp } from '@orion-mf/core';

// 加载子应用
const instance = await loadSubApp({
  key: appKey,
  name: mfConfig.name,
  remoteEntry: mfConfig.remoteEntry,
  cssIsolation: mfConfig.cssIsolation,  // shadow-dom 隔离
  errorBoundary: true,
});

// 挂载到容器
containerRef.current.appendChild(instance.root);

// 注入认证状态到子应用
(window as any).$orion = {
  token,
  tenantId,
  user,
  getApiBase: () => '/api/v1',
};
```

**KeepAlive 场景**：
- `keepAlive: true` 的子应用（如 knowledge），切换路由时不销毁实例
- 再次访问时复用已有实例，避免重复加载
- 由 `SubAppRouteMF` 的 `instanceRef` 管理复用逻辑

**子应用通信**：
```typescript
// 主应用 -> 子应用：通过 window.$orion 传递
(window as any).$orion = { token, tenantId, user, getApiBase };

// 子应用 -> 主应用：通过 CustomEvent
window.dispatchEvent(new CustomEvent('orion:subapp:event', { detail }));
```

**样式隔离**：
| 模式 | 说明 | 适用场景 |
|------|------|---------|
| `shadow-dom` | Shadow DOM 完全隔离 | Vue/React 子应用 |
| `scoped-css` | CSS 作用域选择器 | 简单样式隔离 |
| `none` | 无隔离 | 与主应用共享主题 |

### 3.21 对外接口规范（Open API）

**接口安全要求**：
```yaml
# API 认证
authentication:
  type: OAuth 2.0 / API Key / JWT
  
# 限流配置
rateLimit:
  default: 100 req/min
  authenticated: 1000 req/min
  tier_premium: 10000 req/min

# CORS 配置
cors:
  allowedOrigins:
    - https://orion.example.com
    - https://app.example.com
  allowedMethods: [GET, POST, PUT, DELETE]
  allowedHeaders: [Authorization, Content-Type]
  maxAge: 86400
```

**OpenAPI 定义**：
```yaml
# openapi.yaml
openapi: 3.0.0
info:
  title: Orion Platform API
  version: 1.0.0
  description: AI-driven DevOps Platform API

servers:
  - url: https://api.orion.example.com/api/v1
    description: Production
  - url: https://staging-api.orion.example.com/api/v1
    description: Staging

paths:
  /pipelines:
    get:
      summary: List pipelines
      operationId: listPipelines
      parameters:
        - $ref: '#/components/parameters/tenantId'
        - $ref: '#/components/parameters/page'
        - $ref: '#/components/parameters/pageSize'
      responses:
        '200':
          $ref: '#/components/responses/PipelineList'

components:
  parameters:
    tenantId:
      name: X-Tenant-ID
      in: header
      required: true
      schema:
        type: string
  responses:
    PipelineList:
      description: Pipeline list response
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/PipelineList'
```

**SDK 生成规范**：
```bash
# 自动生成 SDK
openapi-generator generate \
  -i openapi.yaml \
  -g typescript-axios \
  -o src/api/generated \
  --additional-properties=npmName=@orion/api
```

**API 文档规范**：
| 要求 | 说明 |
|------|------|
| 文档地址 | /api/docs |
| Swagger UI | /api/swagger |
| ReDoc | /api/redoc |
| 版本管理 | 每个版本独立文档 |
| 变更记录 | 记录破坏性变更 |

---

## 四、前端代码规范

### 4.1 目录结构

```
orion-frontend/src/
├── api/                    # API 客户端 (101 个)
│   ├── pipelines.ts
│   ├── artifacts.ts
│   └── ...
├── pages/                  # 页面 (149 个)
│   ├── PipelineList/
│   ├── DashboardNew/
│   ├── ProductLine/
│   └── ...
├── components/             # 公共组件
├── tokens/                 # Design Tokens (12 个文件)
│   ├── colors.ts           # 色彩系统（含暗色模式色彩）
│   ├── radius.ts           # 圆角系统
│   ├── shadows.ts          # 阴影系统
│   ├── spacing.ts          # 间距系统
│   ├── animation.ts        # 动画时长与缓动曲线
│   ├── typography.ts       # 字体排版系统
│   ├── zIndex.ts           # 层级语义（10 级）
│   ├── breakpoints.ts      # 响应式断点（6 断点）
│   ├── theme.ts            # Ant Design 主题生成器
│   ├── injectTokens.ts     # CSS Variables 注入
│   ├── utils/              # 工具函数（WCAG 对比度等）
│   └── index.ts            # 统一导出
├── stores/                 # 状态管理 (Zustand)
├── router/                 # 路由配置
├── hooks/                  # 自定义 Hooks
└── utils/                  # 工具函数
```

### 4.2 Design Token 规范

**颜色系统** (`src/tokens/colors.ts`)：

| 用途 | 色值 | Token |
|------|------|-------|
| 主操作色 | `#3370E6` | `colors.primary[500]` |
| 成功 | `#52c41a` | `colors.success[500]` |
| 警告 | `#faad14` | `colors.warning[500]` |
| 错误 | `#f5222d` | `colors.error[500]` |
| 信息 | `#3a98f4` | `colors.info[500]` |
| 审批中（紫色） | `#7C5CFC` | `colors.purple[500]` |
| 中性灰文字 | `#8c8c8c` | `colors.neutral[500]` |

**圆角系统** (`src/tokens/radius.ts`)：

| 组件 | 圆角值 | Token |
|------|--------|-------|
| Card 卡片 | `12px` | `componentRadius.card` |
| Modal 弹窗 | `16px` | `componentRadius.modal` |
| Button 按钮 | `6px` | `componentRadius.button.md` |
| Input 输入框 | `6px` | `componentRadius.input` |
| Tag 标签 | `6px` | `componentRadius.tag` |
| Dropdown 下拉菜单 | `10px` | `componentRadius.dropdown` |
| 基础小圆角 | `4px` | `radius.xs` |

**阴影系统** (`src/tokens/shadows.ts`)：

| 组件 | 阴影值 |
|------|--------|
| Card 卡片 | `0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)` |
| Button 按钮 | `0 1px 2px rgba(0,0,0,0.04)` |
| Dropdown/Popover | `0 8px 24px rgba(0,0,0,0.12), 0 4px 8px rgba(0,0,0,0.06)` |
| Modal | `0 20px 60px rgba(0,0,0,0.15), 0 8px 20px rgba(0,0,0,0.08)` |

**间距系统** (`src/tokens/spacing.ts`)：

| 场景 | 间距值 | Token |
|------|--------|-------|
| Card 之间 | `16px` | `spacing.md` |
| 表单元素间距 | `12px` | `componentSpacing.formItemGap.sm` |
| 按钮组间距 | `8px` | `spacing.sm` |
| Section 标题与内容 | `16px` | `spacing.md` |
| Card 内边距 | `24px` | `componentSpacing.cardPadding.lg` |

**动画规范** (`src/tokens/animation.ts`)：

| 动画 | 时长 | 场景 |
|------|------|------|
| 淡入 | `200ms` | Tooltip、Modal 出现 |
| 滑入/切换 | `300ms` | Tab 内容切换 |
| 展开/折叠 | `300ms` | Collapse 面板 |
| 加载 | `400ms` | 页面首次加载 |

**缓动曲线** (`src/tokens/animation.ts`)：

| 曲线 | 值 | 场景 |
|------|-----|------|
| `linear` | `'linear'` | 旋转加载动画等匀速场景 |
| `easeInOut` | `'cubic-bezier(0.4, 0, 0.2, 1)'` | 大多数动画、页面切换 |
| `easeOut` | `'cubic-bezier(0, 0, 0.2, 1)'` | 弹窗/抽屉进入 |
| `easeIn` | `'cubic-bezier(0.4, 0, 1, 1)'` | 弹窗/抽屉退出 |
| `sharp` | `'cubic-bezier(0.4, 0, 0.6, 1)'` | 快速进入/退出 |
| `smooth` | `'cubic-bezier(0.25, 0.1, 0.25, 1)'` | 淡入淡出 |
| `bounce` | `'cubic-bezier(0.68, -0.55, 0.265, 1.55)'` | 特殊弹跳效果 |
| `spring` | `'cubic-bezier(0.175, 0.885, 0.32, 1.275)'` | 按钮点击反馈 |

**排版系统** (`src/tokens/typography.ts`)：

| 级别 | 字号 | 行高 | 字重 | 场景 |
|------|------|------|------|------|
| `h1` | `24px` | `32px` | `600` | 页面大标题 |
| `h2` | `20px` | `28px` | `600` | 模块标题（8 大菜单统一） |
| `h3` | `18px` | `24px` | `600` | Section 标题 |
| `h4` | `16px` | `22px` | `600` | 卡片内标题 |
| `body` | `14px` | `22px` | `400` | 正文内容 |
| `bodySm` | `13px` | `20px` | `400` | 辅助文字 |
| `caption` | `12px` | `18px` | `400` | 标注、时间戳 |

**Z-Index 层级** (`src/tokens/zIndex.ts`)：

| 层级 | 值 | 场景 |
|------|-----|------|
| `base` | `0` | 默认层 |
| `dropdown` | `100` | 下拉菜单 |
| `sticky` | `200` | 吸顶元素 |
| `fixed` | `300` | 固定定位 |
| `overlay` | `400` | 遮罩层 |
| `drawer` | `500` | 抽屉 |
| `modal` | `600` | 弹窗 |
| `popover` | `700` | 气泡卡片 |
| `tooltip` | `800` | 文字提示 |
| `max` | `9999` | 最高层级（紧急场景） |

**响应式断点** (`src/tokens/breakpoints.ts`)：

| 断点 | 宽度 | 行为 |
|------|------|------|
| `xs` | `< 576px` | 移动端，单列布局 |
| `sm` | `≥ 576px` | 平板竖屏，双列布局 |
| `md` | `≥ 768px` | 平板横屏，表格简化 |
| `lg` | `≥ 1200px` | 桌面端，完整功能 |
| `xl` | `≥ 1600px` | 大屏，扩展布局 |
| `xxl` | `≥ 2000px` | 超宽屏，三列布局 |

**组件尺寸规范**：

| 属性 | 值 | 说明 |
|------|-----|------|
| 组件默认高度 | `36px` | `componentSize`，区别于传统 32px |
| 表单最大宽度 | `700px` | 表单内容居中 |
| 表格行高 | `48px` | 标准行高 |
| 表格悬停行背景 | `#EBF0FB` | `colors.primary[50]` |
| 输入框聚焦外发光 | `0 0 0 2px rgba(51,112,230,0.1)` | 蓝色光晕 |

### 4.2.1 组件状态样式规范

**按钮状态**：
| 状态 | 背景色 | 文字色 | 边框 | 阴影 |
|------|--------|--------|------|------|
| Default | #3370E6 | #fff | none | 0 1px 2px rgba(0,0,0,0.04) |
| Hover | #2B5DD6 | #fff | none | 0 2px 4px rgba(0,0,0,0.08) |
| Active | #1F4BB5 | #fff | none | 0 1px 2px rgba(0,0,0,0.04) |
| Disabled | #d9d9d9 | #8c8c8c | none | none |
| Loading | rgba(51,112,230,0.8) | rgba(255,255,255,0.6) | none | none |

**输入框状态**：
| 状态 | 边框 | 阴影 | 背景 |
|------|------|------|------|
| Default | 1px solid #d9d9d9 | none | #fff |
| Focus | 1px solid #3370E6 | 0 0 0 2px rgba(51,112,230,0.1) | #fff |
| Error | 1px solid #f5222d | 0 0 0 2px rgba(245,34,45,0.1) | #fff |
| Disabled | 1px solid #f0f0f0 | none | #f5f5f5 |

### 4.2.2 动效缓动曲线

```typescript
// 位于 tokens/animation.ts — 与代码完全对齐
const easing = {
  // 匀速（用于简单过渡，如旋转加载动画）
  linear: 'linear',
  // 标准缓动（用于大多数动画，等同于 easeInOut）
  easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
  // 减速（用于进入动画）
  easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
  // 加速（用于退出动画）
  easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
  // 锐利（用于快速进入/退出）
  sharp: 'cubic-bezier(0.4, 0, 0.6, 1)',
  // 平滑（用于淡入淡出）
  smooth: 'cubic-bezier(0.25, 0.1, 0.25, 1)',
  // 弹性（用于弹跳效果）
  bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
  // 弹簧（用于轻微回弹）
  spring: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)'
};
```

**使用场景**：
| 缓动函数 | 场景 |
|----------|------|
| `easeInOut` | 大多数动画、页面切换 |
| `easeOut` | 弹窗/抽屉进入 |
| `easeIn` | 弹窗/抽屉退出 |
| `spring` | 按钮点击反馈 |
| `bounce` | 特殊弹跳效果 |

### 4.2.3 加载状态规范

**骨架屏使用场景**：
- 页面级加载：整页内容骨架
- 卡片级加载：单卡片区域骨架
- 表格级加载：行骨架循环

**骨架屏样式**：
```typescript
const skeletonStyle = {
  background: 'linear-gradient(90deg, #f0f0f0 25%, #e8e8e8 50%, #f0f0f0 75%)',
  backgroundSize: '200% 100%',
  animation: 'shimmer 1.5s infinite'
};
```

**加载指示器**：
- 简单加载：`<Spin />` 居中显示
- 按钮加载：`loading` 属性
- 列表加载：骨架屏优于 Loading 文字

### 4.2.4 错误状态规范

**错误边界组件**：
```typescript
<ErrorBoundary fallback={<ErrorFallback />}>
  <App />
</ErrorBoundary>
```

**网络错误状态**：
| 错误类型 | 显示内容 |
|----------|----------|
| 无网络 | 插画 + 「网络连接失败」+ 重试按钮 |
| 超时 | 「请求超时」+ 重试按钮 |
| 服务端错误 | 「服务异常」+ 错误码 + 重试按钮 |

**Form 错误提示**：
- 错误信息显示在字段下方
- 红色边框高亮错误字段
- 错误提示文字使用 `colors.error[500]`

### 4.2.5 滚动行为规范

```css
/* 全局滚动行为 */
html {
  scroll-behavior: smooth;
}

/* 滚动锚点 */
.scroll-anchor {
  scroll-margin-top: 80px;
}

/* 惯性滚动（移动端） */
.overflow-auto {
  -webkit-overflow-scrolling: touch;
}
```

### 4.3 API 客户端规范

**请求拦截器**：
```typescript
// api/client.ts — 实际代码验证通过
import axios from 'axios';
import { useAuthStore } from '@/stores/authStore';

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use(async (config) => {
  // 当前实现：从 authStore 读取 token，设置 Authorization header
  // authStore 内部通过 localStorage 存储 token（迁移中）
  const authStore = useAuthStore.getState();
  const token = await authStore.getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // 租户 ID：从 localStorage 读取（迁移中）
  const tenantId = localStorage.getItem('tenant_id');
  if (tenantId) {
    config.headers['X-Tenant-ID'] = tenantId;
  }

  return config;
});

// [迁移目标] 完成后改为 Cookie 自动携带，移除 Authorization header 设置
// 详见 3.14 节 Token 存储迁移计划
```

**响应拦截器**（基于 `api/client.ts` 实际实现）：
```typescript
// api/client.ts — 实际代码验证通过
// 包含 401 自动刷新 Token、请求排队、错误分类处理

// 401 响应时的刷新队列 — 防止并发请求同时触发多次刷新
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: Error) => void;
}> = [];

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401 && !originalRequest._retry) {
      // 排除 auth 相关请求，防止无限循环
      if (originalRequest.url?.includes('/v1/auth/')) {
        useAuthStore.getState().logout();
        return Promise.reject(error);
      }

      // 排队机制：已有请求在刷新 token 时，将当前请求加入队列
      // 刷新成功后重试所有排队请求
      // 详见 api/client.ts 完整实现
    }

    // 错误分类处理
    const status = error.response?.status;
    if (status === 403) console.error('403 Forbidden: 没有权限');
    if (status === 404) console.error('404 Not Found: 资源不存在');
    if (status >= 500) console.error('5xx Server Error: 服务器错误');

    return Promise.reject(error);
  }
);
```

**API 客户端封装**：
```typescript
// api/pipeline.ts
import { apiClient } from './client';
import type { Pipeline, PipelineListParams, PipelineListResponse } from '@/types';

export const pipelineApi = {
  // 获取流水线列表
  list: (params: PipelineListParams) =>
    apiClient.get<PipelineListResponse>('/api/v1/pipelines', { params }),

  // 获取流水线详情
  get: (id: string) =>
    apiClient.get<Pipeline>(`/api/v1/pipelines/${id}`),

  // 创建流水线
  create: (data: Partial<Pipeline>) =>
    apiClient.post<Pipeline>('/api/v1/pipelines', data),

  // 更新流水线
  update: (id: string, data: Partial<Pipeline>) =>
    apiClient.put<Pipeline>(`/api/v1/pipelines/${id}`, data),

  // 删除流水线
  delete: (id: string) =>
    apiClient.delete(`/api/v1/pipelines/${id}`),

  // 执行流水线
  run: (id: string, params?: { branch?: string }) =>
    apiClient.post(`/api/v1/pipelines/${id}/run`, null, { params }),

  // 停止流水线
  stop: (id: string, runId: string) =>
    apiClient.post(`/api/v1/pipelines/${id}/runs/${runId}/stop`),
};
```

**Mock 数据规范**：
```typescript
// mock/pipeline.ts
import { rest } from 'msw';

// Mock 延迟配置
const MOCK_DELAY = 300;

export const pipelineMocks = [
  // 列表接口 Mock
  rest.get('/api/v1/pipelines', (req, res, ctx) => {
    const { page = 1, pageSize = 10 } = req.params;
    return res(
      ctx.delay(MOCK_DELAY),
      ctx.json({
        code: 0,
        message: 'success',
        data: {
          list: [
            {
              id: 'pl-001',
              name: 'CI Pipeline',
              status: 'active',
              createdAt: '2026-05-22T10:00:00Z',
            },
          ],
          total: 100,
          page: Number(page),
          pageSize: Number(pageSize),
        },
      })
    );
  }),

  // 单个接口 Mock
  rest.get('/api/v1/pipelines/:id', (req, res, ctx) => {
    return res(
      ctx.delay(MOCK_DELAY),
      ctx.json({
        code: 0,
        message: 'success',
        data: {
          id: req.params.id,
          name: 'CI Pipeline',
          status: 'active',
        },
      })
    );
  }),
];
```

**API 错误码处理**：

> 前端错误码与后端统一，详见「3.16 错误处理与错误码规范」（第 2272-2331 行）。
> 前端根据后端错误码前缀分类处理：

| 错误码前缀 | 前端行为 | 示例 |
|-----------|---------|------|
| `CLIENT.400.*` | 表单校验提示 | `message.error(data.message)` |
| `CLIENT.401.*` | 跳转登录页 | 401 → `/login` |
| `CLIENT.403.*` | Toast 提示无权 | `message.error(data.message)` |
| `CLIENT.404.*` | Toast + 空状态 | `message.error(data.message)` |
| `CLIENT.409.*` | Toast 冲突提示 | `message.error(data.message)` |
| `CLIENT.429.*` | Toast + 自动重试 | `message.error(data.message)` |
| `SYS.*` | Toast 系统错误 + 重试按钮 | `message.error('系统异常，请重试')` |
| `BIZ.*` | Toast 业务提示 | `message.error(data.message)` |

### 4.4 前端状态管理规范

**状态管理选择**：
| 场景 | 方案 | 说明 |
|------|------|------|
| 全局用户状态 | Zustand | 用户信息、Token、主题 |
| 页面级状态 | React useState | 局部表单、临时状态 |
| 服务端数据 | React Query | 自动缓存、背景刷新 |
| 表单状态 | React Hook Form | 表单验证、提交 |

**Zustand 最佳实践**：
```typescript
// stores/userStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UserState {
  user: User | null;
  token: string | null;
  setUser: (user: User) => void;
  setToken: (token: string) => void;
  logout: () => void;
}

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      setUser: (user) => set({ user }),
      setToken: (token) => set({ token }),
      logout: () => set({ user: null, token: null }),
    }),
    { name: 'orion-user' }
  )
);
```

**状态隔离原则**：
- 组件内部状态不提升到全局
- 跨页面共享状态才使用全局 Store
- 敏感信息不存储在 LocalStorage

**缓存策略**：
```typescript
// 使用 React Query 进行服务端状态缓存
const { data, isLoading } = useQuery({
  queryKey: ['pipelines'],
  queryFn: () => api.getPipelines(),
  staleTime: 5 * 60 * 1000, // 5分钟不过期
  cacheTime: 30 * 60 * 1000, // 30分钟清理
  refetchOnWindowFocus: false,
});
```

### 4.5 前端交互审查规则

> 每次编写或修改前端组件后，必须通过以下审查：

**逐元素交互链审查**：

| 检查项 | 要求 |
|--------|------|
| 可操作元素有无交互？ | 每个按钮/列表项必须有 onClick/onChange |
| 操作后有无反馈？ | 成功 `message.success`，失败 `message.error` |
| 有无 loading 状态？ | 异步操作必须有 loading/disabled |
| 有无空状态引导？ | 列表为空时 Empty + 引导按钮 |

**逐字段读写状态审查**：

| 检查项 | 要求 |
|--------|------|
| 字段是可编辑还是只读？ | 明确标注 |
| 有无校验规则？ | 必填项有 `rules` |
| 修改后如何保存？ | 必须有保存按钮，调用对应 update API |
| 保存失败如何提示？ | catch 错误并 `message.error` |

**CRUD 完整性审查**：

| 操作 | 必须有 |
|------|--------|
| Create | 创建入口（按钮/弹窗） |
| Read | 列表 + 详情查看 |
| Update | 编辑入口 + 编辑表单 + 保存按钮 |
| Delete | 删除按钮 + 二次确认 |

**场景逆向验证**（每个功能必须验证）：
```
场景示例："把审批节点的审批人从张三改成李四"
1. 找到节点 → 有编辑入口吗？
2. 打开编辑 → 有审批人输入框吗？
3. 修改值 → 有保存按钮吗？
4. 点击保存 → 调了 updateWorkflow 吗？
5. 保存成功 → 有 success 提示吗？界面刷新了吗？
6. 保存失败 → 有 error 提示吗？表单值保留了吗？
```

**反模式清单**（禁止出现）：

| 反模式 | 问题 | 正确做法 |
|--------|------|---------|
| Drawer/Modal 内全部 Descriptions 只读 | 用户无法编辑 | 可编辑字段用 Form.Item + Input |
| 只有查看操作无编辑按钮 | 改不了 | 增加编辑按钮 + 编辑模式 |
| 操作后无 message 提示 | 用户不知道成功/失败 | 每个异步操作加 success/error |
| 按钮无 loading/disabled | 可重复点击 | 异步操作时 disabled + loading |
| 空数据只写 Empty 无引导 | 用户不知道怎么开始 | Empty + 引导按钮 |
| 表单无提交按钮 | 改了无法保存 | 底部固定保存按钮 |

**空状态规范**：
- 使用 Ant Design `Empty` 组件
- 配合引导文字或操作按钮
- 不使用纯空白占位

**响应式断点规范**：

| 屏幕宽度 | 行为 |
|----------|------|
| `>= 1200px` | 完整布局，表格显示所有列 |
| `>= 768px` | 隐藏次要列，表单宽度不变 |
| `< 768px` | Tab 切换为下拉，表格改为卡片列表 |

**暗色模式配色**：
- 标题：`rgba(255,255,255,0.85)`
- 副标题：`rgba(255,255,255,0.45)`

### 4.6 无障碍访问规范 (a11y)

> P0 级规范，确保所有用户（包括残障人士）能正常使用系统

**ARIA 规范**：
```typescript
// 按钮
<button aria-label="关闭" aria-describedby="modal-desc">
  <CloseIcon />
</button>

// 输入框
<input
  aria-label="用户名"
  aria-required="true"
  aria-invalid={!!error}
  aria-describedby="username-help"
/>

// 模态框
<div
  role="dialog"
  aria-modal="true"
  aria-labelledby="modal-title"
  aria-describedby="modal-desc"
>
```

**键盘导航**：
| 操作 | 按键 | 说明 |
|------|------|------|
| 焦点移动 | Tab / Shift+Tab | 顺序移动焦点 |
| 激活 | Enter / Space | 触发按钮/链接 |
| 关闭 | Escape | 关闭弹窗/下拉 |
| 选择 | 上下箭头 | 菜单/选择器导航 |

**焦点管理**：
- 模态框打开时：焦点锁定在模态框内
- 模态框关闭时：焦点恢复到触发元素
- 焦点样式：使用 `focus-visible` 和主题色高亮

**颜色对比度**：
- 文本与背景对比度 >= 4.5:1 (WCAG AA)
- 大文本对比度 >= 3:1
- 交互元素有明显焦点指示

### 4.7 性能优化规范

**首屏性能指标**：
| 指标 | 目标值 | 说明 |
|------|--------|------|
| FCP (首次内容绘制) | < 1.8s | 首屏渲染完成 |
| LCP (最大内容绘制) | < 2.5s | 核心内容渲染 |
| TTI (可交互时间) | < 3.8s | 可响应用户操作 |
| TBT (总阻塞时间) | < 200ms | 主线程阻塞 |

**代码分割**：
```typescript
// 路由级分割
const PipelineList = lazy(() => import('./pages/PipelineList'));
const PipelineDetail = lazy(() => import('./pages/PipelineDetail'));

// 组件级分割
const LargeTable = lazy(() => import('./components/LargeTable'));
```

**图片优化**：
```typescript
// 懒加载
<img loading="lazy" src={src} />

// WebP 格式
<picture>
  <source srcSet={webpSrc} type="image/webp" />
  <img src={jpgSrc} alt={alt} />
</picture>

// srcset 响应式
<img srcSet="img-320.jpg 320w, img-640.jpg 640w" />
```

**虚拟列表**：
```typescript
// 大数据列表使用虚拟滚动
import { FixedSizeList } from 'react-window';

<FixedSizeList
  height={400}
  itemCount={10000}
  itemSize={48}
>
  {Row}
</FixedSizeList>
```

**Bundle 监控**：
```json
// package.json
{
  "size-limit": [
    {
      "path": "dist/*.js",
      "limit": "500 KB"
    }
  ]
}
```

### 4.8 工程化规范

**构建命令规范**：
| 命令 | 用途 | 说明 |
|------|------|------|
| `npm run dev` | 本地开发 | 启动开发服务器，热更新 |
| `npm run build` | 生产构建 | 打包产物到 dist 目录 |
| `npm run preview` | 预览构建 | 本地预览生产构建产物 |
| `npm run type-check` | 类型检查 | 运行 tsc --noEmit |
| `npm run lint` | 代码检查 | 运行 ESLint |
| `npm run test` | 单元测试 | 运行 Vitest |
| `npm run test:e2e` | E2E 测试 | 运行 Playwright |

**环境变量规范**：
```typescript
// .env 文件结构
// 开发环境
VITE_API_BASE_URL=https://dev-api.orion.example.com
VITE_WS_URL=wss://dev-ws.orion.example.com
VITE_MOCK_ENABLED=false
VITE_ENABLE_DEBUG=false

// .env.production 生产环境
VITE_API_BASE_URL=https://api.orion.example.com
VITE_WS_URL=wss://ws.orion.example.com
VITE_MOCK_ENABLED=false
VITE_ENABLE_DEBUG=false

// 类型定义 env.d.ts
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_WS_URL: string;
  readonly VITE_MOCK_ENABLED: boolean;
  readonly VITE_ENABLE_DEBUG: boolean;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

**Vite 构建配置**：
```typescript
// vite.config.ts 核心配置
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {
    target: 'es2015',
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-antd': ['antd', '@ant-design/icons'],
          'vendor-utils': ['lodash', 'dayjs', 'axios'],
        },
      },
    },
    chunkSizeWarningLimit: 1000, // KB
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
```

**Prettier 配置**：
```json
// .prettierrc
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100,
  "bracketSpacing": true,
  "arrowParens": "avoid"
}
```

**EditorConfig**：
```ini
# .editorconfig
root = true

[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true
trim_trailing_whitespace = true

[*.{js,ts,tsx,json}]
indent_style = space
indent_size = 2

[*.md]
trim_trailing_whitespace = false
```

**Pre-commit Hooks**：
```bash
# .husky/pre-commit
npm run lint
npm run type-check
npm run test
```

**ESLint 规则**：
```javascript
// .eslintrc.js
module.exports = {
  rules: {
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unused-vars': 'error',
    'react-hooks/exhaustive-deps': 'warn'
  }
};
```

**Commit Message 规范**：
```
<type>(<scope>): <subject>

feat(pipeline): add retry mechanism
fix(artifact): resolve upload timeout
chore(deps): upgrade antd to 5.x
```

**类型推断**：
- 禁止使用 `any`，使用 `unknown` 代替
- 接口参数必须有类型定义
- 使用 `type` 定义联合类型和交叉类型

### 4.9 组件开发规范

**Props 命名**：
```typescript
interface ButtonProps {
  // 事件处理
  onClick?: () => void;
  onChange?: (value: string) => void;

  // 状态
  loading?: boolean;
  disabled?: boolean;

  // 样式
  size?: 'small' | 'middle' | 'large';
  variant?: 'primary' | 'secondary';
}
```

**组件测试**：
```typescript
// Button.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';

test('renders button with text', () => {
  render(<Button>Click me</Button>);
  expect(screen.getByText('Click me')).toBeInTheDocument();
});

test('calls onClick when clicked', () => {
  const handleClick = vi.fn();
  render(<Button onClick={handleClick}>Click me</Button>);
  fireEvent.click(screen.getByText('Click me'));
  expect(handleClick).toHaveBeenCalled();
});
```

### 4.10 页面标题规范（续）

**副标题/描述样式**：
| 属性 | 规范值 |
|------|--------|
| 组件 | `Typography.Text` |
| 字号 | `14px` |
| 颜色 | `#8c8c8c` |

### 4.11 暗色模式规范

**暗色色彩定义** (位于 `tokens/colors.ts` 的 `colors.dark` 对象):
```typescript
// tokens/colors.ts - 暗色色彩定义（与代码完全对齐）
export const colors = {
  // ... 浅色模式色彩
  dark: {
    bg: {
      primary: '#141414',
      secondary: '#1f1f1f',
      tertiary: '#262626',
      elevated: '#434343',
    },
    text: {
      primary: '#ffffff',
      secondary: '#d9d9d9',
      tertiary: '#8c8c8c',
      disabled: '#595959',
    },
    border: {
      default: '#434343',
      light: '#262626',
      heavy: '#595959',
    },
    // 注意：dark 对象无 primary 属性。
    // 主操作色统一使用 colors.primary[500]，
    // 暗色模式下由 Ant Design darkAlgorithm 自动调亮。
  },
};
```

**主题配置生成** (位于 `tokens/theme.ts`):
```typescript
// tokens/theme.ts - Ant Design 主题配置
import { theme } from 'antd';
import { colors } from '@/tokens/colors';

export const getAntdThemeConfig = (mode: 'light' | 'dark') => {
  const isDark = mode === 'dark';
  return {
    algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
    token: {
      // 暗色模式下仍使用 primary[500]，Ant Design darkAlgorithm 会自动调整对比度
      colorPrimary: colors.primary[500],
      borderRadius: componentRadius.button.md,
    },
  };
};
```

**暗色模式切换实现**：
```typescript
// hooks/useDarkMode.ts
import { useState, useEffect } from 'react';
import { ConfigProvider } from 'antd';
import { getAntdThemeConfig } from '@/tokens/theme';

export const useDarkMode = () => {
  const [isDark, setIsDark] = useState(() => {
    const stored = sessionStorage.getItem('orion_theme');
    if (stored) return stored === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    document.body.classList.toggle('dark', isDark);
    sessionStorage.setItem('orion_theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  const toggleDark = () => setIsDark(!isDark);
  return { isDark, toggleDark };
};
```

**暗色模式组件适配**：
```typescript
// 使用 Ant Design ConfigProvider 统一切换主题
import { ConfigProvider } from 'antd';
import { getAntdThemeConfig } from '@/tokens/theme';

const App = () => {
  const { isDark } = useDarkMode();

  return (
    <ConfigProvider theme={getAntdThemeConfig(isDark ? 'dark' : 'light')}>
      <YourApp />
    </ConfigProvider>
  );
};
```

**暗色模式阴影调整**：
| 组件 | 暗色模式阴影 |
|------|-------------|
| Card 卡片 | `0 1px 3px rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.2)` |
| Modal | `0 20px 60px rgba(0,0,0,0.5), 0 8px 20px rgba(0,0,0,0.3)` |
| Dropdown/Popover | `0 8px 24px rgba(0,0,0,0.4)` |

### 4.13 页面标题规范

**主标题样式**：

| 属性 | 规范值 |
|------|--------|
| 标题级别 | `level={2}` |
| 字体大小 | `20px` |
| 字体粗细 | `600` (`fontWeight.semibold`) |
| 字体颜色 | `#1f1f1f` (`colors.neutral[900]`) |
| 底部间距 | `8px` (有副标题) / `16px` (无副标题) |

**图标规范**：

| 属性 | 规范值 |
|------|--------|
| 位置 | 标题文字左侧 |
| 间距 | `marginRight: 12px` |
| 颜色 | `colors.primary[500]` |

---

## 五、数据库规范

### 5.1 迁移文件规范

```
orion-platform-service/src/db/migrations/
├── 001_create_users.sql
├── 002_create_tenants.sql
├── ...
├── 207_*.sql
```

**迁移命名**: `NNN_<description>.sql` (NNN 为 3 位数字序号)

### 5.2 Repository 模式

30+ 服务已从 `Map()` Mock 存储迁移至 PostgreSQL Repository 模式：

```typescript
// 命名规范
class PipelineRepository {
  async findById(id: string): Promise<Pipeline | null>;
  async findAll(tenantId: string): Promise<Pipeline[]>;
  async create(pipeline: Pipeline): Promise<Pipeline>;
  async update(id: string, data: Partial<Pipeline>): Promise<Pipeline>;
  async delete(id: string): Promise<void>;
}
```

### 5.3 多租户隔离

**行级安全 (RLS)**：
```typescript
// 启用 RLS
await db.query(`
  ALTER TABLE pipelines ENABLE ROW LEVEL SECURITY;
  ALTER TABLE pipeline_runs ENABLE ROW LEVEL SECURITY;
  ALTER TABLE artifacts ENABLE ROW LEVEL SECURITY;
`);

// 创建租户隔离策略
await db.query(`
  -- pipelines 表策略
  CREATE POLICY tenant_isolation_pipelines ON pipelines
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));

  -- pipeline_runs 表策略
  CREATE POLICY tenant_isolation_runs ON pipeline_runs
  FOR ALL
  USING (
    tenant_id = current_setting('app.current_tenant_id', true)
    OR exists (
      select 1 from pipelines p
      where p.id = pipeline_runs.pipeline_id
      and p.tenant_id = current_setting('app.current_tenant_id', true)
    )
  );

  -- artifacts 表策略
  CREATE POLICY tenant_isolation_artifacts ON artifacts
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true));
`);
```

**TenantIsolationService 中间件**：
```typescript
// tenant-isolation.middleware.ts
import { FastifyRequest, FastifyReply } from 'fastify';

export async function tenantIsolationMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // 从 Token 或 Header 获取租户 ID
  const tenantId = request.headers['x-tenant-id'] as string
    || request.user?.tenantId
    || request.headers['x-forwarded-tenant-id'] as string;

  if (!tenantId) {
    // 公开接口跳过
    if (isPublicRoute(request.url)) {
      return;
    }
    return reply.status(401).send({
      code: 'CLIENT.401.001',
      message: '缺少租户信息',
    });
  }

  // 设置租户上下文
  request.tenantId = tenantId;

  // 设置数据库会话变量（供 RLS 使用）
  // 注意: SET LOCAL 仅在当前事务内有效，非事务请求中会失效
  // 改用 SET SESSION + 请求结束时 RESET
  try {
    await request.server.pg.query(
      `SET SESSION app.current_tenant_id = $1`,
      [tenantId]
    );
    // 在请求结束时清理（通过 onSend hook）
    reply.raw.on('finish', () => {
      request.server.pg.query(`RESET app.current_tenant_id`).catch(() => {});
    });
  } catch (error) {
    // 非 PostgreSQL 跳过
  }
}

// 判断是否为公开路由
function isPublicRoute(url: string): boolean {
  const publicPaths = [
    '/healthz',
    '/api/v1/auth/login',
    '/api/v1/auth/register',
    '/api/v1/public',
  ];
  return publicPaths.some(path => url.startsWith(path));
}
```

**每个查询自动注入 tenantId**：
```typescript
// Repository 基类自动注入
abstract class BaseRepository<T> {
  async findById(id: string): Promise<T | null> {
    const tenantId = this.getTenantId();

    return this.db.query(
      `SELECT * FROM ${this.tableName}
       WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
      [id, tenantId]
    );
  }

  async findAll(filters: Partial<T>): Promise<T[]> {
    const tenantId = this.getTenantId();
    const conditions = ['tenant_id = $1', 'deleted_at IS NULL'];
    const params: any[] = [tenantId];

    // 自动注入 tenant_id 过滤
    Object.entries(filters).forEach(([key, value], index) => {
      if (value !== undefined) {
        conditions.push(`${key} = $${index + 2}`);
        params.push(value);
      }
    });

    return this.db.query(
      `SELECT * FROM ${this.tableName} WHERE ${conditions.join(' AND ')}`,
      params
    );
  }

  private getTenantId(): string {
    // 从请求上下文或全局获取
    return (globalThis as any).__tenantId__ || 'default';
  }
}
```

### 5.4 表命名规范

**命名规则**：
| 规则 | 说明 | 示例 |
|------|------|------|
| 格式 | 小写 snake_case | pipeline_run |
| 复数 | 表名为复数名词 | pipelines（√） |
| 模块前缀 | 按业务模块添加前缀 | finops_cost_record |
| 关系表 | m:n 关系用 _rel 后缀 | pipeline_stage_rel |

**模块前缀映射**：
| 模块 | 前缀 | 示例表 |
|------|------|--------|
| pipeline | pipeline_ | pipelines, pipeline_runs, pipeline_stages |
| artifact | artifact_ | artifacts, artifact_versions |
| tenant | tenant_ | tenants, tenant_configs |
| user | user_ | users, user_roles |
| finops | finops_ | finops_costs, finops_budgets |

### 5.5 字段命名规范

**通用字段**：
| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | UUID | 主键 |
| tenant_id | UUID | 租户 ID |
| created_at | TIMESTAMPTZ | 创建时间（UTC） |
| updated_at | TIMESTAMPTZ | 更新时间（UTC） |
| created_by | UUID | 创建人 |
| updated_by | UUID | 更新人 |
| deleted_at | TIMESTAMPTZ | 软删除时间（可空） |

**布尔字段**：
| 字段名 | 类型 | 说明 |
|--------|------|------|
| is_deleted | BOOLEAN | 软删除标记 |
| is_active | BOOLEAN | 激活状态 |
| is_enabled | BOOLEAN | 启用状态 |
| is_system | BOOLEAN | 系统内置 |

**状态字段**：
| 字段名 | 类型 | 说明 |
|--------|------|------|
| status | VARCHAR(32) | 状态枚举 |
| state | VARCHAR(32) | 状态枚举 |
| result | VARCHAR(32) | 执行结果 |

### 5.6 主键设计规范

**主键类型选择**：
| 场景 | 推荐主键 | 原因 |
|------|----------|------|
| 分布式系统 | UUID (gen_random_uuid()) | 跨库唯一、无中心节点 |
| 单体应用 | BIGSERIAL | 性能好、占用小 |
| 高并发写入 | 分布式 ID (雪花算法) | 趋势递增、性能好 |

**主键命名**：统一使用 `id`

### 5.7 索引设计规范

**索引命名**：
```
idx_{表名}_{字段1}_{字段2}_...
示例：
  idx_pipelines_tenant_id
  idx_pipeline_runs_status_created_at
```

**复合索引顺序**：
- 等值条件字段在前
- 范围条件字段在后
- 选择性高的字段在前

### 5.8 数据类型规范

**字符串类型**：
| 场景 | 推荐类型 | 最大长度 |
|------|----------|----------|
| 固定枚举值 | VARCHAR(n) | n ≤ 32 |
| 短文本 | VARCHAR(255) | - |
| 中文本 | VARCHAR(1000) | - |
| 长文本 | TEXT | 无限制 |
| JSON 数据 | JSONB | - |

**时间类型**：
| 场景 | 推荐类型 | 说明 |
|------|----------|------|
| 带时区时间 | TIMESTAMPTZ | 存储 UTC，前端转换 |
| 日期 | DATE | 不需要时间 |

**数值类型**：
| 场景 | 推荐类型 | 范围 |
|------|----------|------|
| 主键 ID | BIGINT | - |
| 金额（精确） | DECIMAL(20,2) | 整数 18 位，小数 2 位 |
| 百分比 | DECIMAL(5,2) | 0-100 |
| 布尔值 | BOOLEAN | - |

### 5.9 约束设计规范

**NOT NULL 约束**：
- 主键字段：NOT NULL
- 外键字段：NOT NULL
- 业务必填字段：NOT NULL

**CHECK 约束**：
```sql
CHECK (status IN ('pending', 'running', 'success', 'failed'))
CHECK (percentage >= 0 AND percentage <= 100)
```

### 5.10 软删除规范

**推荐方案：deleted_at（时间戳）**
```sql
deleted_at TIMESTAMPTZ NULL,
-- 查询时自动过滤
WHERE deleted_at IS NULL
```
- 优势：可恢复、可查询历史删除记录、可记录删除时间
- 禁止使用 is_deleted 布尔型

### 5.11 事务隔离级别规范

**PostgreSQL 事务隔离级别**：
| 隔离级别 | 说明 | 脏读 | 不可重复读 | 幻读 | 使用场景 |
|----------|------|------|------------|------|----------|
| READ UNCOMMITTED | 未提交读 | 可能 | 可能 | 可能 | 不推荐 |
| READ COMMITTED | 已提交读 | 不可能 | 可能 | 可能 | **默认**，大多数业务 |
| REPEATABLE READ | 可重复读 | 不可能 | 不可能 | 可能 | 金融交易、库存 |
| SERIALIZABLE | 序列化 | 不可能 | 不可能 | 不可能 | 强一致性要求 |

**默认配置**：
```sql
-- 会话级设置
SET default_transaction_isolation = 'read committed';

-- 全局设置（postgresql.conf）
default_transaction_isolation = 'read committed'
```

**各隔离级别使用建议**：
```sql
-- READ COMMITTED（默认）：大多数业务场景
BEGIN;
SELECT * FROM orders WHERE status = 'pending';
COMMIT;

-- REPEATABLE READ：需要防止并发修改
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ;
SELECT balance FROM accounts WHERE id = 1 FOR UPDATE;
-- 扣款操作
UPDATE accounts SET balance = balance - 100 WHERE id = 1;
COMMIT;

-- SERIALIZABLE：强一致性要求（如财务对账）
BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE;
-- 执行对账操作
COMMIT;
```

**Java/Hibernate 配置**：
```java
// application.yml
spring:
  jpa:
    properties:
      hibernate:
        connection:
          isolation: TRANSACTION_READ_COMMITTED

// 编程式设置
EntityManager em = entityManagerFactory.createEntityManager();
em.getTransaction().begin();
// 使用默认隔离级别
```

### 5.12 审计字段规范

**必须字段**：
```sql
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
created_by UUID NOT NULL,
updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
updated_by UUID NOT NULL,
version INTEGER NOT NULL DEFAULT 1,  -- 乐观锁
```

---

## 六、文档管理规范

### 6.1 文档分层架构

```
Layer 0: 入口层
  ├── README.md (项目简介, 20 行以内)
  ├── INDEX.md (文档总索引)
  └── CHANGELOG.md (变更日志)

Layer 1: 决策层 (为什么做)
  └── docs/adr/ (架构决策记录, 纯 ADR)

Layer 2: 设计层 (做什么)
  ├── docs/architecture/ (系统架构)
  ├── docs/api/ (API 设计)
  ├── docs/db/ (数据库设计)
  └── docs/ui/ (UI/UX 设计)

Layer 3: 实现层 (怎么做)
  ├── docs/ai/ (AI 算法实现)
  ├── docs/frontend/ (前端实现)
  ├── docs/security/ (安全实现)
  └── docs/sre/ (运维实现)

Layer 4: 验证层 (做得怎样)
  ├── docs/qa/ (测试策略)
  ├── design-md/ (高保真设计稿)
  └── reports/ (评审报告)
```

### 6.2 文档命名规范

```
格式: {类型前缀}-{简短描述}.md

ADR:          ADR-{NNN}-{描述}.md
              示例: ADR-010-事件格式标准化.md

设计文档:     {领域}-{描述}.md
              示例: ai-模型治理设计.md

评审报告:     review-{模块}.md

高保真设计:   {NN}-{页面}.md
              示例: 01-pipeline-list.md
```

### 6.3 Frontmatter 规范

所有文档必须添加 YAML frontmatter：

```yaml
---
title: "文档标题"
type: design | adr | review | spec | guide
domain: architecture | ai | api | db | frontend | security | sre | qa
status: draft | review | approved | deprecated
version: "1.0"
created: "2026-04-10"
updated: "2026-04-10"
author: "作者"
tags: [tag1, tag2]
related:
  - "docs/adr/ADR-005-xxx.md"
---
```

---

## 七、命令规范

### 7.1 后端服务命令

```bash
cd orion-platform-service
npm install
npm run dev          # tsx watch (热重载)
npm run build        # tsc 编译
npm run start        # node dist/index.js
npm run test         # jest
npm run test:coverage
npm run lint
npm run type-check   # tsc --noEmit

# 单测
npx jest -- -t "test name" path/to/test.ts
npx jest path/to/file.test.ts
```

### 7.2 前端服务命令

```bash
cd orion-frontend
npm install
npm run dev          # vite
npm run build
npm run test         # vitest
npm run test:e2e     # playwright

# 单测
npx vitest run path/to/test.ts
```

### 7.3 服务端口

| 服务 | 端口 | 健康检查 |
|------|------|----------|
| API Gateway | 3000 | `/healthz` |
| Platform Service | 3001 | `/healthz` |
| orion-dba | 3030 | - |
| orion-knowledge-api | 8090 | `/api/v1/health` |
| orion-knowledge-admin | 3020 | - |
| orion-knowledge-app (Wiki) | 3010 | - |
| orion-visor | 3003 | - |

---

## 八、模块功能矩阵

### 8.1 核心模块实现状态

| 模块 | 名称 | 实现状态 | 代码位置 |
|------|------|----------|----------|
| M1 | 效能看板 | ✅ 全栈 | `services/efficiency/`, `pages/EfficiencyDashboard/` |
| M5 | Pipeline 引擎 | ✅ 全栈 | `services/pipeline/`, `pages/PipelineList/` |
| M6 | 多分支产品线 | ✅ 全栈 | `services/product-line/`, `pages/ProductLine/` |
| M9 | AI 算法引擎 | ✅ 全栈 | `services/ai/`, `pages/AIGateway/` |
| M12 | Skill 管理 | ✅ 全栈 | `services/skill/`, `pages/SkillManagement/` |
| M19 | 多租户 | ✅ 全栈 | `services/tenant/`, `pages/TenantManagement/` |
| M22 | FinOps 成本 | ✅ 全栈 | `services/finops/`, `pages/FinOpsDashboard/` |
| M23 | SSO/RBAC | ✅ 全栈 | `api/auth.ts`, `pages/Login/` |
| M26 | 可观测性 | ✅ 全栈 | `services/monitoring/`, `pages/Monitoring/` |
| M29 | 产物管理 | ✅ 全栈 | `services/artifact/`, `pages/Artifacts/` |
| M31 | 智能工单 | ✅ 全栈 | `services/ticketing/`, `pages/TicketList/` |
| M35 | ChatOps | ✅ 全栈 | `services/chatops/`, `pages/ChatOps/` |

### 8.2 新增服务 (全栈实现)

| 模块 | 名称 | 代码位置 |
|------|------|----------|
| S9 | OnCall 排班 | `oncall-routes.ts` + `pages/OnCall/` |
| S10 | Vector Store | `vector-store-routes.ts` + `pages/VectorStore/` |
| S11 | API Key 管理 | `api-key-routes.ts` + `pages/ApiKeyManagement/` |
| S12 | Cron 管理 | `cron-routes.ts` + `pages/CronManagement/` |
| S13 | Webhook 管理 | `webhook-routes.ts` + `pages/WebhookManagement/` |
| S14 | Queue 管理 | `queue-routes.ts` + `pages/Queue/` |
| S15 | 环境管理 | `environment-routes.ts` + `pages/Environment/` |
| S16 | 用户权限 | `user/role/session-routes.ts` + `pages/UserManagement/` |
| S17 | 项目管理 | `project-routes.ts` + `pages/Projects/` |
| S18 | Approvals | `approval-routes.ts` + `pages/Approvals/` |

---

## 九、开发流程规范

### 9.1 功能开发流程

1. **需求分析** → 阅读设计文档，确认输入输出
2. **代码实现** → 按架构规范编写代码
3. **本地测试** → 运行 `npm run test`
4. **类型检查** → 运行 `npm run type-check`
5. **代码审查** → 使用 code-reviewer agent 审查
6. **提交代码** → 创建有意义的 commit message

### 9.2 代码提交规范

**Commit Message 规范**（Conventional Commits）：
```
<type>(<scope>): <subject>

feat(pipeline): add retry mechanism for failed stages
fix(artifact): resolve upload timeout issue
chore(deps): upgrade antd to 5.x
refactor(pipeline): optimize stage execution logic
docs(readme): update installation instructions
```

**Type 类型定义**：
| Type | 说明 | 示例 |
|------|------|------|
| feat | 新功能 | 添加流水线模板 |
| fix | Bug 修复 | 修复列表分页问题 |
| docs | 文档更新 | 更新 API 文档 |
| style | 格式调整 | 代码格式化 |
| refactor | 重构 | 优化代码结构 |
| perf | 性能优化 | 提升查询性能 |
| test | 测试相关 | 添加单元测试 |
| chore | 构建/工具 | 更新依赖配置 |

**Scope 范围**：
- pipeline, artifact, user, tenant, api, ui, docs 等

**提交前检查清单**：
```bash
# 本地检查
npm run lint          # 代码风格
npm run type-check    # 类型检查
npm run test          # 单元测试

# 提交
git add <files>
git commit -m "feat(pipeline): add retry mechanism"
```

### 9.3 代码评审规范

**PR 创建规范**：
```markdown
## Summary
简要描述本次变更

## Test Plan
- [ ] 单元测试通过
- [ ] 本地手动测试
- [ ] 集成测试（如适用）

## Screenshots（如有 UI 变更）
```

**PR 标题规范**：
```
feat(pipeline): add retry mechanism for failed stages
fix(artifact): resolve upload timeout issue
refactor(pipeline): optimize stage execution logic
```

**评审要点**：

| 维度 | 检查项 |
|------|--------|
| **正确性** | 逻辑正确、边界处理、异常捕获 |
| **可读性** | 命名清晰、注释充分、代码简洁 |
| **性能** | 无性能问题、数据库查询优化 |
| **安全** | 无安全漏洞、敏感信息处理 |
| **测试** | 测试覆盖充分、测试可读 |
| **规范** | 符合本规范文档要求 |

**评审角色**：
| 角色 | 职责 |
|------|------|
| Author | 提交代码、响应评审意见 |
| Reviewer | 检查代码、提出改进建议 |
| Approver | 最终审批、合并代码 |

**评审通过条件**：
- 至少 1 位 Reviewer 批准
- 所有评论已解决
- CI/CD 检查全部通过

### 9.4 技术文档规范

**文档分类**：
| 类型 | 说明 | 示例 |
|------|------|------|
| 设计文档 | 系统/模块设计方案 | docs/architecture/*.md |
| API 文档 | 接口定义与使用 | openapi.yaml |
| 组件文档 | 组件使用说明 | Storybook |
| 运行文档 | 部署运维指南 | README.md |
| 变更记录 | 版本变更说明 | CHANGELOG.md |

**设计文档模板**：
```markdown
---
title: "文档标题"
type: design | adr | review | spec | guide
domain: architecture | api | frontend | backend
status: draft | review | approved | deprecated
version: "1.0"
created: "2026-05-21"
author: "作者"
tags: []
---

## 一、背景
## 二、目标
## 三、设计方案
## 四、接口定义
## 五、影响分析
## 六、测试计划
```

**文档维护规范**：
| 场景 | 操作 |
|------|------|
| 新增功能 | 同步更新设计文档 |
| 接口变更 | 更新 API 文档 + CHANGELOG |
| 废弃功能 | 标记 deprecated + 迁移指南 |
| 发现错误 | 及时修复 + 记录变更 |

**文档质量标准**：
- 图表结合：复杂流程需配合流程图
- 示例代码：关键操作需附带示例
- 责任到人：每份文档明确维护者
- 版本管理：重大变更更新版本号

### 9.5 测试策略规范

#### 一、测试金字塔与分层策略

```
        /\
       /E2E\        ← 少量（10%）
      /------\
     /集成测试\    ← 适量（20%）
    /----------\
   / 单元测试  \  ← 大量（70%）
  /------------\
```

**各层测试职责**：
| 层级 | 测试内容 | 占比 | 执行速度 |
|------|---------|------|----------|
| 单元测试 | 业务逻辑、工具函数 | 70% | < 1分钟 |
| 集成测试 | 服务层、仓储层、API | 20% | < 5分钟 |
| E2E 测试 | 完整用户流程 | 10% | < 30分钟 |

#### 二、测试用例命名规范

**命名格式**：`{模块}_{场景}_{预期行为}`

| 类型 | 格式 | 示例 |
|------|------|------|
| 单元测试 | `{类名}.{方法}.{场景}.should{预期}` | `PipelineService.create.withValidInput.shouldReturnCreated` |
| 集成测试 | `{功能}_{场景}_integration` | `pipeline_run_execution_integration` |
| E2E测试 | `{页面}_{用户操作}_e2e` | `pipeline_create_from_scratch_e2e` |

**动词使用规范**：
- `shouldReturn` - 返回值验证
- `shouldThrow` - 异常抛出
- `shouldContain` - 包含关系
- `shouldHaveBeenCalled` - 调用验证
- `shouldResolve` / `shouldReject` - Promise 验证

#### 三、测试文件组织结构

**后端（与源码同层级）**：
```
src/
├── services/pipeline/
│   ├── PipelineService.ts
│   └── __tests__/
│       ├── PipelineService.test.ts       # 单元测试
│       └── __fixtures__/
│           └── mockPipelines.ts          # 测试数据
├── repositories/
│   └── __tests__/
│       └── PipelineRepository.integration.test.ts  # 集成测试
```

**前端（与组件同层级）**：
```
src/components/Button/
├── Button.tsx
├── Button.test.tsx        # 组件测试
├── Button.stories.tsx    # Storybook
└── __fixtures__/
    └── buttonVariants.ts
```

**E2E 独立目录**：
```
e2e/
├── pipeline/
│   ├── create.spec.ts
│   ├── run.spec.ts
│   └── __snapshots__/
└── common/
    ├── auth.ts           # 认证 fixtures
    └── navigation.ts
```

#### 四、测试数据工厂（Test Data Factory）

**工厂模式实现**：
```typescript
// tests/factories/pipeline.factory.ts
class PipelineFactory {
  static build(overrides = {}) {
    return {
      id: faker.string.uuid(),
      name: faker.lorem.words(3),
      tenantId: faker.string.uuid(),
      status: 'draft',
      stages: [],
      createdAt: new Date(),
      ...overrides
    };
  }

  static buildList(count: number, overrides = {}) {
    return Array.from({ length: count }, () =>
      PipelineFactory.build(overrides)
    );
  }

  static buildRunning() {
    return PipelineFactory.build({ status: 'running' });
  }

  static buildFailed() {
    return PipelineFactory.build({ status: 'failed', errorMessage: 'Build failed' });
  }
}

// 使用示例
const pipeline = PipelineFactory.build({ name: 'test-pipeline' });
const pipelines = PipelineFactory.buildList(10);
```

#### 五、测试环境管理

**环境分类**：
| 环境 | 用途 | 数据策略 |
|------|------|----------|
| unit | 单元测试 | 纯 Mock |
| integration | 集成测试 | 测试数据库（事务回滚） |
| e2e | 端到端测试 | 独立测试实例 |

**环境配置**：
```typescript
// jest.setup.ts
beforeAll(() => {
  if (process.env.NODE_ENV === 'test') {
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/orion_test';
  }
});

// 集成测试事务回滚
beforeEach(async () => {
  await db.query('BEGIN');
});

afterEach(async () => {
  await db.query('ROLLBACK');
});
```

#### 六、单元测试最佳实践（AAA 模式）

```typescript
describe('PipelineService.create', () => {
  it('should create pipeline with valid input', async () => {
    // Arrange - 准备
    const input = PipelineFactory.build({ name: 'test' });
    jest.spyOn(repository, 'create').mockResolvedValue(input);

    // Act - 执行
    const result = await service.create(input);

    // Assert - 断言
    expect(result).toEqual(input);
    expect(repository.create).toHaveBeenCalledWith(input);
  });

  it('should throw error with invalid input', async () => {
    // 边界条件测试
    const invalidInput = PipelineFactory.build({ name: '' });

    await expect(service.create(invalidInput))
      .rejects.toThrow('Pipeline name is required');
  });

  it('should handle concurrent creation', async () => {
    // 并发测试
    const input = PipelineFactory.build();
    jest.spyOn(repository, 'create').mockResolvedValue(input);

    await Promise.all([
      service.create(input),
      service.create(input)
    ]);

    expect(repository.create).toHaveBeenCalledTimes(2);
  });
});
```

#### 七、前端组件测试规范（Vitest + React Testing Library）

**测试工具选型**：
| 用途 | 工具 |
|------|------|
| 测试运行器 | Vitest |
| 组件测试 | React Testing Library |
| 快照测试 | Vitest Snapshot |
| 模拟 | msw (Mock Service Worker) |

**交互测试示例**：
```typescript
// Button.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';

describe('Button', () => {
  it('should call onClick when clicked', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>点击</Button>);

    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalled();
  });

  it('should show loading state', () => {
    render(<Button loading>提交中</Button>);
    expect(screen.getByText('提交中')).toBeDisabled();
  });

  it('should render with different variants', () => {
    const { rerender } = render(<Button variant="primary">主要</Button>);
    expect(screen.getByRole('button')).toHaveClass('ant-btn-primary');

    rerender(<Button variant="default">默认</Button>);
    expect(screen.getByRole('button')).not.toHaveClass('ant-btn-primary');
  });

  it('should handle async data loading', async () => {
    render(<AsyncData />);

    expect(screen.getByText('加载中...')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('数据加载完成')).toBeInTheDocument();
    });
  });
});
```

#### 八、API 集成测试规范

**Supertest + TestContainer**：
```typescript
describe('POST /api/v1/pipelines', () => {
  let app: FastifyInstance;
  let token: string;

  beforeAll(async () => {
    app = await buildApp();
    token = await getTestToken();
  });

  it('should return 201 with created pipeline', async () => {
    const response = await request(app.server)
      .post('/api/v1/pipelines')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'test-pipeline', stages: [] });

    expect(response.status).toBe(201);
    expect(response.body.code).toBe(0);
    expect(response.body.data).toMatchObject({
      name: 'test-pipeline'
    });
  });

  it('should return 400 with invalid input', async () => {
    const response = await request(app.server)
      .post('/api/v1/pipelines')
      .set('Authorization', `Bearer ${token}`)
      .send({}); // 缺少必填字段

    expect(response.status).toBe(400);
    expect(response.body.code).toBe(10003); // PARAM_REQUIRED
  });

  it('should return 401 without token', async () => {
    const response = await request(app.server)
      .post('/api/v1/pipelines')
      .send({ name: 'test' });

    expect(response.status).toBe(401);
  });

  it('should return 403 with insufficient permissions', async () => {
    const limitedToken = await getLimitedToken();
    const response = await request(app.server)
      .post('/api/v1/pipelines')
      .set('Authorization', `Bearer ${limitedToken}`)
      .send({ name: 'test' });

    expect(response.status).toBe(403);
  });
});
```

#### 九、E2E 测试最佳实践（Playwright）

**Page Object 模式**：
```typescript
// e2e/pages/PipelineListPage.ts
class PipelineListPage {
  constructor(private page: Page) {}

  async navigate() {
    await this.page.goto('/pipelines');
  }

  async clickCreateButton() {
    await this.page.click('[data-testid="create-pipeline-btn"]');
  }

  async fillForm(name: string) {
    await this.page.fill('[name="name"]', name);
    await this.page.click('[data-testid="add-stage-btn"]');
  }

  async submit() {
    await this.page.click('[data-testid="submit-btn"]');
  }

  async getPipelineByName(name: string) {
    return this.page.locator(`.pipeline-item:has-text("${name}")`);
  }
}

// 测试用例
test('should create pipeline end to end', async ({ page }) => {
  const pipelinePage = new PipelineListPage(page);

  await pipelinePage.navigate();
  await pipelinePage.clickCreateButton();
  await pipelinePage.fillForm('E2E Test Pipeline');
  await pipelinePage.submit();

  const pipeline = await pipelinePage.getPipelineByName('E2E Test Pipeline');
  await expect(pipeline).toBeVisible();
});
```

**测试数据隔离**：
```typescript
// 每个测试使用唯一标识
const uniqueName = `test-pipeline-${Date.now()}`;
const uniqueEmail = `test-${Date.now()}@example.com`;
```

#### 十、性能测试规范

**性能指标定义**：
| 指标 | 目标值 | 告警阈值 |
|------|--------|----------|
| API P99 延迟 | < 500ms | > 1s |
| 页面首次加载 (FCP) | < 1.8s | > 3s |
| 测试套件执行时间 | < 5min | > 10min |
| 并发处理能力 | 100 TPS | < 50 TPS |

**性能测试场景**：
```typescript
// 使用 k6 进行性能测试
// k6/scenarios/pipeline-api.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 10 },  // 预热
    { duration: '1m', target: 50 },   // 正常负载
    { duration: '30s', target: 100 }, // 峰值
    { duration: '30s', target: 0 },   // 冷却
  ],
  thresholds: {
    http_req_duration: ['p(99)<500'],
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  const res = http.get('http://localhost:3001/api/v1/pipelines');
  check(res, { 'status was 200': (r) => r.status === 200 });
  sleep(1);
}
```

#### 十一、测试覆盖率门禁

**Jest 配置**：
```typescript
// jest.config.js
export default {
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/index.ts'
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    },
    // 核心业务必须更高
    './src/services/**/*.ts': {
      branches: 80,
      functions: 80,
      lines: 80
    },
    // 新增文件质量门禁
    './src/**/*.[ NEW].ts': {
      branches: 85,
      functions: 85,
      lines: 85
    }
  }
};
```

**CI 门禁配置**：
```yaml
# .gitlab-ci.yml
test:
  stage: test
  script:
    - npm run test:coverage
  coverage: '/Coverage: \d+\.\d+%/'
  rules:
    - if: $CI_MERGE_REQUEST_IID
    - if: $CI_COMMIT_BRANCH == $DEFAULT_BRANCH
  # 覆盖率下降阻断
  reports:
    junit: junit.xml
    coverage_report:
      coverage_format: cobertura
      path: coverage/cobertura-coverage.xml
```

**差异化覆盖要求**：
| 模块类型 | 行覆盖率 | 分支覆盖率 | 原因 |
|----------|----------|------------|------|
| 核心业务 | 80% | 75% | 高可靠性要求 |
| 工具函数 | 70% | 60% | 边界情况少 |
| API路由 | 75% | 70% | 路由逻辑简单 |
| 前端组件 | 60% | 50% | UI逻辑为主 |
| 新增代码 | 85% | 80% | 质量门禁 |

#### 十二、测试工具选型总览

| 测试类型 | 工具 | 说明 |
|----------|------|------|
| 单元测试（后端） | Jest | 成熟稳定 |
| 单元测试（前端） | Vitest | 兼容 Jest API，更快 |
| 集成测试 | Jest + TestContainer | 数据库隔离 |
| E2E 测试 | Playwright | 跨浏览器、多平台 |
| 性能测试 | k6 / Artillery | API 压测 |
| 组件文档 | Storybook | 可视化测试 |
| API Mock | msw | 前端 API 拦截 |
| 测试报告 | Allure | 丰富报告 |

**测试覆盖率要求**：
| 类型 | 最低覆盖率 |
|------|-----------|
| 核心业务逻辑 | 80% |
| 工具函数 | 70% |
| 组件（前端） | 60% |
| API 路由 | 70% |

### 9.6 安全编码规范

**输入校验与过滤**：
```typescript
// 使用 Joi/zod 进行输入验证
const pipelineSchema = z.object({
  name: z.string().min(1).max(100),
  stages: z.array(stageSchema).min(1),
  tenantId: z.string().uuid()
});

// 校验所有外部输入
const result = pipelineSchema.safeParse(req.body);
if (!result.success) {
  throw new OrionError('INVALID_INPUT', 400);
}
```

**SQL 注入防护**：
```typescript
// ✅ 使用参数化查询
const user = await db.query(
  'SELECT * FROM users WHERE id = $1',
  [userId]
);

// ❌ 禁止字符串拼接
const user = await db.query(
  'SELECT * FROM users WHERE id = ' + userId
);
```

**XSS 防护**：
```typescript
// 前端：使用 React 自动转义
// 后端：返回时对 HTML 特殊字符转义
const sanitizeHtml = (input: string) => {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
};
```

**敏感数据处理**：
```typescript
// 禁止日志记录敏感信息
const sensitiveFields = ['password', 'token', 'secret', 'apiKey'];

// 自动过滤
const safeLog = (data: any) => {
  const sanitized = { ...data };
  for (const field of sensitiveFields) {
    if (sanitized[field]) sanitized[field] = '***REDACTED***';
  }
  return sanitized;
};
```

**CSRF 防护**：
> **注意**：Orion 使用 HttpOnly Cookie + JWT RS256 认证，天然免疫 CSRF 攻击。
> - JWT Token 存储在 HttpOnly Cookie 中，JS 无法访问
> - SameSite=Strict 防止跨站请求携带 Cookie
> - 不需要额外的 CSRF Token 机制
> 
> 详见第 2209 行「CSRF 防护规范」章节。

### 9.7 SRE 实践规范

**SLI/SLO 定义**：
```yaml
# Service Level Indicators
slis:
  - name: availability
    description: 服务可用率
    query: sum(rate(http_requests_total{status=~"2.."}[5m])) / sum(rate(http_requests_total[5m]))
  
  - name: latency
    description: P99 延迟
    query: histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m]))
  
  - name: quality
    description: 错误率
    query: sum(rate(http_requests_total{status=~"5.."}[5m])) / sum(rate(http_requests_total[5m]))

# Service Level Objectives
slos:
  - name: api-availability
    sli: availability
    target: 99.9%
    errorBudget: 0.1%
    period: 30d
    
  - name: api-latency
    sli: latency
    target: 99%
    threshold: 500ms
```

**错误预算策略**：
| 周期 | 可用率目标 | 不可用时间预算 |
|------|-----------|---------------|
| 30 天 | 99.9% | 43.8 分钟 |
| 7 天 | 99.9% | 10.1 分钟 |
| 1 天 | 99.9% | 1.44 分钟 |

**告警触发条件**：
```yaml
# 告警规则
alerts:
  - name: HighErrorRate
    expr: error_rate > 0.01
    for: 5m
    severity: warning
    
  - name: SLOBreach
    expr: error_budget < 0
    for: 0m
    severity: critical
```

**Post-Mortem 复盘模板**：
```markdown
# Incident Post-Mortem

## 概述
- 事件时间：
- 持续时间：
- 影响范围：
- 严重程度：P0/P1/P2/P3

## 根因分析
## 影响评估
## 响应过程
## 恢复过程
## 改进措施
| 行动项 | 负责人 | 截止日期 |
|--------|--------|----------|

## 经验教训
```

**On-Call 规范**：
| 职责 | 要求 |
|------|------|
| 响应时间 | P0: 15 分钟, P1: 30 分钟, P2: 2 小时 |
| 值班周期 | 7 天轮换 |
| 升级路径 | On-Call → Team Lead → Manager |
| 交接 | 书面交接，记录当前问题 |

### 9.8 前端开发特别注意事项

1. **使用 Design Token**，而非硬编码色值/间距/圆角
2. **遵循 4px 网格**：所有间距为 4 的倍数
3. **保持组件高度为 36px** 默认值
4. **卡片用阴影而非边框**区分层次
5. **每个异步操作加 success/error 提示**

### 9.9 版本发布规范

#### 一、版本号管理

**Semantic Versioning**：
```
主版本号.次版本号.修订号
  MAJOR      MINOR      PATCH

示例：v1.2.3
  ├── 主版本（不兼容的API变更）
  ├── 次版本（向后兼容的新功能）
  └── 修订号（向后兼容的Bug修复）
```

#### 二、Docker 镜像构建规范

**多阶段构建 Dockerfile**：
```dockerfile
# 阶段 1: 构建
FROM node:20-alpine AS builder

WORKDIR /app

# 安装依赖（使用 package-lock 确保一致性）
COPY package*.json ./
RUN npm ci --only=production

# 复制源码
COPY . .

# 构建
RUN npm run build

# 阶段 2: 运行
FROM node:20-alpine AS runner

# 安全配置
RUN addgroup -g 1001 -S nodejs && \
    adduser -S orion -u 1001

WORKDIR /app

# 复制构建产物
COPY --from=builder --chown=orion:nodejs /app/dist ./dist
COPY --from=builder --chown=orion:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=orion:nodejs /app/package.json ./

# 环境变量
ENV NODE_ENV=production \
    PORT=3001

# 安全运行
USER orion
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/healthz', (r)=>process.exit(r.statusCode===200?0:1))"

CMD ["node", "dist/index.js"]
```

**镜像命名规范**：
```yaml
镜像仓库格式：
  registry.example.com/<项目>/<服务>:<版本>

示例：
  registry.example.com/orion/platform-service:v1.2.3
  registry.example.com/orion/api-gateway:v1.2.3
  registry.example.com/orion/frontend:v1.2.3

标签规范：
  - latest: 最新稳定版（不推荐生产使用）
  - v{major}.{minor}.{patch}: 语义化版本
  - {git-commit-sha}: 精确版本
  - stable: 稳定版
```

**构建优化**：
```yaml
构建优化策略：
  1. 使用 .dockerignore 减少构建上下文
  2. 利用 BuildKit 缓存
  3. 多阶段构建减小镜像体积
  4. 基础镜像使用 alpine 精简版
  5. 避免重复 COPY 层
  6. 合并 RUN 指令减少层数

.dockerignore 示例：
  node_modules
  .git
  .github
  *.md
  docs/
  tests/
  .env*
```

**镜像安全扫描**：
```yaml
构建后检查：
  - 基础镜像漏洞扫描
  - 应用依赖漏洞扫描
  - 敏感信息检查
  - 容器最佳实践检查

CI 配置示例：
```yaml
# .gitlab-ci.yml
build-image:
  stage: build
  image: docker:24
  services:
    - docker:24-dind
  script:
    - docker build -t $IMAGE_TAG .
    - docker scan --severity high $IMAGE_TAG
    - docker push $IMAGE_TAG
```

#### 四、多语言支持（Python/Java/Go/Rust/.NET/PHP/Ruby）

**Python 服务 Dockerfile**：
```dockerfile
# 阶段 1: 构建
FROM python:3.11-slim AS builder

WORKDIR /app

# 安装 uv 加速依赖安装
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

COPY pyproject.toml uv.lock ./
RUN uv pip install --system --no-cache -r pyproject.toml

COPY . .

RUN uv pip install --system --no-cache -e .

# 阶段 2: 运行
FROM python:3.11-slim AS runner

RUN groupadd -r orion && useradd -r -g orion orion
WORKDIR /app

COPY --from=builder --chown=orion:orion /app /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONENV=production

USER orion
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8080/health')"

CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
```

**Java 服务 Dockerfile**：
```dockerfile
# 阶段 1: 构建
FROM maven:3.9-eclipse-temurin-21 AS builder

WORKDIR /app

COPY pom.xml .
RUN mvn dependency:go-offline -B

COPY src ./src
RUN mvn clean package -DskipTests -B

# 阶段 2: 运行
FROM eclipse-temurin:21-jre-alpine AS runner

RUN addgroup -g 1000 -S orion && \
    adduser -S orion -u 1000 -G orion

WORKDIR /app

COPY --from=builder --chown=orion:orion /app/target/*.jar app.jar

ENV JAVA_OPTS="-XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0"

USER orion
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=30s --retries=3 \
  CMD wget --spider -q http://localhost:8080/actuator/health || exit 1

CMD ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]
```

**Go 服务 Dockerfile**：
```dockerfile
# 阶段 1: 构建
FROM golang:1.21-alpine AS builder

RUN apk add --no-cache git

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o main .

# 阶段 2: 运行
FROM alpine:3.19 AS runner

RUN apk add --no-cache ca-certificates tzdata

RUN addgroup -g 1000 -S orion && \
    adduser -S orion -u 1000 -G orion

WORKDIR /app

COPY --from=builder --chown=orion:orion /app/main .

USER orion
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --spider -q http://localhost:8080/health || exit 1

CMD ["./main"]
```

**Rust 服务 Dockerfile**：
```dockerfile
# 阶段 1: 构建
FROM rust:1.75-alpine AS builder

RUN apk add --no-cache musl-dev openssl-dev

WORKDIR /app

COPY Cargo.toml Cargo.lock ./
RUN mkdir src && echo "fn main() {}" > src/main.rs
RUN cargo build --release && rm -rf src

COPY . .
RUN cargo build --release

# 阶段 2: 运行
FROM alpine:3.19 AS runner

RUN apk add --no-cache ca-certificates

RUN addgroup -g 1000 -S orion && \
    adduser -S orion -u 1000 -G orion

WORKDIR /app

COPY --from=builder --chown=orion:orion /app/target/release/orion .

USER orion
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --spider -q http://localhost:8080/health || exit 1

CMD ["./orion"]
```

**.NET (C#) 服务 Dockerfile**：
```dockerfile
# 阶段 1: 构建
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS builder

WORKDIR /app

# 复制项目文件并还原依赖
COPY *.csproj ./
RUN dotnet restore

# 复制源码并构建
COPY . ./
RUN dotnet publish -c Release -o /app/publish --no-restore

# 阶段 2: 运行
FROM mcr.microsoft.com/dotnet/aspnet:8.0-alpine AS runner

RUN addgroup -g 1000 -S orion && \
    adduser -S orion -u 1000 -G orion

WORKDIR /app

COPY --from=builder --chown=orion:orion /app/publish .

USER orion
EXPOSE 8080

ENV ASPNETCORE_URLS=http://+:8080 \
    ASPNETCORE_ENVIRONMENT=Production

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --spider -q http://localhost:8080/health || exit 1

ENTRYPOINT ["dotnet", "Orion.Service.dll"]
```

**PHP 服务 Dockerfile**：
```dockerfile
# 阶段 1: 构建
FROM composer:2.7-alpine AS builder

WORKDIR /app

COPY composer.json composer.lock ./
RUN composer install --no-dev --optimize-autoloader

COPY . .

# 阶段 2: 运行
FROM php:8.3-fpm-alpine AS runner

RUN apk add --no-cache nginx Supervisor

# 安装 PHP 扩展
RUN docker-php-ext-install pdo pdo_mysql opcache

# 配置 Supervisor
COPY <<EOF /etc/supervisor/conf.d/supervisord.conf
[supervisord]
nodaemon=true
user=root

[program:php-fpm]
command=/usr/sbin/php-fpm
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0

[program:nginx]
command=/usr/sbin/nginx -g "daemon off;"
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0
EOF

WORKDIR /app

COPY --from=builder --chown=www-data:www-data /app /app

RUN addgroup -g 1000 -S orion && \
    adduser -S orion -u 1000 -G orion

USER orion
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --spider -q http://localhost:8080/health || exit 1

CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
```

**Ruby 服务 Dockerfile**：
```dockerfile
# 阶段 1: 构建
FROM ruby:3.3-alpine AS builder

RUN apk add --no-cache build-base libxml2-dev libxslt-dev

WORKDIR /app

COPY Gemfile Gemfile.lock ./
RUN bundle install

COPY . .

# 构建 Rails 资源
RUN RAILS_ENV=production bundle exec rails assets:precompile

# 阶段 2: 运行
FROM ruby:3.3-alpine AS runner

RUN apk add --no-cache nodejs tzdata

RUN addgroup -g 1000 -S orion && \
    adduser -S orion -u 1000 -G orion

WORKDIR /app

# 复制bundle和预编译资源
COPY --from=builder --chown=orion:orion /usr/local/bundle /usr/local/bundle
COPY --from=builder --chown=orion:orion /app/public /app/public
COPY --from=builder --chown=orion:orion /app/config /app/config
COPY --from=builder --chown=orion:orion /app/app /app/app
COPY --from=builder --chown=orion:orion /app/Gemfile /app/Gemfile
COPY --from=builder --chown=orion:orion /app/config.ru /app/config.ru

ENV RAILS_ENV=production \
    SECRET_KEY_BASE=dummy \
    BUNDLE_PATH=/usr/local/bundle

USER orion
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
  CMD wget --spider -q http://localhost:8080/health || exit 1

CMD ["bundle", "exec", "rails", "server", "-b", "0.0.0.0"]
```

**C/C++ 服务 Dockerfile**：
```dockerfile
# 阶段 1: 构建
FROM gcc:13-alpine AS builder

RUN apk add --no-cache make cmake git boost pthread

WORKDIR /app

COPY . .

RUN mkdir -p build && cd build && \
    cmake .. -DCMAKE_BUILD_TYPE=Release && \
    make -j$(nproc)

# 阶段 2: 运行
FROM alpine:3.19 AS runner

RUN apk add --no-cache ca-certificates libstdc++

RUN addgroup -g 1000 -S orion && \
    adduser -S orion -u 1000 -G orion

WORKDIR /app

COPY --from=builder --chown=orion:orion /app/build/orion .

USER orion
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --spider -q http://localhost:8080/health || exit 1

CMD ["./orion"]
```

**Python 服务 Dockerfile**：
```dockerfile
# 阶段 1: 构建
FROM python:3.11-slim AS builder

WORKDIR /app

# 安装 uv 加速依赖安装
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

COPY pyproject.toml uv.lock ./
RUN uv pip install --system --no-cache -r pyproject.toml

COPY . .

RUN uv pip install --system --no-cache -e .

# 阶段 2: 运行
FROM python:3.11-slim AS runner

RUN groupadd -r orion && useradd -r -g orion orion
WORKDIR /app

COPY --from=builder --chown=orion:orion /app /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONENV=production

USER orion
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8080/health')"

CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
```

**Java 服务 Dockerfile**：
```dockerfile
# 阶段 1: 构建
FROM maven:3.9-eclipse-temurin-21 AS builder

WORKDIR /app

COPY pom.xml .
RUN mvn dependency:go-offline -B

COPY src ./src
RUN mvn clean package -DskipTests -B

# 阶段 2: 运行
FROM eclipse-temurin:21-jre-alpine AS runner

RUN addgroup -g 1000 -S orion && \
    adduser -S orion -u 1000 -G orion

WORKDIR /app

COPY --from=builder --chown=orion:orion /app/target/*.jar app.jar

ENV JAVA_OPTS="-XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0"

USER orion
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=30s --retries=3 \
  CMD wget --spider -q http://localhost:8080/actuator/health || exit 1

CMD ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]
```

**Go 服务 Dockerfile**：
```dockerfile
# 阶段 1: 构建
FROM golang:1.21-alpine AS builder

RUN apk add --no-cache git

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o main .

# 阶段 2: 运行
FROM alpine:3.19 AS runner

RUN apk add --no-cache ca-certificates tzdata

RUN addgroup -g 1000 -S orion && \
    adduser -S orion -u 1000 -G orion

WORKDIR /app

COPY --from=builder --chown=orion:orion /app/main .

USER orion
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --spider -q http://localhost:8080/health || exit 1

CMD ["./main"]
```

#### 五、镜像签名与校验

**Cosign 签名配置**：
```yaml
# 安装 cosign
RUN curl -sSL https://get.sigs.k8s.io/cosign/releases/download/v2.2.0/cosign-linux-amd64 -o /usr/local/bin/cosign && \
    chmod +x /usr/local/bin/cosign

# 签名镜像
cosign sign --key cosign.key registry.example.com/orion/platform-service:v1.2.3

# 验证镜像
cosign verify --key cosign.pub registry.example.com/orion/platform-service:v1.2.3

# 验证策略（policy.tdl）
type: reject
authority: 1
keyless: 0
publicKey: |
  -----BEGIN PUBLIC KEY-----
  ...
  -----END PUBLIC KEY-----
```

**镜像拉取策略**：
```yaml
# Kubernetes Deployment 示例
spec:
  replicas: 3
  template:
    spec:
      imagePullSecrets:
        - name: orion-registry-secret
      containers:
        - name: app
          image: registry.example.com/orion/platform-service:v1.2.3
          imagePullPolicy: IfNotPresent  # 生产环境用 Always
          resources:
            requests:
              memory: "256Mi"
              cpu: "250m"
            limits:
              memory: "512Mi"
              cpu: "500m"
```

#### 六、Harbor 仓库配置

**Harbor 镜像仓库规范**：
```yaml
仓库结构：
  registry.example.com/
  ├── orion/                    # 项目组
  │   ├── platform-service/     # 后端服务
  │   ├── api-gateway/          # API 网关
  │   ├── frontend/             # 前端应用
  │   └── ml/                   # 机器学习服务
  ├── library/                  # 基础镜像
  │   ├── node:20-alpine
  │   ├── python:3.11-slim
  │   └── eclipse-temurin:21-jre
  └── helix/                    # 内部工具

权限配置：
  - 项目管理员：推送/拉取/扫描/签名
  - 开发人员：拉取/扫描
  - 只读人员：仅拉取

安全策略：
  - 自动扫描：推送到自动触发漏洞扫描
  - 阻止漏洞：允许存在 medium 及以下级别
  - 镜像保留：保留 30 天，保留 100 个版本
```

#### 三、版本发布流程

**发布阶段**：
```yaml
发布阶段：
  1. 预发布版本 (RC)
     - 功能冻结
     - 全面测试
     - 性能压测
     - 安全扫描（镜像扫描 + 依赖扫描）

  2. 正式发布
     - 镜像构建并推送
     - 灰度发布（5% → 20% → 50% → 100%）
     - 监控观察
     - 异常回滚

  3. 发布完成
     - 通知相关方
     - 更新文档
     - 更新 CHANGELOG
```

**发布检查清单**：
```markdown
## Release Checklist

### 代码检查
- [ ] 所有单元测试通过
- [ ] 集成测试通过
- [ ] E2E 测试通过
- [ ] 代码覆盖率达标
- [ ] 无安全漏洞
- [ ] 无 lint 警告

### 文档检查
- [ ] CHANGELOG 已更新
- [ ] API 文档已同步
- [ ] 部署文档已更新（如有变更）
- [ ] 迁移指南已准备（如有数据库变更）

### 发布检查
- [ ] 版本号已更新
- [ ] 镜像已构建
- [ ] 配置文件已准备
- [ ] 回滚方案已验证

### 通知
- [ ] 团队通知
- [ ] 用户通知（如需要）
- [ ] 文档更新
```

**CHANGELOG 规范**：
```markdown
# Changelog

## [1.2.0] - 2026-05-21

### Added
- AI Agent 编排功能，支持多 Agent 协作
- Pipeline 模板市场
- 向量检索功能

### Changed
- 优化了 Pipeline 执行性能，提升 30%
- 重构了权限校验模块

### Fixed
- 修复了 Pipeline 日志丢失问题
- 修复了用户权限缓存不一致问题

### Deprecated
- 旧版 Pipeline API (v1beta) 将于 v2.0 移除

### Removed
- 移除了过时的 webhook v1 接口
```

### 9.10 交付规范

**交付物清单**：
| 交付物 | 说明 | 格式 |
|--------|------|------|
| 源代码 | 完整项目代码 | Git |
| 容器镜像 | 生产级镜像 | Docker/OCI |
| 部署配置 | K8s manifests / Helm | YAML |
| 数据库迁移 | SQL 迁移脚本 | SQL |
| API 文档 | OpenAPI / Swagger | YAML/JSON |
| 测试报告 | 测试覆盖报告 | HTML/PDF |
| 安全报告 | 漏洞扫描报告 | PDF |

**交付验收标准**：
```yaml
功能验收：
  - 所有需求功能正常运行
  - 边界条件处理正确
  - 错误提示清晰准确
  - 性能满足 SLA 要求

安全验收：
  - 无高危漏洞
  - 无中危漏洞（或已计划修复）
  - 敏感数据加密存储
  - 审计日志完整

性能验收：
  - API P99 延迟 < 500ms
  - 页面加载时间 < 3s
  - 并发处理能力 > 100 TPS

稳定性验收：
  - 7x24 小时无故障运行
  - 错误率 < 0.1%
  - 自动恢复正常
```

**交付文档模板**：
```markdown
# Release Note - v1.2.0

## 发布概述
简要描述本次发布的内容和目标

## 发布范围
| 模块 | 功能 | 状态 |
|------|------|------|
| Pipeline | 模板市场 | ✅ 新增 |
| AI | Agent 编排 | ✅ 新增 |
| Security | 权限优化 | ✅ 优化 |

## 功能变更
### 新增功能
1. AI Agent 编排功能
   - 支持多 Agent 协作
   - 支持自定义 Agent 工具
   
2. Pipeline 模板市场
   - 预置 20+ 模板
   - 支持自定义模板

### 优化内容
1. Pipeline 执行性能优化
   - 减少 30% 执行时间
   
2. 权限校验重构
   - 提升 5 倍校验性能

### 修复问题
- Pipeline 日志丢失问题
- 用户权限缓存不一致

## 技术变更
- 依赖版本升级
- 数据库迁移（无/有）
- 配置变更

## 部署指南
### 前置条件
- Kubernetes 1.24+
- PostgreSQL 14+
- Redis 7+

### 部署步骤
1. 执行数据库迁移
2. 部署后端服务
3. 部署前端服务
4. 验证功能

### 回滚方案
如需回滚，执行：
```bash
kubectl rollout undo deployment/orion-platform
```

## 已知问题
| 问题 | 影响 | 计划修复 |
|------|------|----------|
| XXX | 低 | v1.3 |

## 联系支持
- 技术支持：support@orion.example.com
- 紧急热线：+86 xxx-xxxx-xxxx
```

### 9.11 事件响应与问题上报规范

**事件分级标准**：
| 级别 | 定义 | 响应时间 | 恢复时间 |
|------|------|----------|----------|
| P0 | 核心服务不可用，影响所有用户 | 15 分钟 | 1 小时 |
| P1 | 核心功能不可用，影响大部分用户 | 30 分钟 | 2 小时 |
| P2 | 非核心功能异常，影响部分用户 | 2 小时 | 8 小时 |
| P3 | 轻微问题，不影响使用 | 24 小时 | 72 小时 |

**事件响应流程**：
```yaml
事件响应流程：
  1. 检测发现
     - 监控告警触发
     - 用户报告
     - 内部发现
  
  2. 初步确认
     - 确认事件真实性
     - 评估影响范围
     - 确定事件级别
  
  3. 应急响应
     - 成立应急小组
     - 启动应急预案
     - 持续沟通进展
  
  4. 问题定位
     - 收集日志/指标
     - 复现问题
     - 定位根因
  
  5. 实施修复
     - 制定修复方案
     - 执行修复
     - 验证恢复
  
  6. 事件关闭
     - 确认服务恢复
     - 通知相关方
     - 启动复盘
```

**问题上报模板**：
```markdown
# 事件报告 - [事件名称]

## 基本信息
- 事件编号：INC-2026-0521-001
- 事件级别：P0/P1/P2/P3
- 发现时间：
- 恢复时间：
- 影响时长：
- 影响范围：

## 事件描述
[详细描述事件经过]

## 根因分析
[分析根本原因]

## 应急处理
[采取的应急措施]

## 改进措施
| 行动项 | 负责人 | 截止日期 |
|--------|--------|----------|
|        |        |          |

## 经验教训
[从此次事件中学到的教训]
```

**升级路径**：
| 当前状态 | 升级条件 | 升级到 |
|----------|----------|--------|
| On-Call 处理中 | 15 分钟未解决 | Team Lead |
| Team Lead 处理中 | 30 分钟未解决 | Manager |
| Manager 处理中 | 1 小时未解决 | 架构师/技术总监 |

**值班规范**：
```yaml
On-Call 职责：
  - 保持手机 24 小时开机
  - 响应 P0/P1 告警
  - 记录事件处理过程
  - 交接时书面说明当前问题

值班交接：
  - 交接时间：每天 9:00
  - 交接内容：
    * 当前未解决的问题
    * 正在进行的维护
    * 需要关注的服务/系统
```

### 9.12 运维操作规范

#### 一、日常运维操作

**日常巡检清单**：
```yaml
每日巡检（建议 9:00-10:00）：
  - 服务健康检查
    * 所有服务 /healthz 状态
    * API 响应时间 P99 < 500ms
    * 错误率 < 0.1%
  
  - 资源使用检查
    * CPU 使用率 < 70%
    * 内存使用率 < 80%
    * 磁盘使用率 < 85%
    * 数据库连接数 < 80% max
  
  - 告警检查
    * 昨日告警数量和趋势
    * 未处理告警
    * 告警误报率
  
  - 业务指标检查
    * 核心业务请求量
    * 核心业务成功率
    * 用户活跃度
```

**常见操作流程**：
```yaml
# 服务重启
服务重启流程：
  1. 确认无发布在进行
  2. 通知相关方（如果影响用户）
  3. 执行滚动重启
     kubectl rollout restart deployment/<name>
  4. 验证服务健康
     kubectl get pods -l app=<name>
  5. 确认功能正常

# 数据库问题排查
数据库问题排查：
  1. 查看连接数
     SELECT count(*) FROM pg_stat_activity;
  2. 查看慢查询
     SELECT query, calls, mean_time 
     FROM pg_stat_statements 
     ORDER BY mean_time DESC LIMIT 10;
  3. 查看锁等待
     SELECT * FROM pg_locks WHERE granted = false;

# 缓存问题处理
缓存问题排查：
  1. 查看 Redis 连接
     INFO clients
  2. 查看内存使用
     INFO memory
  3. 查看大 Key
     MEMORY USAGE key:*
```

#### 二、变更管理规范

**变更分类**：
| 变更类型 | 说明 | 审批要求 | 示例 |
|----------|------|----------|------|
| 标准变更 | 常规操作，有既定流程 | 自动批准 | 定时任务重启 |
| 紧急变更 | 故障修复，快速执行 | 口头批准，事后记录 | 紧急回滚 |
| 重大变更 | 架构调整，核心功能 | 正式审批 | 数据库迁移 |

**变更审批流程**：
```yaml
标准变更流程：
  1. 提交变更申请
     - 变更内容、时间、影响范围、回滚方案
  2. 技术评审（代码/配置审查、风险评估）
  3. 审批（P0/P1: 技术+业务负责人，P2: 技术负责人，P3: 值班负责人）
  4. 执行（变更窗口、实时监控、异常回滚）
  5. 验证（功能、监控、用户确认）
  6. 关闭（记录结果、更新文档）
```

**变更窗口**：
| 变更类型 | 可执行时间 |
|----------|-----------|
| 核心服务 | 周二/周四 02:00-05:00 |
| 非核心服务 | 每日 02:00-05:00 |
| 紧急变更 | 随时（需审批） |

#### 三、容量与性能管理

**资源扩容流程**：
```yaml
扩容评估触发条件：
  - CPU 持续 > 70% 超过 30 分钟
  - 内存持续 > 80% 超过 30 分钟
  - 磁盘使用率 > 85%
  - 错误率上升 > 1%

扩容步骤：
  1. 分析瓶颈（监控趋势、日志）
  2. 制定方案（水平/垂直扩容、架构优化）
  3. 执行扩容（测试验证、生产执行、监控观察）
  4. 效果评估（对比指标、确认解决）
```

**性能基线管理**：
| 指标 | 基线值 | 警告阈值 | 严重阈值 |
|------|--------|----------|----------|
| API P99 延迟 | 200ms | 500ms | 1s |
| 页面加载时间 | 1.5s | 3s | 5s |
| 数据库查询 P99 | 100ms | 500ms | 1s |
| 错误率 | 0.01% | 0.1% | 1% |

#### 四、备份与恢复规范

**备份策略**：
```yaml
数据库备份：
  - 全量备份：每周日 02:00，保留 30 天
  - 增量备份：每日 02:00，保留 7 天
  - 实时备份：WAL 归档，保留 15 天
  - 跨机房：实时同步到灾备机房

文件备份：
  - 用户上传文件：对象存储，保留 90 天
  - 配置文件：Git 版本控制
  - 日志文件：保留 30 天
```

**备份工具命令**：
```bash
# PostgreSQL 全量备份（pg_dump）
pg_dump -h localhost -U orion -Fc -f /backup/orion_$(date +%Y%m%d).dump orion_db

# PostgreSQL 增量备份（pg_basebackup）
pg_basebackup -h localhost -D /backup/base -P -Xs -R

# 使用 barman 进行备份管理
barman backup orion-db
barman list-backup orion-db
barman restore orion-db latest

# 使用 Wal-g 进行增量备份
wal-g backup-push /var/lib/postgresql/data
wal-g backup-fetch /restore latest

# 数据库恢复
pg_restore -h localhost -U orion -d orion_db /backup/orion_20260522.dump

# 恢复指定时间点（PITR）
pg_restore -h localhost -U orion -d orion_db --target-time="2026-05-22 10:00:00" /backup/orion_20260522.dump
```

**备份脚本示例**：
```bash
#!/bin/bash
# backup-orion.sh

set -e

BACKUP_DIR="/backup/postgresql"
DATE=$(date +%Y%m%d)
DB_HOST="localhost"
DB_NAME="orion_db"
DB_USER="orion"

# 全量备份
echo "[$(date)] Starting full backup..."
pg_dump -h $DB_HOST -U $DB_USER -Fc -f $BACKUP_DIR/full_$DATE.dump $DB_NAME

# 验证备份
echo "[$(date)] Verifying backup..."
pg_restore --list $BACKUP_DIR/full_$DATE.dump > /dev/null

# 清理 30 天前的备份
find $BACKUP_DIR -name "full_*.dump" -mtime +30 -delete

echo "[$(date)] Backup completed: full_$DATE.dump"
```

**恢复演练**：
| 类型 | 频率 | 参与人员 |
|------|------|----------|
| 数据库恢复演练 | 每季度 | DBA + 运维 |
| 全系统灾备演练 | 每半年 | 全体 SRE |
| 关键业务恢复演练 | 每月 | 业务负责人 |

#### 五、日志与监控运维

**日志管理规范**：
```yaml
日志采集：
  - 应用日志：JSON 格式，输出到 stdout
  - 访问日志：Nginx/网关层采集
  - 审计日志：单独采集，保留 1 年

日志保留：
  - 热数据（7 天）：ELK/Kibana 在线查询
  - 温数据（8-30 天）：对象存储
  - 冷数据（30 天+）：归档，按需恢复
```

**告警处理流程**：
```
收到告警 → 确认有效性 → 评估影响 → 预处理 → 通知 → 定位 → 修复 → 关闭 → 复盘
```

#### 六、运维自动化规范

**自动化场景**：
| 场景 | 自动化工具 | 触发条件 |
|------|-----------|----------|
| 服务部署 | ArgoCD/Flux | Git commit |
| 扩缩容 | HPA/VPA | 资源阈值 |
| 故障自愈 | Prometheus + AlertManager | 告警触发 |
| 日志采集 | Fluentd/Fluent Bit | Pod 启动 |
| 证书轮换 | cert-manager | 过期前 30 天 |

#### 七、运维值班规范

**On-Call 轮值**：
```yaml
周期：7 天一轮换
方式：双人值班（主/备）
交接：每日 9:00 书面交接

On-Call 职责：
  - 响应 P0/P1 告警（15 分钟内）
  - 故障应急处理
  - 变更审批（如需要）
  - 巡检执行

考核指标：
  - 告警响应时间：< 15 分钟
  - 问题首次响应：< 30 分钟
  - MTTR（平均恢复时间）：< 1 小时
  - 告警遗漏率：0%
```

---

## 十、安全合规规范

### 10.1 安全合规框架

**合规标准**：
| 标准 | 适用场景 | 认证周期 |
|------|----------|----------|
| ISO 27001 | 信息安全管理体系 | 3 年复审 |
| SOC 2 Type II | 云服务安全信任 | 1 年审计 |
| 等保 2.0 | 国内金融/政务/教育 | 1 年测评 |
| GDPR | 欧盟用户数据 | 持续合规 |

**安全组织**：
```yaml
安全角色：
  - CISO（首席信息安全官）：整体安全战略
  - 安全架构师：系统安全设计
  - 安全工程师：渗透测试、漏洞修复
  - 合规专员：合规审计、文档维护
  - 安全运营：监控告警、事件响应
```

**国内法规合规要求**：
```yaml
《数据安全法》(2021-09-01)：
  - 数据分类分级保护制度
  - 重要数据目录编制
  - 数据出境安全评估流程

《个人信息保护法》(2021-11-01)：
  - 个人信息处理规则
  - 跨境传输合规要求（标准合同/安全评估）
  - 用户权利响应机制（查询/删除/撤回同意）
  - 数据泄露通知：72小时内通知用户

《网络安全法》：
  - 等级保护制度（等保2.0）
  - 网络安全事件应急预案
  - 日志留存不少于6个月
```

**MFA 双因素认证要求**：
```yaml
强制MFA场景：
  - 管理后台登录：必须启用MFA
  - 生产环境SSH登录：必须启用MFA
  - 财务/敏感操作：必须启用MFA
  - 密钥管理操作：必须启用MFA

MFA方式优先级：
  1. 硬件令牌（YubiKey）
  2. TOTP应用（Google Authenticator）
  3. 手机短信（不推荐，仅作备用）

MFA绑定流程：
  - 首次登录强制绑定
  - 更换设备需重新验证身份
  - 禁用MFA需审批+安全验证
```

### 10.2 密钥管理规范

**密钥类型与生命周期**：
| 密钥类型 | 用途 | 轮换周期 | 存储位置 |
|----------|------|----------|----------|
| API Key | 服务间调用 | 90 天 | Vault/配置中心 |
| JWT Secret | Token 签名 | 180 天 | Vault |
| 数据库密码 | DB 连接 | 180 天 | Vault + Secret Operator |
| TLS 证书 | HTTPS | 90 天 | cert-manager |
| SSH 密钥 | 服务器登录 | 365 天 | Vault |

**密钥管理流程**：
```yaml
密钥生成：
  - 使用硬件随机数生成器（HSM）
  - 密钥长度：RSA >= 2048-bit, AES >= 256-bit
  - 禁止硬编码密钥

密钥存储：
  - 使用 HashiCorp Vault / AWS Secrets Manager
  - 启用审计日志
  - 启用自动轮换

密钥使用：
  - 通过环境变量注入（不直接暴露）
  - 运行时从 Vault 拉取
  - 禁止日志输出密钥
```

**密钥轮换策略**：
```yaml
自动轮换：
  - TLS 证书：cert-manager 自动申请
  - 数据库密码：每 180 天通过 Vault 自动轮换
  - API Key：每 90 天自动生成新密钥

手动轮换（紧急）：
  - 密钥泄露后 24 小时内完成轮换
  - 记录轮换审计日志
  - 通知相关方
```

### 10.3 渗透测试规范

**测试周期**：
```yaml
常规渗透测试：
  - 全面测试：每年 2 次（上半年/下半年）
  - 专项测试：重大发布前 1 周
  - 应急测试：安全事件后

测试范围：
  - 外网资产：域名、IP、开放端口
  - 内网资产：核心服务、数据库
  - Web 应用：所有用户可访问页面
  - API 接口：REST/GraphQL/gRPC
```

**测试方法**：
| 测试类型 | 工具 | 测试内容 |
|----------|------|----------|
| 漏洞扫描 | Nessus/OpenVAS | 系统漏洞、配置缺陷 |
| Web 渗透 | Burp Suite/OWASP ZAP | SQL注入、XSS、CSRF |
| API 渗透 | Postman/SoapUI | 认证绕过、越权访问 |
| 社会工程 | 钓鱼模拟 | 员工安全意识 |
| 代码审计 | SonarQube/Semgrep | 代码安全缺陷 |

**漏洞分级**：
| 级别 | 定义 | 修复时限 |
|------|------|----------|
| 严重 (Critical) | 可直接获取服务器权限 | 24 小时 |
| 高危 (High) | 可获取敏感数据或提权 | 7 天 |
| 中危 (Medium) | 可造成一定影响 | 30 天 |
| 低危 (Low) | 信息泄露等轻微问题 | 90 天 |
| 信息 (Info) | 需人工确认的风险 | 180 天 |

### 10.4 数据脱敏规范

**敏感数据分类**：
| 类别 | 数据示例 | 脱敏规则 |
|------|----------|----------|
| 身份认证 | 身份证号、护照号 | `3201***********1234` |
| 金融信息 | 银行卡号、支付密码 | 卡号保留后4位 `****1234` |
| 个人隐私 | 手机号、邮箱、住址 | 手机 `138****5678` |
| 医疗健康 | 病历、体检数据 | 全部掩码 `****` |
| 登录凭证 | 密码、Token | 不可逆哈希或掩码 |
| 业务敏感 | 薪资、绩效、合同 | 按角色可见性控制 |

**脱敏实现**：
```typescript
// 脱敏工具函数示例
function maskPhone(phone: string): string {
  return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
}

function maskIdCard(idCard: string): string {
  return idCard.replace(/(\d{6})\d{8}(\d{4})/, '$1********$2');
}

function maskEmail(email: string): string {
  const [name, domain] = email.split('@');
  return name.charAt(0) + '***@' + domain;
}

function maskBankCard(card: string): string {
  return card.replace(/(\d{16})\d{4}/, '**** **** **** $1');
}
```

**脱敏场景**：
| 场景 | 处理方式 |
|------|----------|
| 日志输出 | 自动脱敏敏感字段 |
| API 返回 | 字段级脱敏配置 |
| 数据库查询 | 列级加密或脱敏 |
| 数据导出 | 导出前批量脱敏 |
| 测试环境 | 使用脱敏数据 |

### 10.5 安全事件响应

**事件分级**：
| 级别 | 定义 | 示例 | 响应时间 |
|------|------|------|----------|
| P0 - 紧急 | 业务中断、数据泄露 | 服务器被黑、DDoS | 15 分钟 |
| P1 - 高 | 核心功能受损 | 数据库被拖、账户被盗 | 1 小时 |
| P2 - 中 | 部分功能异常 | API 被刷、钓鱼攻击 | 4 小时 |
| P3 - 低 | 潜在风险 | 安全扫描发现漏洞 | 24 小时 |

**响应流程**：
```
发现 → 确认 → 遏制 → 根除 → 恢复 → 复盘

1. 发现 (Detection)
   - 监控告警触发
   - 用户报告
   - 内部发现

2. 确认 (Analysis)
   - 评估影响范围
   - 确定事件级别
   - 通知相关方

3. 遏制 (Containment)
   - 隔离受影响系统
   - 阻断攻击链路
   - 保留现场证据

4. 根除 (Eradication)
   - 清除恶意代码
   - 修复安全漏洞
   - 加强安全措施

5. 恢复 (Recovery)
   - 恢复业务运行
   - 验证系统正常
   - 持续监控

6. 复盘 (Post-Mortem)
   - 编写事件报告
   - 分析根本原因
   - 制定改进措施
```

**应急联系方式**：
```yaml
安全响应团队：
  - 安全热线：security@example.com
  - 应急电话：400-XXX-XXXX
  - 7x24 On-Call：安全工程师

外部资源：
  - 网信办：有管辖要求的通报
  - 公安网安：网络安全事件通报
  - 供应商：云服务商安全支持
```

---

## 十一、运维规范

### 11.1 SLA/SLI 详细定义

**SLI（Service Level Indicator）指标**：
| 服务类别 | SLI 指标 | 计算方式 | 目标值 | Prometheus 查询 |
|----------|----------|----------|--------|-----------------|
| **可用性** | 请求成功率 | (成功请求 / 总请求) × 100% | >= 99.95% | `sum(rate(orion_http_requests_total{status=~"2.."}[5m])) / sum(rate(orion_http_requests_total[5m]))` |
| **延迟** | P50 延迟 | 50% 请求响应时间 | < 100ms | `histogram_quantile(0.50, sum(rate(orion_http_request_duration_seconds_bucket[5m])) by (le))` |
| **延迟** | P99 延迟 | 99% 请求响应时间 | < 500ms | `histogram_quantile(0.99, sum(rate(orion_http_request_duration_seconds_bucket[5m])) by (le))` |
| **延迟** | P99.9 延迟 | 99.9% 请求响应时间 | < 1s | `histogram_quantile(0.999, sum(rate(orion_http_request_duration_seconds_bucket[5m])) by (le))` |
| **吞吐量** | QPS | 每秒请求数 | 根据业务 | `sum(rate(orion_http_requests_total[5m]))` |
| **错误率** | 5xx 错误率 | (5xx / 总请求) × 100% | < 0.05% | `sum(rate(orion_http_requests_total{status=~"5.."}[5m])) / sum(rate(orion_http_requests_total[5m]))` |
| **数据** | 读一致性 | 主从同步延迟 | < 1s | `pg_replication_lag_seconds` |
| **数据** | 写成功率 | 写入操作成功率 | >= 99.99% | `sum(rate(orion_db_write_total{status="success"}[5m])) / sum(rate(orion_db_write_total[5m]))` |

**Prometheus 告警规则示例**：
```yaml
groups:
  - name: slo-alerts
    rules:
      - alert: HighErrorRate
        expr: sum(rate(orion_http_requests_total{status=~"5.."}[5m])) / sum(rate(orion_http_requests_total[5m])) > 0.001
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "错误率超过 0.1%，当前: {{ $value }}%"
          description: "服务 {{ $labels.service }} 错误率超标"

      - alert: HighLatencyP99
        expr: histogram_quantile(0.99, sum(rate(orion_http_request_duration_seconds_bucket[5m])) by (le, service)) > 0.5
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "P99 延迟超过 500ms"

      - alert: ErrorBudgetExhausted
        expr: (1 - (sum(rate(orion_http_requests_total{status=~"2.."}[30d])) / sum(rate(orion_http_requests_total[30d])))) > 0.0005
        for: 1h
        labels:
          severity: critical
        annotations:
          summary: "错误预算消耗超过 50%"
```

**SLO（Service Level Objective）目标**：
```yaml
核心服务（Pipeline/Deploy/Artifact）：
  可用性：99.95%（月度）
  P99 延迟：< 500ms
  月度不可用时间：< 21.6 分钟

一般服务（CMDB/User/Tenant）：
  可用性：99.9%（月度）
  P99 延迟：< 1s
  月度不可用时间：< 43.8 分钟

边缘服务（通知/日志/监控）：
  可用性：99.5%（月度）
  P99 延迟：< 2s
  月度不可用时间：< 3.6 小时
```

**错误预算（Error Budget）**：
```yaml
错误预算计算：
  月度可用时间 = 30 天 × 24 小时 × 60 分钟 = 43200 分钟
  核心服务错误预算 = 43200 × 0.05% = 21.6 分钟

消耗策略：
  - 月度消耗 > 50%：启动告警
  - 月度消耗 > 80%：限制变更
  - 月度消耗 > 100%：SLO 违规，需复盘

恢复措施：
  - 优先保障核心服务
  - 降级非核心功能
  - 紧急扩容
```

**告警阈值配置**：
```yaml
# Prometheus Alert Rules
groups:
  - name: slo-alerts
    rules:
      - alert: HighErrorRate
        expr: sum(rate(http_requests_total{status=~"5.."}[5m])) / sum(rate(http_requests_total[5m])) > 0.01
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "错误率超过 1%"

      - alert: HighLatencyP99
        expr: histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket[5m]))) > 0.5
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "P99 延迟超过 500ms"
```

**告警通知渠道配置**：
```yaml
# alertmanager-config.yaml
global:
  resolve_timeout: 5m
  smtp_smarthost: 'smtp.example.com:587'
  smtp_from: 'alertmanager@orion.example.com'

# 告警路由配置
route:
  group_by: ['alertname', 'service']
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 4h
  receiver: 'default'
  routes:
    - match:
        severity: critical
      receiver: 'critical-channel'
    - match:
        team: 'oncall'
      receiver: 'oncall-channel'

# 接收者配置
receivers:
  - name: 'default'
    email_configs:
      - to: 'team@orion.example.com'
        send_resolved: true

  - name: 'critical-channel'
    slack_configs:
      - api_url: '${SLACK_WEBHOOK_URL}'
        channel: '#critical-alerts'
        send_resolved: true

  - name: 'oncall-channel'
    webhook_configs:
      - url: 'http://oncall-service:8080/webhook'
```

**告警升级策略**：
```yaml
升级条件：
  - 告警持续 > 15 分钟未响应 → 升级到二线
  - 告警持续 > 30 分钟未响应 → 升级到三线
  - P0 级别告警 → 直接通知技术总监

升级通知：
  ## 🚨 告警升级通知
  **级别**：{{ .Severity }}
  **持续时间**：{{ .Duration }}
  **当前处理人**：{{ .CurrentAssignee }}
```

### 11.2 日志保留与存储

**日志分类与保留**：
| 日志类型 | 保留期限 | 存储介质 | 压缩策略 |
|----------|----------|----------|----------|
| 业务日志 | 30 天 | ELK/Loki | GZIP |
| 访问日志 | 90 天 | ES Cold Storage | ZSTD |
| 安全日志 | 1 年 | 独立存储 | AES-256 |
| 审计日志 | 3 年 | 对象存储 | 加密存储 |
| 错误日志 | 180 天 | ELK | GZIP |
| 系统日志 | 30 天 | Loki | GZIP |

**日志存储策略**：
```yaml
热数据（0-7天）：
  - 存储：SSD/本地磁盘
  - 副本：2
  - 索引：完整索引

温数据（7-30天）：
  - 存储：HDD/网络存储
  - 副本：1
  - 索引：关键字段

冷数据（30天+）：
  - 存储：对象存储（S3/OSS）
  - 副本：3
  - 索引：仅时间索引
  - 压缩：ZSTD

归档数据（1年+）：
  - 存储：冷存储/磁带
  - 保留：合规要求
  - 需审批查询
```

**日志格式标准**：
```json
{
  "timestamp": "2026-05-22T10:30:00.000Z",
  "level": "INFO",
  "service": "orion-platform-service",
  "trace_id": "abc123def456",
  "span_id": "span789",
  "user_id": "user_123",
  "action": "create_pipeline",
  "resource": "pipeline/pipeline_001",
  "result": "success",
  "duration_ms": 150,
  "metadata": {
    "tenant_id": "tenant_001",
    "ip": "10.0.0.1"
  },
  "message": "Pipeline created successfully"
}
```

### 11.3 容量规划流程

**容量评估模型**：
```yaml
评估维度：
  - QPS 峰值：历史峰值 × 1.5 倍
  - 并发用户：日活 × 10%
  - 数据增长：月度增长 20%
  - 存储容量：当前 × 2（预留）

计算公式：
  所需 Pod 数 = 峰值 QPS / 单 Pod QPS 能力
  所需存储 = 当前存储 × (1 + 月增长率) ^ 规划月数
  所需带宽 = 峰值 QPS × 平均响应大小 × 8 / 1000
```

**扩容阈值**：
| 资源 | 警告阈值 | 扩容阈值 | 扩容方式 |
|------|----------|----------|----------|
| CPU | 70% | 80% | HPA 自动扩容 |
| 内存 | 75% | 85% | HPA 自动扩容 |
| 磁盘 | 80% | 90% | 手动扩容 |
| 连接数 | 70% | 80% | 连接池调整 |
| QPS | 60% | 80% | Pod 扩容 |

**扩容流程**：
```
1. 容量预警
   - 监控告警触发
   - 通知运维团队

2. 评估确认
   - 分析增长趋势
   - 确认扩容必要性

3. 执行扩容
   - HPA 自动或手动调整
   - 验证扩容效果

4. 容量复核
   - 监控指标回归正常
   - 记录扩容历史
```

### 11.4 混沌工程

**故障注入场景**：
| 场景 | 注入方式 | 目标 |
|------|----------|------|
| 网络延迟 | TC 延迟 500ms | 验证超时处理 |
| 网络丢包 | TC 丢包 10% | 验证重试机制 |
| 服务故障 | 杀掉进程 | 验证熔断恢复 |
| 依赖故障 | 关闭依赖服务 | 验证降级逻辑 |
| 资源耗尽 | CPU/内存压满 | 验证告警响应 |
| DNS 故障 | 污染 hosts | 验证 DNS 切换 |

**Chaos 实验配置**：
```yaml
# LitmusChaos 实验示例
apiVersion: litmuschaos.io/v1alpha1
kind: ChaosEngine
metadata:
  name: pod-kill-chaos
  namespace: orion-system
spec:
  appinfo:
    appns: orion-prod
    applabel: "app=platform-service"
  chaosServiceAccount: litmus-admin
  experiments:
    - name: pod-delete
      spec:
        components:
          env:
            - name: TOTAL_CHAOS_DURATION
              value: '30'
            - name: CHAOS_INTERVAL
              value: '10'
            - name: FORCE
              value: 'false'
```

**实验执行规范**：
```yaml
实验频率：
  - 核心服务：每周 1 次
  - 一般服务：每月 1 次
  - 新服务上线：必须通过混沌测试

安全限制：
  - 业务低峰期执行
  - 最多影响 10% 实例
  - 5 分钟内恢复
  - 实时监控告警

实验步骤：
  1. 制定实验计划
  2. 评审实验方案
  3. 通知相关方
  4. 执行实验
  5. 验证恢复
  6. 记录结果
```

### 11.5 Runbook 运维手册

**通用 Runbook 模板**：
```markdown
# Runbook: [问题名称]

## 概述
[简要描述此问题场景]

## 症状
- [症状1]
- [症状2]

## 告警
- 告警名称：xxx_alert
- 触发条件：xxx

## 排查步骤
1. 登录监控平台，查看相关指标
2. 检查服务日志，定位错误
3. 确认影响范围
4. [具体排查命令]

## 解决步骤
1. [步骤1]
2. [步骤2]
3. [步骤3]

## 回滚方案
[如需回滚，描述回滚步骤]

## 验证
- [验证点1]
- [验证点2]

## 联系方式
- 一线：运维团队
- 二线：架构团队
- 三线：开发团队
```

**常见 Runbook 示例**：
```yaml
# 1. 服务不可用
排查命令：
  kubectl get pods -n orion-prod
  kubectl describe pod <pod-name> -n orion-prod
  kubectl logs <pod-name> -n orion-prod --previous

解决措施：
  - 重启 Pod：kubectl delete pod <pod> -n orion-prod
  - 扩容：kubectl scale deployment <deploy> --replicas=3

# 2. 数据库连接问题
排查命令：
  kubectl exec -it <pod> -n orion-prod -- nc -zv db-host 5432
  psql -h db-host -U orion -c "SELECT 1"

解决措施：
  - 检查连接池配置
  - 检查数据库负载
  - 重试连接

# 3. 磁盘空间不足
排查命令：
  kubectl top node
  kubectl get pvc -n orion-prod

解决措施：
  - 清理日志：kubectl logs --tail=1000
  - 扩容 PVC
  - 清理临时文件
```

---

## 十二、事件分级与响应

### 12.1 事件分级标准

**事件分级定义**：
| 级别 | 名称 | 定义 | 影响范围 | 响应时间 | 解决时限 |
|------|------|------|----------|----------|----------|
| P0 | 紧急 | 业务完全中断 | 全局/多业务 | 15 分钟 | 1 小时 |
| P1 | 高 | 核心功能不可用 | 单业务核心功能 | 30 分钟 | 4 小时 |
| P2 | 中 | 功能受损或性能下降 | 部分用户/功能 | 1 小时 | 24 小时 |
| P3 | 低 | 非核心功能异常 | 少量用户 | 4 小时 | 72 小时 |
| P4 | 轻微 | 改进建议/边缘问题 | 无实际影响 | 下一工作日 | 1 周 |

**具体判定标准**：

```yaml
P0 紧急事件：
  - 核心服务完全不可用
  - 数据丢失或损坏
  - 安全漏洞被利用
  - 大量用户无法使用
  - 官方媒体关注

P1 高级事件：
  - 核心服务部分不可用
  - 关键功能响应超时
  - 订单/支付失败
  - 用户数据异常

P2 中级事件：
  - 非核心功能不可用
  - 性能明显下降
  - 部分用户体验问题
  - 告警频繁误报

P3 低级事件：
  - 界面显示问题
  - 边缘功能异常
  - 文档错误
  - 非关键告警

P4 轻微事件：
  - 功能改进建议
  - 界面优化建议
  - 文档完善
```

### 12.2 升级流程

**升级标准**：
```
事件发生 → 一线处理 → 未解决 → 二线介入 → 未解决 → 三线介入 → 未解决 → 管理层

一线（运维/客服）：
  - 响应时间：P0/P1 15分钟内
  - 职责：初步排查、简单问题解决
  - 时限：P0 15分钟，P1 30分钟

二线（架构/资深运维）：
  - 触发条件：一线未解决
  - 职责：深度分析、方案制定
  - 时限：P0 1小时，P1 2小时

三线（开发/技术专家）：
  - 触发条件：二线未解决
  - 职责：代码级修复、紧急发布
  - 时限：P0 2小时，P1 4小时

管理层：
  - 触发条件：P0 持续 1小时未恢复
  - 职责：资源协调、对外沟通
```

**升级通知模板**：
```markdown
## 事件升级通知

**事件编号**：INC-2026-0522-001
**级别**：P0
**标题**：核心服务不可用

**当前状态**：升级至二线
**当前处理人**：张三（架构师）

**问题描述**：
[详细描述]

**已尝试方案**：
1. xxx - 结果：失败
2. xxx - 结果：失败

**需要协助**：
- 资源协调
- 技术支持

**联系方式**：
电话：138-xxxx-xxxx
```

### 12.3 Post-Mortem 模板

**事件回顾模板**：
```markdown
# Post-Mortem 事件回顾报告

## 基本信息
| 字段 | 内容 |
|------|------|
| 事件编号 | INC-2026-0522-001 |
| 事件级别 | P0 |
| 发生时间 | 2026-05-22 10:00:00 UTC |
| 恢复时间 | 2026-05-22 10:45:00 UTC |
| 影响时长 | 45 分钟 |
| 影响范围 | 全部用户 |
| 处理人员 | 张三、李四、王五 |

## 事件概述
[简要描述事件经过]

## 时间线（UTC）
| 时间 | 事件 |
|------|------|
| 10:00 | 监控告警触发 |
| 10:05 | 一线响应，确认问题 |
| 10:15 | 升级至二线 |
| 10:30 | 定位到数据库连接问题 |
| 10:40 | 执行恢复操作 |
| 10:45 | 服务恢复，告警关闭 |

## 根因分析
### 直接原因
[直接导致问题的技术原因]

### 根本原因
[更深层次的问题根源]

### 根本原因分析（5Why）
1. 为什么？- 因为...
2. 为什么？- 因为...
3. 为什么？- 因为...
4. 为什么？- 因为...
5. 为什么？- 因为...

## 影响评估
- 用户影响：xxxx 用户受影响
- 业务影响：订单量下降 xx%
- 经济损失：预估 xx 万元

## 改进措施
| 措施 | 负责人 | 完成时间 | 状态 |
|------|--------|----------|------|
| 优化数据库连接池配置 | 张三 | 2026-05-29 | 待处理 |
| 增加熔断降级策略 | 李四 | 2026-06-05 | 待处理 |
| 完善监控告警规则 | 王五 | 2026-05-25 | 待处理 |

## 经验教训
1. [学到的经验1]
2. [学到的经验2]
3. [需要改进的流程]

## 相关文档
- 告警记录：xxx
- 日志快照：xxx
- 监控截图：xxx
```

---

## 十三、POC 概念验证规范

### 13.1 POC 定义与场景

**POC（概念验证）适用场景**：
| 场景 | 说明 | 决策依据 |
|------|------|----------|
| 新技术引入 | 评估新框架/工具/服务 | 技术适配性、性能、成本 |
| 架构变更 | 微服务拆分、多租户改造 | 可行性、风险、收益 |
| 性能优化 | 新缓存方案、数据库选型 | 性能提升、资源消耗 |
| 安全增强 | 新认证方案、加密算法 | 安全性、兼容性 |
| 集成验证 | 第三方系统对接 | 接口兼容性、数据一致性 |

**POC 触发条件**：
```yaml
必须进行 POC 的场景：
  - 引入新的核心技术栈
  - 架构方案存在不确定性
  - 性能指标无明确数据支撑
  - 涉及生产环境重大变更

建议进行 POC 的场景：
  - 新工具/库引入
  - 配置参数调优
  - 非核心功能技术选型
```

### 13.2 POC 执行流程

**标准 POC 流程**：
```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   1. 立项    │ ──► │   2. 方案设计 │ ──► │   3. 执行验证 │ ──► │   4. 评估总结 │
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
      │                    │                    │                    │
   明确目标           设计验证方案         搭建验证环境         输出决策结论
   组建团队           定义成功标准         实施验证步骤         归档文档
```

**各阶段详细说明**：

**阶段 1：立项**
```markdown
## POC 立项申请书

| 字段 | 内容 |
|------|------|
| POC 名称 | [简明扼要] |
| 申请人 | [姓名/团队] |
| 申请日期 | YYYY-MM-DD |
| 目标 | [要验证的核心问题] |
| 背景 | [为什么需要 POC] |
| 预期产出 | [交付物] |
| 预期周期 | X 天 |
| 资源需求 | [环境/人力的需求] |
```

**阶段 2：方案设计**
```markdown
## POC 验证方案

### 2.1 验证目标
- 目标 1：xxx
- 目标 2：xxx

### 2.2 成功标准
| 指标 | 达标值 | 评估方法 |
|------|--------|----------|
| 性能 | QPS > 1000 | 压测工具 |
| 延迟 | P99 < 100ms | APM 监控 |
| 资源 | CPU < 50% | 监控指标 |

### 2.3 验证环境
- 规格：4C8G * 3 节点
- 网络：内网测试环境
- 数据量：模拟 100 万条记录

### 2.4 测试用例
| 用例 | 步骤 | 预期结果 |
|------|------|----------|
| 基础功能 | 执行核心操作 | 功能正常 |
| 性能测试 | 100 并发压测 | QPS > 1000 |
| 异常测试 | 模拟故障 | 正确降级 |

### 2.5 风险与措施
| 风险 | 影响 | 应对措施 |
|------|------|----------|
| 数据丢失 | 高 | 每日备份 |
| 服务中断 | 中 | 快速回滚 |
```

**阶段 3：执行验证**
```markdown
## POC 执行记录

### 3.1 每日进展
| 日期 | 进展 | 问题 | 解决 |
|------|------|------|------|
| D1 | 环境搭建 | 依赖冲突 | 调整版本 |
| D2 | 基础功能验证 | - | - |
| D3 | 性能压测 | 内存溢出 | 调优 JVM |

### 3.2 测试数据
- 测试数据量：100 万条
- 测试并发：100/200/500/1000
- 测试时长：30 分钟/轮

### 3.3 监控数据
[关键指标截图/数据]
```

**阶段 4：评估总结**
```markdown
## POC 评估报告

### 4.1 结论
- [ ] 通过 - 可进入生产评估
- [ ] 有条件通过 - 需修复问题
- [ ] 未通过 - 不适合当前场景

### 4.2 详细评估
| 验证项 | 结果 | 数据支撑 |
|--------|------|----------|
| 功能完整性 | 通过 | 全部功能正常 |
| 性能指标 | 通过 | QPS=1200 |
| 稳定性 | 通过 | 24h 无异常 |
| 兼容性 | 部分通过 | 需调整版本 |

### 4.3 风险评估
| 风险点 | 等级 | 缓解措施 |
|--------|------|----------|
| 学习成本 | 中 | 需培训 |
| 运维复杂度 | 低 | 文档完善 |

### 4.4 建议
- 建议 1：xxx
- 建议 2：xxx

### 4.5 后续计划
- [ ] 推进生产落地
- [ ] 优化后重新 POC
- [ ] 放弃该方案
```

### 13.3 POC 模板

**POC 文档模板**：
```markdown
---
title: "[POC] 技术方案名称"
type: poc
status: draft | in_progress | completed | cancelled
version: "1.0"
created: "2026-05-22"
owner: "负责人"
reviewer: "评审人"
tags: [poc, 技术验证]
---

# [POC] XXX 技术方案验证

## 一、立项背景

### 1.1 问题描述
[当前面临的问题或需求]

### 1.2 目标
- 验证 xxx 功能可行性
- 评估 xxx 性能指标
- 确定 xxx 是否适合生产环境

### 1.3 评估标准
| 维度 | 指标 | 目标值 | 权重 |
|------|------|--------|------|
| 功能 | 核心功能可用性 | 100% | 30% |
| 性能 | QPS | > 1000 | 30% |
| 稳定 | 错误率 | < 0.1% | 20% |
| 成本 | 资源消耗 | < 50% 增幅 | 20% |

## 二、验证方案

### 2.1 测试环境
- 集群：xxx
- 配置：xxx
- 数据：xxx

### 2.2 测试用例
| ID | 用例名称 | 验证方法 | 成功标准 |
|----|----------|----------|----------|
| TC-01 | 基础功能验证 | 手动/自动化 | 功能正常 |
| TC-02 | 性能测试 | 压测工具 | QPS > 1000 |
| TC-03 | 压力测试 | 逐步加压 | 系统稳定 |
| TC-04 | 故障恢复 | 模拟故障 | 自动恢复 |

## 三、执行记录

### 3.1 测试结果
| 用例 | 结果 | 实际值 | 备注 |
|------|------|--------|------|
| TC-01 | PASS | - | 全部功能正常 |
| TC-02 | PASS | QPS=1500 | 超出预期 |
| TC-03 | PASS | 10 分钟稳定 | - |
| TC-04 | PASS | 30s 恢复 | - |

### 3.2 监控数据
[压测曲线、资源使用图]

## 四、评估结论

### 4.1 综合评估
- 评分：85/100
- 结论：✅ 通过

### 4.2 优缺点分析
**优点**：
- xxx
- xxx

**缺点**：
- xxx
- xxx

### 4.3 风险与建议
| 风险 | 等级 | 建议 |
|------|------|------|
| 学习成本 | 中 | 需培训 |
| 社区活跃度 | 低 | 需持续关注 |

### 4.4 决策
- [ ] 建议采用
- [ ] 有条件采用（修复问题）
- [ ] 暂不采用

## 五、附件
- 测试脚本
- 监控截图
- 相关文档
```

---

## 十四、SOP 标准操作规范

### 14.1 SOP 定义与范围

**SOP（标准操作流程）适用场景**：
| 类别 | 场景 | 频率 |
|------|------|------|
| 日常运维 | 服务启停、日志清理、备份验证 | 每日/每周 |
| 变更操作 | 发布回滚、配置变更、扩缩容 | 按需 |
| 故障处理 | 应急响应、问题定位、故障恢复 | 紧急 |
| 监控运营 | 告警处理、巡检报告、容量评估 | 定期 |
| 数据管理 | 数据导出、权限回收、审计查询 | 定期 |

### 14.2 SOP 模板

**标准 SOP 模板**：
```markdown
# [SOP-XXX] 标准操作流程

## 基本信息
| 字段 | 内容 |
|------|------|
| SOP 编号 | SOP-XXX-001 |
| SOP 名称 | 服务重启标准操作流程 |
| 所属团队 | 运维团队 |
| 创建日期 | 2026-05-22 |
| 更新周期 | 每季度review |
| 责任人 | 运维负责人 |
| 审批人 | 技术总监 |

## 1. 目的
[明确此操作的目的和背景]

## 2. 适用范围
[说明此 SOP 适用的场景和范围]

## 3. 前置条件
- [ ] 条件 1
- [ ] 条件 2
- [ ] 条件 3

## 4. 操作步骤

### 4.1 步骤一：准备工作
```bash
# 检查当前服务状态
kubectl get pods -n orion-prod

# 确认无正在执行的发布
kubectl rollout status deployment/orion-platform-service -n orion-prod
```

### 4.2 步骤二：执行操作
```bash
# 滚动重启
kubectl rollout restart deployment/orion-platform-service -n orion-prod

# 观察状态
kubectl get pods -n orion-prod -w
```

### 4.3 步骤三：验证
```bash
# 健康检查
curl -f http://localhost:3001/healthz

# 业务验证
curl -f http://localhost:3001/api/v1/ping
```

### 4.4 步骤四：回滚（如需要）
```bash
# 回滚到上一版本
kubectl rollout undo deployment/orion-platform-service -n orion-prod
```

## 5. 预期结果
- 服务正常运行
- 无报错
- 业务功能正常

## 6. 常见问题
| 问题 | 原因 | 解决 |
|------|------|------|
| Pod 无法启动 | 资源配置不足 | 检查资源限制 |
| 健康检查失败 | 端口未就绪 | 延长 initialDelaySeconds |
| 服务无响应 | 流量未切换 | 检查 Service 状态 |

## 7. 相关文档
- [SOP-XXX-002] 服务监控巡检
- [SOP-XXX-003] 故障应急响应

## 8. 变更记录
| 日期 | 修改人 | 变更内容 |
|------|--------|----------|
| 2026-05-22 | 张三 | 初始版本 |
```

### 14.3 日常运维 SOP 示例

**SOP-01：服务健康检查**
```markdown
# SOP-01 服务健康检查

## 执行频率
每日 9:00 - 10:00

## 执行步骤
1. 登录监控平台
2. 检查核心服务状态
3. 记录异常告警
4. 汇总日报

## 检查清单
- [ ] API 成功率 > 99%
- [ ] P99 延迟 < 500ms
- [ ] 磁盘使用率 < 80%
- [ ] 内存使用率 < 85%
- [ ] 无 P0/P1 告警

## 输出
- 每日运维日报
- 异常记录表
```

**SOP-02：日志清理**
```markdown
# SOP-02 日志清理

## 执行频率
每周一 03:00

## 执行步骤
1. 检查日志磁盘使用率
2. 清理 7 天前的业务日志
3. 清理 30 天前的历史日志
4. 验证清理结果

## 命令示例
```bash
# 查找并清理 7 天前的日志
find /var/log/orion -name "*.log" -mtime +7 -delete

# 清理 Kubernetes Pod 日志
kubectl delete pods -n orion-prod --field-selector=status.phase=Succeeded
```
```

**SOP-03：备份验证**
```markdown
# SOP-03 备份验证

## 执行频率
每日 06:00

## 执行步骤
1. 检查备份任务执行状态
2. 验证备份文件完整性
3. 恢复测试（可选）
4. 记录备份结果
```

### 14.4 变更操作 SOP 示例

**SOP-04：配置变更**
```markdown
# SOP-04 配置变更

## 风险等级
中

## 审批流程
- 普通配置：运维负责人审批
- 敏感配置：运维 + 安全审批
- 核心配置：技术总监审批

## 执行步骤
1. 提交变更申请
2. 审批通过
3. 备份当前配置
4. 执行变更
5. 验证功能
6. 观察监控
7. 确认完成

## 回滚方案
- 立即回滚到备份配置
- 观察 30 分钟无异常
```

**SOP-05：服务扩缩容**
```markdown
# SOP-05 服务扩缩容

## 触发条件
- 告警：CPU > 80% 持续 5 分钟
- 告警：内存 > 85% 持续 5 分钟
- 计划性扩容：重大活动前

## 执行步骤
1. 分析当前资源使用
2. 确认扩容策略（水平/垂直）
3. 执行扩缩容
4. 验证服务正常
5. 监控指标回归

## 扩容上限
- 最大副本数：20
- 最小副本数：3
```

### 14.5 故障处理 SOP 示例

**SOP-06：服务不可用应急响应**
```markdown
# SOP-06 服务不可用应急响应

## 响应时效
P0: 15 分钟内响应

## 执行步骤
1. **发现阶段** (0-5分钟)
   - 确认告警真实性
   - 通知相关人员
   - 记录事件编号

2. **评估阶段** (5-15分钟)
   - 确定影响范围
   - 初步定位问题
   - 决定应急策略

3. **止血阶段** (15-30分钟)
   - 执行止血操作
   - 切换流量/回滚/重启
   - 持续沟通进展

4. **恢复阶段** (30分钟-2小时)
   - 确认服务恢复
   - 验证业务正常
   - 持续监控

5. **复盘阶段** (2小时后)
   - 编写事件报告
   - 分析根本原因
   - 制定改进措施

## 联系方式
- 一线值班：138-xxxx-xxxx
- 架构师：139-xxxx-xxxx
- 技术总监：137-xxxx-xxxx
```

### 14.6 SOP 维护规范

**SOP 生命周期管理**：
```yaml
创建流程：
  1. 由实际操作人员编写初稿
  2. 团队内部评审
  3. 专家评审
  4. 审批发布
  5. 纳入 SOP 库

更新流程：
  - 触发条件：
    - 操作流程变更
    - 工具/环境变更
    - 发现问题/优化点
    - 每季度定期 review
  - 更新后需重新评审

废弃流程：
  - 评估影响范围
  - 确认无依赖
  - 标记废弃
  - 更新索引
```

**SOP 质量检查**：
| 检查项 | 要求 |
|--------|------|
| 步骤完整性 | 每步都有明确操作 |
| 可执行性 | 命令可直接复制使用 |
| 验证点 | 关键步骤有验证方法 |
| 回滚方案 | 有明确的回滚步骤 |
| 异常处理 | 有常见问题解决方案 |

---

## 十五、相关文档索引

| 文档 | 说明 |
|------|------|
| [INDEX.md](../INDEX.md) | 完整文档索引 |
| [CLAUDE.md](../CLAUDE.md) | 项目上下文与命令 |
| [docs/architecture/code-architecture-layers.md](architecture/code-architecture-layers.md) | 代码架构分层 |
| [docs/architecture/当前系统架构.md](architecture/当前系统架构.md) | 当前实际架构 |
| [docs/文档管理规范.md](文档管理规范.md) | 文档管理规范 |
| [docs/frontend/前端架构设计.md](frontend/前端架构设计.md) | 前端架构设计 |

---

> 维护者: Orion 架构团队 | 更新频率: 按需更新 | 最后更新: 2026-05-21