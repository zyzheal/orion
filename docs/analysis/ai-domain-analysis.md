# Orion AI 域综合分析报告

**生成日期**: 2026-07-02
**分析范围**: `services/ai/` + `services/ai-agents/` + `services/agent/` + `services/ai-review/` + `services/llm-trace/` + `services/ai-training/` + `services/mlops/` + `orion-ai-service/` + `orion-ai-svc/` + `orion-ai-agents-svc/`
**权威实现**: `orion-ai-service` (Python) + `orion-ai-agents-svc` (Python)
**迁移状态**: TS → Python 迁移进行中，详见 [AI 迁移计划](../ai-migration-plan-2026-07-02.md)

---

## 一、域概览

### 1.1 目录矩阵

| 目录 | 语言 | 文件数 | 代码行数 | 角色 | 状态 |
|------|------|--------|---------|------|------|
| `services/ai/` | TypeScript | 40 | ~25,000 | **待迁移** | LLM 网关/生成/Prompt 安全/向量/ML |
| `services/ai-agents/` | TypeScript | 16 | ~8,000 | **待迁移** | 5 类 Agent |
| `services/agent/` | TypeScript | 10 | ~3,500 | 保留 TS | Agent 沙箱运行时 |
| `services/ai-review/` | TypeScript | 14 | ~2,500 | **待迁移** | AI 代码审查 |
| `services/llm-trace/` | TypeScript | 8 | ~1,500 | **待迁移** | LLM 追踪 |
| `services/ai-training/` | TypeScript | 7 | ~1,200 | **待迁移** | 模型训练 |
| `services/mlops/` | TypeScript | 3 | ~500 | **待迁移** | MLOps |
| `orion-ai-service/` | Python | 7 | ~800 | **权威** | FastAPI + NATS 骨架 |
| `orion-ai-svc/` | TypeScript | 1 | ~50 | 蓝图 | 微服务拆分预留 |
| `orion-ai-agents-svc/` | Python | 4 | ~200 | **权威** | Agent 蓝图 |
| `services/model-version/` | TypeScript | 2 | ~800 | **待迁移** | 模型版本管理 |
| `services/vector-store/` | TypeScript | 3 | ~900 | **待迁移** | 向量存储+检索 |
| `services/vectorize-rules/` | TypeScript | 2 | ~300 | **待迁移** | 向量化规则引擎 |
| `services/knowledge/` | TypeScript | 4 | ~1,500 | Pending | 知识库管理（orion-knowledge） |
| `services/skill/` | TypeScript | 3 | ~1,200 | 保留 TS | 技能系统（跨域） |
| **合计** | — | **~124** | **~47,450** | — | — |

### 1.2 核心能力分布

```
AI 域 = AI 核心引擎 + Agent 框架 + 辅助能力

AI 核心引擎 (services/ai/, 40 文件)
├── AIGateway          — LLM 提供商路由、负载均衡
├── AIGenerateService  — 文本生成、对话
├── PromptSecurity     — Prompt 安全配置
├── PromptInjectionDetector — 注入攻击检测
├── PromptSanitizer    — Prompt 清洗
├── VectorStore        — 向量存储接口
├── CodeEmbeddingService — 代码嵌入
├── SemanticSearchService — 语义搜索
├── MLInferenceService — ML 模型推理
├── ModelVersionService — 模型版本管理
├── CostOptimizerService — 成本优化分析
├── AIDiagnosisService — AI 诊断
├── DecisionExplanationService — 决策解释
├── RuleEngine         — 规则引擎
├── AIDegradationRouter — 降级路由
├── CircuitBreakerManager — 熔断管理
├── ProviderCircuitBreaker — 提供商熔断
└── types / vector-types — 类型定义

Agent 框架 (services/ai-agents/ + services/agent/, 26 文件)
├── BaseAgent          — Agent 基类
├── ToolAdapter        — 工具适配器（5 预置工具）
├── PerfOptAgent       — 性能优化 Agent
├── PipelineYamlAgent  — Pipeline YAML Agent
├── ReleaseNotesAgent  — 发布说明 Agent
├── AgentRepository    — Agent 数据 Repository
├── AgentSandbox       — Worker Thread 隔离
└── sandbox-worker     — 沙箱 Worker

辅助能力
├── AI Review (services/ai-review/, 14 文件) — AI 代码审查
├── LLM Trace (services/llm-trace/, 8 文件)  — LLM 追踪
├── AI Training (services/ai-training/, 7 文件) — 模型训练
└── MLOps (services/mlops/, 3 文件)          — 模型版本/部署

新增 AI 关联服务
├── Model Version (services/model-version/, 2 文件) — 模型版本生命周期
├── Vector Store (services/vector-store/, 3 文件)    — 向量存储/语义检索
├── Vectorize Rules (services/vectorize-rules/, 2 文件) — 向量化规则引擎
├── Knowledge (services/knowledge/, 4 文件)          — 知识库管理（orion-knowledge 子项目）
└── Skill (services/skill/, 3 文件)                  — 技能系统（跨域，非 AI 专属）
```

---

## 二、TS → Python 功能映射

### 2.1 services/ai/ → orion-ai-service

| TS 文件 | 类名 | 功能 | Python 目标 | 优先级 |
|---------|------|------|------------|--------|
| `PromptSecurity.ts` | PromptSecurity | 安全配置 | `src/services/prompt_security.py` | P0 |
| `PromptInjectionDetector.ts` | PromptInjectionDetector | 注入检测 | `src/services/prompt_security.py` | P0 |
| `PromptSanitizer.ts` | PromptSanitizer | Prompt 清洗 | `src/services/prompt_security.py` | P0 |
| `AIGateway.ts` | AIGateway | LLM 路由/负载均衡 | `src/services/llm_gateway.py` | P0 |
| `AIGenerateService.ts` | AIGenerateService | 文本生成/对话 | `src/services/generation.py` | P0 |
| `CircuitBreakerManager.ts` | CircuitBreakerManager | 熔断管理 | `src/services/circuit_breaker.py` | P1 |
| `ProviderCircuitBreaker.ts` | ProviderCircuitBreaker | 提供商熔断 | `src/services/circuit_breaker.py` | P1 |
| `VectorStore.ts` | VectorStore | 向量存储接口 | `src/services/vector_store.py` | P1 |
| `CodeEmbeddingService.ts` | CodeEmbeddingService | 代码嵌入 | `src/services/vector_store.py` | P1 |
| `SemanticSearchService.ts` | SemanticSearchService | 语义搜索 | `src/services/vector_store.py` | P1 |
| `MLInferenceService.ts` | MLInferenceService | ML 推理 | `src/services/ml_inference.py` | P1 |
| `ModelVersionService.ts` | ModelVersionService | 模型版本 | `src/services/model_version.py` | P1 |
| `CostOptimizerService.ts` | CostOptimizerService | 成本优化 | `src/services/cost_optimizer.py` | P2 |
| `AIDiagnosisService.ts` | AIDiagnosisService | AI 诊断 | `src/services/diagnosis.py` | P2 |
| `DecisionExplanationService.ts` | DecisionExplanationService | 决策解释 | `src/services/explanation.py` | P2 |
| `RuleEngine.ts` | RuleEngine | 规则引擎 | `src/services/rule_engine.py` | P2 |
| `AIDegradationRouter.ts` | AIDegradationRouter | 降级路由 | `src/services/degradation_router.py` | P2 |
| `types.ts` | — | 类型定义 | `src/models/ai_types.py` | P1 |
| `vector-types.ts` | — | 向量类型 | `src/models/vector_types.py` | P1 |

### 2.2 services/ai-agents/ → orion-ai-agents-svc

| TS 文件 | 类名 | 功能 | Python 目标 | 优先级 |
|---------|------|------|------------|--------|
| `base/BaseAgent.ts` | BaseAgent | Agent 基类 | `app/agents/base.py` | P0 |
| `base/ToolAdapter.ts` | ToolAdapter | 工具适配器 | `app/agents/tools.py` | P0 |
| `monitoring/` (空) | — | 监控 Agent | `app/agents/monitoring.py` | P2 |
| `performance/PerfOptAgent.ts` | PerfOptAgent | 性能优化 | `app/agents/performance.py` | P1 |
| `pipeline/PipelineYamlAgent.ts` | PipelineYamlAgent | Pipeline YAML | `app/agents/pipeline.py` | P1 |
| `release/ReleaseNotesAgent.ts` | ReleaseNotesAgent | 发布说明 | `app/agents/release.py` | P1 |
| `stability/types.ts` | — | 稳定性类型 | `app/agents/stability_types.py` | P2 |

### 2.3 其他迁移

| 源目录 | 功能 | 目标 | 优先级 |
|--------|------|------|--------|
| `services/ai-review/` | AI 代码审查 | `src/services/code_review.py` | P1 |
| `services/llm-trace/` | LLM 追踪 | `src/services/llm_trace.py` | P1 |
| `services/ai-training/` | 模型训练 | `src/services/training.py` | P2 |
| `services/mlops/` | MLOps | 合并到 `model_version.py` | P2 |

### 2.4 新增 AI 关联服务映射

| 源目录 | 源文件 | 功能 | Python 目标 | 优先级 |
|--------|--------|------|------------|--------|
| `services/model-version/` | ModelVersionService.ts | 模型版本管理 | `src/services/model_version.py`（与 MLInference 合并） | P1 |
| `services/vector-store/` | VectorStoreService.ts | 向量存储 CRUD + 检索 | `src/services/vector_store.py` | P1 |
| `services/vectorize-rules/` | VectorizeRulesService.ts | 向量化规则引擎 | `src/services/vectorize_rules.py` | P2 |
| `services/knowledge/` | KnowledgeService.ts | 知识库条目管理 | 保留 orion-knowledge 独立项目 | — |
| `services/skill/` | SkillService.ts | 技能系统（跨域） | 保留 TS 不变 | — |

---

## 三、API 端点清单

### 3.1 Python 服务当前 API（orion-ai-service）

| 方法 | 路径 | 功能 | 状态 |
|------|------|------|------|
| GET | `/` | 服务信息 | ✅ 已实现 |
| GET | `/api/v1/ai/healthz` | 健康检查 | ✅ 已实现 |
| GET | `/api/v1/ai/status` | 服务状态 | ✅ 已实现 |

### 3.2 TS 服务 API（services/ai/，需迁移）

| 方法 | 路径 | 功能 | TS 状态 | Python 迁移 |
|------|------|------|---------|------------|
| POST | `/api/v1/ai/generate` | 文本生成 | ✅ 已实现 | 🔄 待迁移 |
| POST | `/api/v1/ai/chat` | 对话 | ✅ 已实现 | 🔄 待迁移 |
| POST | `/api/v1/ai/embed` | 代码嵌入 | ✅ 已实现 | 🔄 待迁移 |
| POST | `/api/v1/ai/search` | 语义搜索 | ✅ 已实现 | 🔄 待迁移 |
| POST | `/api/v1/ai/review` | AI 代码审查 | ✅ 已实现 | 🔄 待迁移 |
| POST | `/api/v1/ai/diagnose` | AI 诊断 | ✅ 已实现 | 🔄 待迁移 |
| POST | `/api/v1/ai/optimize-cost` | 成本优化 | ✅ 已实现 | 🔄 待迁移 |
| GET | `/api/v1/ai/models` | 模型列表 | ✅ 已实现 | 🔄 待迁移 |
| GET | `/api/v1/ai/models/:id` | 模型详情 | ✅ 已实现 | 🔄 待迁移 |
| POST | `/api/v1/ai/models/:id/predict` | 模型推理 | ✅ 已实现 | 🔄 待迁移 |
| GET | `/api/v1/ai/traces` | LLM 追踪列表 | ✅ 已实现 | 🔄 待迁移 |
| GET | `/api/v1/ai/training/jobs` | 训练任务列表 | ✅ 已实现 | 🔄 待迁移 |
| POST | `/api/v1/ai/training/jobs` | 创建训练任务 | ✅ 已实现 | 🔄 待迁移 |
| POST | `/api/v1/ai/agents/run` | Agent 运行 | ✅ 已实现 | 🔄 待迁移 |
| GET | `/api/v1/ai/agents/:id` | Agent 状态 | ✅ 已实现 | 🔄 待迁移 |
| POST | `/api/v1/ai/agents/:id/stop` | 停止 Agent | ✅ 已实现 | 🔄 待迁移 |
| POST | `/api/v1/ai/vectorize` | 向量化文本 | ✅ 已实现 | 🔄 待迁移 |
| POST | `/api/v1/ai/vectorize/search` | 向量相似搜索 | ✅ 已实现 | 🔄 待迁移 |
| GET | `/api/v1/ai/models/versions` | 模型版本列表 | ✅ 已实现 | 🔄 待迁移 |
| GET | `/api/v1/knowledge` | 知识库列表 | ✅ 已实现 | 保留 orion-knowledge |

### 3.3 API 迁移策略

1. **路径保持一致**: Python 服务沿用 `/api/v1/ai/` 和 `/api/v1/agent/` 前缀
2. **渐进式切换**: Python 服务新增端点 → 前端 API 客户端 baseURL 切换 → 双写验证 → 下线 TS 路由
3. **前端影响**: `orion-frontend/src/api/ai.ts` baseURL 从 `:3001` 改为 `:8000`

---

## 四、数据模型

### 4.1 当前 Python 模型（orion-ai-service）

| 模型 | 文件 | 字段 |
|------|------|------|
| `HealthCheckResponse` | `src/models/__init__.py` | status, version, timestamp, components |
| `NatsConnectionStatus` | `src/models/__init__.py` | connected, servers, last_connected_at, reconnect_attempts |
| `AIServiceStatus` | `src/models/__init__.py` | available, model_endpoint, note |
| `CloudEvent` | `src/models/__init__.py` | id, source, type, specversion, datacontenttype, time, data |
| `PipelineRunCompletedEvent` | `src/models/__init__.py` | pipeline_id, run_id, status, project_id, branch, commit_sha, duration_ms, stages |
| `CodePROpenedEvent` | `src/models/__init__.py` | pr_id, source_branch, target_branch, project_id, repo_adapter_id, author, title, commit_shas, changed_files |
| `AIAnalysisResult` | `src/models/__init__.py` | analysis_id, event_type, event_id, status, result, created_at, completed_at |

### 4.2 需新增的 Python 模型

| 模型 | 目标文件 | 来源 TS |
|------|---------|---------|
| `LLMProviderConfig` | `src/models/llm.py` | AIGateway.ts |
| `GenerationRequest/Response` | `src/models/generation.py` | AIGenerateService.ts |
| `ChatMessage` | `src/models/chat.py` | types.ts |
| `EmbeddingRequest/Response` | `src/models/embedding.py` | CodeEmbeddingService.ts |
| `SearchRequest/SearchResult` | `src/models/search.py` | SemanticSearchService.ts |
| `MLModel/PredictionResult` | `src/models/ml.py` | MLInferenceService.ts |
| `CostAnalysisReport` | `src/models/cost.py` | CostOptimizerService.ts |
| `DiagnosisResult` | `src/models/diagnosis.py` | AIDiagnosisService.ts |
| `LLMTraceRecord` | `src/models/trace.py` | llm-trace/ |
| `TrainingJob` | `src/models/training.py` | ai-training/ |
| `AgentTask` | `app/models/agent.py` | ai-agents/ |
| `ReviewResult` | `src/models/review.py` | ai-review/ |

---

## 五、外部依赖

### 5.1 Python 服务当前依赖

| 依赖 | 用途 |
|------|------|
| `fastapi` | Web 框架 |
| `pydantic-settings` | 配置管理 |
| `pydantic` | 数据校验 |
| `nats-py` | NATS 客户端 |
| `pytest` | 测试框架 |
| `pytest-asyncio` | 异步测试 |
| `httpx` | HTTP 客户端（测试） |

### 5.2 需新增的 Python 依赖

| 依赖 | 用途 | 对应 TS 依赖 |
|------|------|-------------|
| `litellm` | 统一 LLM 提供商接口 | AIGateway 自定义实现 |
| `openai` | OpenAI SDK | AIGateway |
| `pgvector` | PostgreSQL 向量扩展 | VectorStore |
| `qdrant-client` | 向量数据库（备选） | VectorStore |
| `tree-sitter` | 代码解析 | CodeEmbeddingService |
| `jinja2` | Prompt 模板 | PromptSanitizer |
| `torch` / `onnxruntime` | ML 推理 | MLInferenceService |
| `prometheus-client` | Prometheus 指标 | 可观测性 |

### 5.3 基础设施依赖

| 组件 | 当前 | 迁移后 |
|------|------|--------|
| LLM 提供商 | TS AIGateway | Python LiteLLM |
| 向量存储 | TS VectorStore (接口) | Python pgvector / Qdrant |
| 消息队列 | NATS (已有) | 保持不变 |
| 数据库 | 内存 Map | PostgreSQL + pgvector |

---

## 六、事件总线集成

### 6.1 已有事件（Python 服务消费）

| 主题 | 方向 | 处理器 | 状态 |
|------|------|--------|------|
| `pipeline.run.completed` | 消费 | `handle_pipeline_run_completed` | ✅ 已实现 |
| `code.pr.opened` | 消费 | `handle_code_pr_opened` | ✅ 已实现 |

### 6.2 需新增的事件

| 主题 | 方向 | 事件类型 | 优先级 |
|------|------|---------|--------|
| `ai.generation.completed` | 发布 | AIGenerationCompletedEvent | P1 |
| `ai.review.completed` | 发布 | AIReviewCompletedEvent | P1 |
| `ai.agent.task.completed` | 发布 | AgentTaskCompletedEvent | P1 |
| `ai.model.deployed` | 发布 | AIModelDeployedEvent | P2 |
| `ai.training.completed` | 发布 | AITrainingCompletedEvent | P2 |

---

## 七、与平台服务的关系

### 7.1 当前耦合点

| TS 服务 | 被平台服务 import | 耦合方式 |
|---------|-----------------|---------|
| `services/ai/AIGateway` | PipelineService, CodeService | 直接 import |
| `services/ai/CostOptimizerService` | FinOpsService | 直接 import |
| `services/ai/AIDiagnosisService` | DiagnosticService | 直接 import |
| `services/ai/DecisionExplanationService` | Multiple | 直接 import |
| `services/ai/ModelVersionService` | MLInferenceService | 直接 import |
| `services/ai-agents/` | AgentService | 通过 Agent 框架 |

### 7.2 解耦策略

迁移完成后，平台服务通过以下方式与 AI 域交互：
1. **事件驱动**：发布事件到 NATS，Python 服务消费
2. **HTTP API**：调用 Python 服务的 `/api/v1/ai/*` 端点
3. **不再直接 import**：消除 TS → TS 的进程内调用

---

## 八、测试覆盖

### 8.1 Python 服务当前测试

| 文件 | 测试数 | 覆盖模块 |
|------|--------|---------|
| `tests/test_config.py` | 7 | Settings |
| `tests/test_models.py` | 9 | Pydantic 模型 |
| `tests/test_api_routes.py` | 5 | HTTP 端点 |
| `tests/test_ai_service.py` | 4 | AI 服务占位 |
| `tests/test_events.py` | 6 | 事件处理器 |
| **合计** | **~31** | — |

### 8.2 TS 服务测试

| 目录 | 测试文件数 | 状态 |
|------|-----------|------|
| `services/ai/__tests__/` | ~3 | 部分覆盖 |
| `services/ai-agents/__tests__/` | 0 | 无测试 |
| `services/agent/__tests__/` | ~2 | 部分覆盖 |

---

## 九、待实现清单

| 优先级 | 功能 | 来源 | 预计工时 |
|--------|------|------|---------|
| P0 | Prompt 安全（注入检测 + 清洗） | PromptSecurity.ts | 3 天 |
| P0 | AIGateway（LLM 路由 + 负载均衡） | AIGateway.ts | 5 天 |
| P0 | AIGenerateService（生成 + 对话） | AIGenerateService.ts | 5 天 |
| P1 | 向量存储（pgvector/Qdrant） | VectorStore.ts | 5 天 |
| P1 | 代码嵌入 + 语义搜索 | CodeEmbeddingService.ts + SemanticSearchService.ts | 5 天 |
| P1 | Agent 框架迁移 | BaseAgent + ToolAdapter | 5 天 |
| P1 | AI Review 迁移 | ai-review/ | 5 天 |
| P1 | LLM Trace 迁移 | llm-trace/ | 3 天 |
| P1 | ML 推理 + 模型版本 | MLInferenceService.ts + ModelVersionService.ts | 5 天 |
| P2 | 成本优化 | CostOptimizerService.ts | 3 天 |
| P2 | AI 诊断 + 决策解释 | AIDiagnosisService.ts + DecisionExplanationService.ts | 3 天 |
| P2 | 规则引擎 + 降级路由 | RuleEngine.ts + AIDegradationRouter.ts | 3 天 |
| P2 | 模型训练 | ai-training/ | 5 天 |
| P1 | 向量存储完善 | vector-store/ + vectorize-rules/ | 3 天 |
| P1 | 模型版本管理迁移 | model-version/ | 2 天 |
| — | 知识库管理 | knowledge/ | 保留 orion-knowledge，不迁移 |
| — | 技能系统 | skill/ | 保留 TS 不变 |

**总预计工时**: ~55 人天（含新增 5 天）

---

## 十、关键决策

| 决策 | 决策日期 | 决策内容 |
|------|---------|---------|
| AI 域 Python 权威 | 2026-07-02 | 保留 orion-ai-service Python 版本，TS services/ai/ 功能迁移到 Python |
| Agent 蓝图保留 TS | 2026-07-02 | services/agent/ (AgentSandbox) 保留在平台服务，Agent 逻辑迁移到 Python |
| 使用 LiteLLM | 2026-07-02 | Python AIGateway 使用 LiteLLM 统一 100+ LLM 提供商接口 |
| 向量存储优先 pgvector | 2026-07-02 | 优先使用 PostgreSQL pgvector 扩展，备选 Qdrant |
| 事件总线保持不变 | 2026-07-02 | NATS JetStream 基础设施不变，Python 服务沿用 |
| VectorStore 策略 | 2026-07-03 | 优先使用 PostgreSQL pgvector 扩展，vector-store/ + vectorize-rules/ 合并迁移 |
| ModelVersion 归属 | 2026-07-03 | model-version/ 与 MLInferenceService 合并到 Python `model_version.py` |
| Knowledge 保留 | 2026-07-03 | knowledge/ 保留在 orion-knowledge 独立项目，不参与 Python 迁移 |
| Skill 保留 TS | 2026-07-03 | skill/ 为跨域能力，不迁移到 Python，保留在 TS 平台服务 |
