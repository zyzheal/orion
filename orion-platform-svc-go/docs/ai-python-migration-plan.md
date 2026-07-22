# Orion AI 域 TS → Python 迁移计划

**生成日期**: 2026-07-05
**状态**: 最终版
**决策**: 保留 `orion-ai-service` (Python) + `orion-ai-agents-svc` (Python) 作为 AI 域权威实现，将 `orion-platform-service/src/services/ai/` 等 TS 功能迁移到 Python 服务

---

## 一、迁移范围

### 1.1 源（TS，待迁移）

| 服务目录 | 文件数 | 代码行数 | 核心能力 | 迁移策略 |
|---------|--------|---------|---------|---------|
| `services/ai/` | 40 | ~25,000 | LLM 网关、生成服务、Prompt 安全、向量搜索、ML 推理、成本优化 | **全部迁移** |
| `services/ai-agents/` | 16 | ~8,000 | 5 类 Agent (base/monitoring/performance/pipeline/release/stability) | **全部迁移** |
| `services/agent/` | 10 | ~3,500 | AgentRepository、AgentSandbox、sandbox-worker | 保留沙箱运行时，Agent 逻辑迁移 |
| `services/ai-review/` | 14 | ~2,500 | AI 代码 Review | 迁移到 Python |
| `services/llm-trace/` | 8 | ~1,500 | LLM Trace 链路追踪 | 迁移到 Python |
| `services/ai-training/` | 7 | ~1,200 | AI 模型训练 | 迁移到 Python |
| `services/mlops/` | 3 | ~500 | MLOps 模型版本/部署 | 迁移到 Python |
| `services/model-version/` | 2 | ~800 | 模型版本生命周期管理 | 迁移到 Python |
| `services/vector-store/` | 3 | ~900 | 向量存储 + 语义检索 | 迁移到 Python |
| `services/vectorize-rules/` | 2 | ~300 | 向量化规则引擎 | 迁移到 Python |

> **注意**: `orion-ai-svc/` (TS) 仅为微服务蓝图（1 文件，~50 行），非功能实现，不参与迁移，保留为 TS 微服务拆分预留。

### 1.2 目标（Python，权威实现）

| 服务目录 | 文件数 | 代码行数 | 当前状态 | 增强内容 |
|---------|--------|---------|---------|---------|
| `orion-ai-service/` | 7 | ~800 | 骨架 + 2 个事件处理器 + 占位 AI | 接收全部迁移能力 |
| `orion-ai-agents-svc/` | 4 | ~200 | 4 个骨架文件 | 接收 ai-agents 的 5 类 Agent |
| `orion-knowledge/` | 8 | ~1,500 | 已有实现 | 保持独立，通过事件总线和 AI 服务交互 |

### 1.3 不迁移（保留 TS）

| 目录 | 原因 |
|------|------|
| `services/knowledge/` | 已有独立 Python 服务 `orion-knowledge/`，通过事件交互 |
| `services/agent/` (沙箱部分) | AgentSandbox 是通用运行时，与 AI 逻辑解耦，保留在平台服务 |
| `services/skill/` | 技能系统为跨域能力，非 AI 专属，保留在 TS 平台服务 |
| `orion-ai-svc/` | TS 蓝图，微服务拆分预留，功能由 orion-ai-service 覆盖 |

---

## 二、迁移策略

### 2.1 核心原则

1. **权威实现统一**: `orion-ai-service` (Python) 为 AI 核心引擎权威实现，`orion-ai-agents-svc` (Python) 为 Agent 框架权威实现
2. **渐进式切换**: Python 服务新增端点 → 前端 API 客户端 baseURL 切换 → 双写验证 → 下线 TS 路由
3. **事件驱动解耦**: 迁移完成后，平台服务通过 NATS 事件总线 + HTTP API 与 AI 域交互，不再直接 import
4. **API 路径保持一致**: Python 服务沿用 `/api/v1/ai/` 和 `/api/v1/agent/` 前缀

### 2.2 迁移优先级

| 优先级 | 模块 | 功能 | 预计工时 | 依赖 |
|--------|------|------|---------|------|
| **P0** | PromptSecurity | 注入检测 + Prompt 清洗 + 安全配置 | 3 天 | 无 |
| **P0** | AIGateway | LLM 路由 + 负载均衡 + 提供商管理 | 5 天 | PromptSecurity |
| **P0** | AIGenerateService | 文本生成 + 对话 + 流式输出 | 5 天 | AIGateway |
| **P1** | CircuitBreaker | 熔断管理 + 提供商熔断 | 3 天 | 无 |
| **P1** | VectorStore + Embedding + Search | 向量存储 + 代码嵌入 + 语义搜索 | 5 天 | 无 |
| **P1** | BaseAgent + ToolAdapter | Agent 基类 + 工具适配器 | 5 天 | 无 |
| **P1** | AI Review | 代码审查 + 审查规则 | 5 天 | 无 |
| **P1** | LLM Trace | LLM 调用追踪 + 持久化 | 3 天 | 无 |
| **P1** | MLInference + ModelVersion | ML 推理 + 模型版本管理 | 5 天 | 无 |
| **P1** | CostOptimizer | 成本优化分析 | 3 天 | AIGateway |
| **P2** | AIDiagnosis + DecisionExplanation | AI 诊断 + 决策解释 | 3 天 | AIGateway |
| **P2** | RuleEngine + DegradationRouter | 规则引擎 + 降级路由 | 3 天 | CircuitBreaker |
| **P2** | AITraining | 模型训练流程 + 数据集管理 | 5 天 | ModelVersion |
| **P2** | VectorizeRules | 向量化规则引擎 | 2 天 | VectorStore |
| — | Knowledge | 知识库管理 | 不迁移 | 保留 orion-knowledge |
| — | Skill | 技能系统 | 不迁移 | 保留 TS 不变 |

**总预计工时**: ~55 人天（6 周）

---

## 三、6 周时间表

### Phase 1: 基础设施准备（1 周）

| 步骤 | 任务 | 产出 | 状态 |
|------|------|------|------|
| 1.1 | 在 orion-ai-service 创建项目结构（services/、models/、api/、repositories/） | 目录结构 | ⏳ 待开始 |
| 1.2 | 安装 Python 依赖（fastapi、pydantic、nats、pgvector、litellm、tree-sitter） | requirements.txt | ⏳ 待开始 |
| 1.3 | 创建数据库迁移文件（7 个 SQL 文件） | migrations/050-056_ai_*.sql | ⏳ 待开始 |
| 1.4 | 实现 Pydantic 数据模型（11 个模型文件） | src/models/ 下模型文件 | ⏳ 待开始 |
| 1.5 | 实现 PostgreSQL Repository 基类 | src/repositories/base.py | ⏳ 待开始 |

### Phase 2: 核心能力迁移（2 周）

| 步骤 | 任务 | 产出 | 状态 |
|------|------|------|------|
| 2.1 | 迁移 PromptSecurity（注入检测 + 清洗 + 安全配置） | src/services/prompt_security.py | ⏳ 待开始 |
| 2.2 | 迁移 AIGateway（LLM 路由 + 负载均衡 + 提供商管理） | src/services/llm_gateway.py | ⏳ 待开始 |
| 2.3 | 迁移 AIGenerateService（文本生成 + 对话 + 流式输出） | src/services/generation.py | ⏳ 待开始 |
| 2.4 | 迁移 CircuitBreaker（熔断管理 + 提供商熔断） | src/services/circuit_breaker.py | ⏳ 待开始 |
| 2.5 | 迁移 VectorStore + CodeEmbedding + SemanticSearch | src/services/vector_store.py | ⏳ 待开始 |
| 2.6 | 新增 API 路由（generate、chat、embed、search、models） | src/api/ai_routes.py | ⏳ 待开始 |
| 2.7 | 前端 API 客户端 baseURL 切换（ai.ts、ai-gateway.ts 等） | orion-frontend/src/api/*.ts | ⏳ 待开始 |

### Phase 3: Agent 框架迁移（1 周）

| 步骤 | 任务 | 产出 | 状态 |
|------|------|------|------|
| 3.1 | 扩展 orion-ai-agents-svc 项目结构 | 目录 + 依赖 | ⏳ 待开始 |
| 3.2 | 迁移 BaseAgent + ToolAdapter | app/agents/base.py + tools.py | ⏳ 待开始 |
| 3.3 | 迁移 5 类专项 Agent（monitoring、performance、pipeline、release、stability） | app/agents/*.py | ⏳ 待开始 |
| 3.4 | 新增 Agent API 路由 | app/api/agent_routes.py | ⏳ 待开始 |
| 3.5 | 前端 API 客户端 baseURL 切换（ai-agents.ts 等） | orion-frontend/src/api/*.ts | ⏳ 待开始 |

### Phase 4: 辅助能力迁移（1 周）

| 步骤 | 任务 | 产出 | 状态 |
|------|------|------|------|
| 4.1 | 迁移 MLInference + ModelVersion + vector-store/ + vectorize-rules/ | src/services/ml_inference.py + model_version.py + vector_store.py + vectorize_rules.py | ⏳ 待开始 |
| 4.2 | 迁移 CostOptimizer | src/services/cost_optimizer.py | ⏳ 待开始 |
| 4.3 | 迁移 AIDiagnosis + DecisionExplanation | src/services/diagnosis.py + explanation.py | ⏳ 待开始 |
| 4.4 | 迁移 RuleEngine + DegradationRouter | src/services/rule_engine.py + degradation_router.py | ⏳ 待开始 |
| 4.5 | 迁移 ai-review 能力 | src/services/code_review.py | ✅ 已完成 | 规则引擎 + 安全/风格检测，28 tests pass
| 4.6 | 迁移 llm-trace 能力 | src/services/llm_trace.py | ✅ 已完成 | 仓储+内存双写，18 tests pass
| 4.7 | 迁移 ai-training 能力 | src/services/training.py | ✅ 已完成 | 异步后台模拟，12 tests pass
| 4.8 | 迁移 mlops 能力 | src/services/mlops.py | ✅ 已完成 | 独立服务，11 tests pass
| 4.9 | 新增 training API 路由（start/get/cancel/list） | src/api/training_routes.py | ✅ 已完成 | 4 endpoints, 已注册到 main.py
| 4.10 | 新增 mlops API 路由（register/deploy/get/list） | src/api/mlops_routes.py | ✅ 已完成 | 4 endpoints, 已注册到 main.py

### Phase 5: 双写验证 + TS 下线（1 周）

| 步骤 | 任务 | 产出 | 状态 |
|------|------|------|------|
| 5.1 | 双写期：TS + Python 端点并行运行 | 验证报告 | ⏳ 待开始 |
| 5.2 | 前端 E2E 测试全量验证 | 测试报告 | ⏳ 待开始 |
| 5.3 | 下线 TS 路由（services/ai/ 相关 routes） | routes.ts 更新 | ⏳ 待开始 |
| 5.4 | 下线 TS 服务 barrel 导出 | index.ts 更新 | ⏳ 待开始 |
| 5.5 | 将 TS 文件标记为 deprecated（保留代码） | 注释标记 | ⏳ 待开始 |

---

## 四、功能映射详表

### 4.1 services/ai/ → orion-ai-service

| TS 文件 | 类名 | 功能 | Python 目标文件 | 优先级 |
|---------|------|------|----------------|--------|
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

### 4.2 services/ai-agents/ → orion-ai-agents-svc

| TS 文件 | 类名 | 功能 | Python 目标文件 | 优先级 |
|---------|------|------|----------------|--------|
| `base/BaseAgent.ts` | BaseAgent | Agent 基类 | `app/agents/base.py` | P0 |
| `base/ToolAdapter.ts` | ToolAdapter | 工具适配器（5 预置工具） | `app/agents/tools.py` | P0 |
| `monitoring/` | — | 监控 Agent | `app/agents/monitoring.py` | P2 |
| `performance/PerfOptAgent.ts` | PerfOptAgent | 性能优化 | `app/agents/performance.py` | P1 |
| `pipeline/PipelineYamlAgent.ts` | PipelineYamlAgent | Pipeline YAML | `app/agents/pipeline.py` | P1 |
| `release/ReleaseNotesAgent.ts` | ReleaseNotesAgent | 发布说明 | `app/agents/release.py` | P1 |
| `stability/types.ts` | — | 稳定性类型 | `app/agents/stability_types.py` | P2 |

### 4.3 其他迁移

| 源目录 | 功能 | 目标 | 优先级 |
|--------|------|------|--------|
| `services/ai-review/` | AI 代码审查 | `src/services/code_review.py` | P1 |
| `services/llm-trace/` | LLM 追踪 | `src/services/llm_trace.py` | P1 |
| `services/ai-training/` | 模型训练 | `src/services/training.py` | P2 |
| `services/mlops/` | MLOps | 合并到 `model_version.py` | P2 |
| `services/model-version/` | 模型版本生命周期 | `src/services/model_version.py` | P1 |
| `services/vector-store/` | 向量存储 CRUD + 检索 | `src/services/vector_store.py` | P1 |
| `services/vectorize-rules/` | 向量化规则引擎 | `src/services/vectorize_rules.py` | P2 |

---

## 五、API 端点映射

### 5.1 当前 TS API（services/ai/ 路由）

| TS 端点 | 方法 | 功能 | Python 目标路径 |
|---------|------|------|---------------|
| `POST /ai/generate` | POST | 文本生成 | `POST /api/v1/ai/generate` |
| `POST /ai/chat` | POST | 对话 | `POST /api/v1/ai/chat` |
| `POST /ai/embed` | POST | 代码嵌入 | `POST /api/v1/ai/embed` |
| `POST /ai/search` | POST | 语义搜索 | `POST /api/v1/ai/search` |
| `POST /ai/review` | POST | AI 代码审查 | `POST /api/v1/ai/review` |
| `POST /ai/diagnose` | POST | AI 诊断 | `POST /api/v1/ai/diagnose` |
| `POST /ai/optimize-cost` | POST | 成本优化 | `POST /api/v1/ai/optimize-cost` |
| `GET /ai/models` | GET | 模型列表 | `GET /api/v1/ai/models` |
| `GET /ai/models/:id` | GET | 模型详情 | `GET /api/v1/ai/models/{id}` |
| `POST /ai/models/:id/predict` | POST | 模型推理 | `POST /api/v1/ai/models/{id}/predict` |
| `GET /ai/traces` | GET | LLM 追踪列表 | `GET /api/v1/ai/traces` |
| `GET /ai/training/jobs` | GET | 训练任务列表 | `GET /api/v1/ai/training/jobs` |
| `POST /ai/training/jobs` | POST | 创建训练任务 | `POST /api/v1/ai/training/jobs` |
| `POST /ai/agents/run` | POST | Agent 运行 | `POST /api/v1/ai/agents/run` |
| `GET /ai/agents/:id` | GET | Agent 状态 | `GET /api/v1/ai/agents/{id}` |
| `POST /ai/agents/:id/stop` | POST | 停止 Agent | `POST /api/v1/ai/agents/{id}/stop` |
| `POST /ai/vectorize` | POST | 向量化文本 | `POST /api/v1/ai/vectorize` |
| `POST /ai/vectorize/search` | POST | 向量相似搜索 | `POST /api/v1/ai/vectorize/search` |
| `GET /ai/models/versions` | GET | 模型版本列表 | `GET /api/v1/ai/models/versions` |

### 5.2 Python 服务当前 API

| 端点 | 方法 | 功能 |
|------|------|------|
| `GET /` | GET | 服务信息 |
| `GET /api/v1/ai/healthz` | GET | 健康检查 |
| `GET /api/v1/ai/status` | GET | 服务状态 |

### 5.3 API 迁移策略

1. **路径保持一致**: Python 服务沿用 `/api/v1/ai/` 前缀
2. **渐进式切换**: 先在 Python 服务新增端点，再修改前端 API 客户端 baseURL
3. **双写期**: TS 和 Python 端点并行运行 1 周，验证后再下线 TS 路由
4. **网关路由**: API Gateway 保持代理，前端无需感知后端语言切换

---

## 六、数据模型迁移

### 6.1 TS → Python 模型映射

| TS 类型/接口 | 文件 | Python Pydantic 模型 | 目标文件 |
|------------|------|---------------------|---------|
| `AIGatewayConfig` | AIGateway.ts | `LLMProviderConfig` | `src/models/llm.py` |
| `GenerateRequest/Response` | AIGenerateService.ts | `GenerationRequest/Response` | `src/models/generation.py` |
| `ChatMessage` | types.ts | `ChatMessage` | `src/models/chat.py` |
| `EmbeddingRequest/Response` | CodeEmbeddingService.ts | `EmbeddingRequest/Response` | `src/models/embedding.py` |
| `SearchRequest/Result` | SemanticSearchService.ts | `SearchRequest/SearchResult` | `src/models/search.py` |
| `MLModel/PredictionResult` | MLInferenceService.ts | `MLModel/PredictionResult` | `src/models/ml.py` |
| `CostAnalysisReport` | CostOptimizerService.ts | `CostAnalysisReport` | `src/models/cost.py` |
| `DiagnosisResult` | AIDiagnosisService.ts | `DiagnosisResult` | `src/models/diagnosis.py` |
| `LLMTrace` | llm-trace/ | `LLMTraceRecord` | `src/models/trace.py` |
| `TrainingJob` | ai-training/ | `TrainingJob` | `src/models/training.py` |
| `AgentTask` | ai-agents/ | `AgentTask` | `app/models/agent.py` |
| `ReviewResult` | ai-review/ | `ReviewResult` | `src/models/review.py` |

### 6.2 数据库迁移

当前 TS 服务使用内存 Map 存储，无 PostgreSQL 表。Python 服务需新建：

| 表名 | 用途 | 迁移文件 |
|------|------|---------|
| `ai_llm_providers` | LLM 提供商配置 | `migrations/050_ai_llm_providers.sql` |
| `ai_model_versions` | 模型版本管理 | `migrations/051_ai_model_versions.sql` |
| `ai_generation_logs` | 生成调用日志 | `migrations/052_ai_generation_logs.sql` |
| `ai_embeddings` | 向量嵌入存储 | `migrations/053_ai_embeddings.sql` |
| `ai_training_jobs` | 训练任务 | `migrations/054_ai_training_jobs.sql` |
| `ai_llm_traces` | LLM 追踪记录 | `migrations/055_ai_llm_traces.sql` |
| `ai_agent_tasks` | Agent 任务 | `migrations/056_ai_agent_tasks.sql` |

---

## 七、外部依赖迁移

### 7.1 当前 TS 依赖

| 依赖 | TS 服务 | Python 替代方案 |
|------|---------|---------------|
| `@langchain/*` 或类似 LLM SDK | AIGateway | `litellm` 或 `openai` SDK |
| 向量数据库客户端 | VectorStore | `pgvector` (PostgreSQL 扩展) 或 `qdrant-client` |
| ML 推理引擎 | MLInferenceService | `torch` / `tensorflow` / `onnxruntime` |
| 代码解析库 | CodeEmbeddingService | `tree-sitter` (已有 Python 绑定) |
| Prompt 模板引擎 | PromptSanitizer | `jinja2` + 自定义过滤 |

### 7.2 基础设施依赖

| 组件 | 当前 | 迁移后 |
|------|------|--------|
| LLM 提供商 | TS AIGateway | Python LiteLLM 统一网关 |
| 向量存储 | TS VectorStore (接口) | Python pgvector / Qdrant |
| 消息队列 | NATS (已有) | 保持不变 |
| 数据库 | 内存 Map | PostgreSQL + pgvector |
| 缓存 | 无 | Redis (可选) |

---

## 八、事件总线集成

### 8.1 已有事件（Python 服务）

| 主题 | 方向 | 事件类型 | 状态 |
|------|------|---------|------|
| `pipeline.run.completed` | 消费 | PipelineRunCompletedEvent | ✅ 已实现 |
| `code.pr.opened` | 消费 | CodePROpenedEvent | ✅ 已实现 |

### 8.2 新增事件（迁移后）

| 主题 | 方向 | 事件类型 | 说明 | 优先级 |
|------|------|---------|------|--------|
| `ai.generation.completed` | 发布 | AIGenerationCompletedEvent | 生成完成通知 | P1 |
| `ai.review.completed` | 发布 | AIReviewCompletedEvent | 代码审查完成 | P1 |
| `ai.agent.task.completed` | 发布 | AgentTaskCompletedEvent | Agent 任务完成 | P1 |
| `ai.model.deployed` | 发布 | AIModelDeployedEvent | 模型部署通知 | P2 |
| `ai.training.completed` | 发布 | AITrainingCompletedEvent | 训练完成通知 | P2 |

---

## 九、前端影响

### 9.1 需要修改的前端 API 客户端

| 前端文件 | 改动 |
|---------|------|
| `orion-frontend/src/api/ai.ts` | baseURL 从 `:3001` 改为 `:8000` |
| `orion-frontend/src/api/ai-gateway.ts` | baseURL 从 `:3001` 改为 `:8000` |
| `orion-frontend/src/api/ai-review.ts` | baseURL 从 `:3001` 改为 `:8000` |
| `orion-frontend/src/api/ai-decision.ts` | baseURL 从 `:3001` 改为 `:8000` |
| `orion-frontend/src/api/ai-cost.ts` | baseURL 从 `:3001` 改为 `:8000` |
| `orion-frontend/src/api/ai-docs.ts` | baseURL 从 `:3001` 改为 `:8000` |
| `orion-frontend/src/api/ai-agents.ts` | baseURL 从 `:3001` 改为 `:8000` |
| `orion-frontend/src/api/ai-security.ts` | baseURL 从 `:3001` 改为 `:8000` |
| `orion-frontend/src/api/agent.ts` | baseURL 从 `:3001` 改为 `:8000` |
| `orion-frontend/src/api/llm-trace.ts` | baseURL 从 `:3001` 改为 `:8000` |
| `orion-frontend/src/api/ai-training.ts` | baseURL 从 `:3001` 改为 `:8000` |
| `orion-frontend/src/api/apm.ts` | baseURL 从 `:3001` 改为 `:8000` |
| `orion-frontend/src/api/approval.ts` | baseURL 从 `:3001` 改为 `:8000` |
| `orion-frontend/src/api/artifact.ts` | baseURL 从 `:3001` 改为 `:8000` |
| `orion-frontend/src/api/audit.ts` | baseURL 从 `:3001` 改为 `:8000` |

### 9.2 前端页面影响

| 页面 | 依赖的 API | 改动 |
|------|-----------|------|
| AI 平台相关页面 | `/api/v1/ai/*` | baseURL 切换，路径不变 |
| Agent 管理页面 | `/api/v1/agent/*` | baseURL 切换 |
| LLM 追踪页面 | `/api/v1/llm-trace/*` | baseURL 切换 |
| 代码审查页面 | `/api/v1/ai/review` | baseURL 切换 |

---

## 十、与平台服务的关系

### 10.1 当前耦合点

| TS 服务 | 被平台服务 import | 耦合方式 |
|---------|-----------------|---------|
| `services/ai/AIGateway` | PipelineService, CodeService | 直接 import |
| `services/ai/CostOptimizerService` | FinOpsService | 直接 import |
| `services/ai/AIDiagnosisService` | DiagnosticService | 直接 import |
| `services/ai/DecisionExplanationService` | Multiple | 直接 import |
| `services/ai/ModelVersionService` | MLInferenceService | 直接 import |
| `services/ai-agents/` | AgentService | 通过 Agent 框架 |

### 10.2 解耦策略

迁移完成后，平台服务通过以下方式与 AI 域交互：
1. **事件驱动**：发布事件到 NATS，Python 服务消费
2. **HTTP API**：调用 Python 服务的 `/api/v1/ai/*` 端点
3. **不再直接 import**：消除 TS → TS 的进程内调用

---

## 十一、测试覆盖

### 11.1 Python 服务当前测试

| 文件 | 测试数 | 覆盖模块 |
|------|--------|---------|
| `tests/test_config.py` | 7 | Settings |
| `tests/test_models.py` | 9 | Pydantic 模型 |
| `tests/test_api_routes.py` | 5 | HTTP 端点 |
| `tests/test_ai_service.py` | 4 | AI 服务占位 |
| `tests/test_events.py` | 6 | 事件处理器 |
| **合计** | **~31** | — |

### 11.2 TS 服务测试

| 目录 | 测试文件数 | 状态 |
|------|-----------|------|
| `services/ai/__tests__/` | ~3 | 部分覆盖 |
| `services/ai-agents/__tests__/` | 0 | 无测试 |
| `services/agent/__tests__/` | ~2 | 部分覆盖 |

---

## 十二、风险评估

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| Python 服务性能不如 TS | 中 | LiteLLM 性能接近原生 SDK；pgvector 查询效率验证 |
| 前端切换 baseURL 影响其他调用 | 高 | 仅切换 AI 相关 API 客户端，其他不变 |
| 向量数据库选型 | 中 | 优先 pgvector（已有 PostgreSQL），备选 Qdrant |
| Agent 沙箱隔离 | 低 | AgentSandbox 保留在 TS，仅迁移 Agent 逻辑 |
| NATS 事件格式兼容 | 低 | Python 服务已消费相同主题，格式不变 |
| LLM 提供商 SDK 差异 | 低 | LiteLLM 统一 100+ 提供商接口 |

---

## 十三、回退策略

| 阶段 | 回退触发条件 | 回退操作 |
|------|------------|---------|
| Phase 2 | Python 端点错误率 > 5% | 切回 TS 端点，排查 Python 实现 |
| Phase 3 | Agent 任务失败率 > 10% | 切回 TS Agent，保留 Python 核心能力 |
| Phase 5 | 生产环境异常 | 重新启用 TS 路由，Python 服务保留观察 |

---

## 十四、关键文件索引

### 14.1 源文件（TS，待迁移）

| 文件路径 | 功能 | 优先级 |
|---------|------|--------|
| `orion-platform-service/src/services/ai/AIGateway.ts` | LLM 网关 | P0 |
| `orion-platform-service/src/services/ai/AIGenerateService.ts` | 文本生成 | P0 |
| `orion-platform-service/src/services/ai/PromptSecurity.ts` | Prompt 安全 | P0 |
| `orion-platform-service/src/services/ai/PromptInjectionDetector.ts` | 注入检测 | P0 |
| `orion-platform-service/src/services/ai/PromptSanitizer.ts` | Prompt 清洗 | P0 |
| `orion-platform-service/src/services/ai/CircuitBreakerManager.ts` | 熔断管理 | P1 |
| `orion-platform-service/src/services/ai/ProviderCircuitBreaker.ts` | 提供商熔断 | P1 |
| `orion-platform-service/src/services/ai/VectorStore.ts` | 向量存储接口 | P1 |
| `orion-platform-service/src/services/ai/CodeEmbeddingService.ts` | 代码嵌入 | P1 |
| `orion-platform-service/src/services/ai/SemanticSearchService.ts` | 语义搜索 | P1 |
| `orion-platform-service/src/services/ai/MLInferenceService.ts` | ML 推理 | P1 |
| `orion-platform-service/src/services/ai/ModelVersionService.ts` | 模型版本 | P1 |
| `orion-platform-service/src/services/ai/CostOptimizerService.ts` | 成本优化 | P2 |
| `orion-platform-service/src/services/ai/AIDiagnosisService.ts` | AI 诊断 | P2 |
| `orion-platform-service/src/services/ai/DecisionExplanationService.ts` | 决策解释 | P2 |
| `orion-platform-service/src/services/ai/RuleEngine.ts` | 规则引擎 | P2 |
| `orion-platform-service/src/services/ai/AIDegradationRouter.ts` | 降级路由 | P2 |
| `orion-platform-service/src/services/ai-agents/base/BaseAgent.ts` | Agent 基类 | P0 |
| `orion-platform-service/src/services/ai-agents/base/ToolAdapter.ts` | 工具适配器 | P0 |
| `orion-platform-service/src/services/ai-agents/performance/PerfOptAgent.ts` | 性能优化 Agent | P1 |
| `orion-platform-service/src/services/ai-agents/pipeline/PipelineYamlAgent.ts` | Pipeline YAML Agent | P1 |
| `orion-platform-service/src/services/ai-agents/release/ReleaseNotesAgent.ts` | 发布说明 Agent | P1 |

### 14.2 目标文件（Python，权威实现）

| 文件路径 | 功能 | 状态 |
|---------|------|------|
| `orion-ai-service/src/main.py` | FastAPI 应用入口 | ✅ 已存在 |
| `orion-ai-service/src/config/settings.py` | 配置管理 | ✅ 已存在 |
| `orion-ai-service/src/models/__init__.py` | 数据模型（7 个） | ✅ 已存在 |
| `orion-ai-service/src/events/__init__.py` | 事件处理器（2 个） | ✅ 已存在 |
| `orion-ai-service/tests/` | 测试套件（31 个测试） | ✅ 已存在 |
| `orion-ai-agents-svc/app/main.py` | Agent 服务入口 | 🔄 骨架 |
| `orion-ai-agents-svc/app/agents/` | Agent 实现目录 | 🔄 待实现 |
| `orion-ai-agents-svc/app/api/` | Agent API 路由 | 🔄 待实现 |

### 14.3 设计文档

| 文档 | 说明 |
|------|------|
| `docs/ai-python-migration-plan.md` | 本文档，迁移计划 |
| `docs/ai-migration-plan-2026-07-02.md` | 早期迁移计划（已 superseded） |
| `docs/analysis/ai-domain-analysis.md` | AI 域深度分析（124 文件覆盖） |
| `docs/implementation-plan-2026-07-02.md` | 项目总体实施计划（§10 专项迁移索引） |

---

## 十五、进度追踪

> 格式：`⏳ 待开始` / `🔄 进行中` / `✅ 已完成` / `❌ 阻塞`

### Phase 1: 基础设施准备

| 步骤 | 任务 | 状态 | 完成日期 |
|------|------|------|---------|
| 1.1 | orion-ai-service 项目结构 | ⏳ 待开始 | — |
| 1.2 | Python 依赖安装 | ⏳ 待开始 | — |
| 1.3 | 数据库迁移文件 | ⏳ 待开始 | — |
| 1.4 | Pydantic 数据模型 | ⏳ 待开始 | — |
| 1.5 | PostgreSQL Repository 基类 | ⏳ 待开始 | — |

### Phase 2: 核心能力迁移

| 步骤 | 任务 | 状态 | 完成日期 |
|------|------|------|---------|
| 2.1 | PromptSecurity | ⏳ 待开始 | — |
| 2.2 | AIGateway | ⏳ 待开始 | — |
| 2.3 | AIGenerateService | ⏳ 待开始 | — |
| 2.4 | CircuitBreaker | ⏳ 待开始 | — |
| 2.5 | VectorStore + Embedding + Search | ⏳ 待开始 | — |
| 2.6 | API 路由 | ⏳ 待开始 | — |
| 2.7 | 前端 API 客户端切换 | ⏳ 待开始 | — |

### Phase 3: Agent 框架迁移

| 步骤 | 任务 | 状态 | 完成日期 |
|------|------|------|---------|
| 3.1 | orion-ai-agents-svc 项目结构 | ⏳ 待开始 | — |
| 3.2 | BaseAgent + ToolAdapter | ⏳ 待开始 | — |
| 3.3 | 5 类专项 Agent | ⏳ 待开始 | — |
| 3.4 | Agent API 路由 | ⏳ 待开始 | — |
| 3.5 | 前端 API 客户端切换 | ⏳ 待开始 | — |

### Phase 4: 辅助能力迁移

| 步骤 | 任务 | 状态 | 完成日期 |
|------|------|------|---------|
| 4.1 | MLInference + ModelVersion + VectorStore + VectorizeRules | ⏳ 待开始 | — |
| 4.2 | CostOptimizer | ⏳ 待开始 | — |
| 4.3 | AIDiagnosis + DecisionExplanation | ⏳ 待开始 | — |
| 4.4 | RuleEngine + DegradationRouter | ⏳ 待开始 | — |
| 4.5 | ai-review 能力 | ⏳ 待开始 | — |
| 4.6 | llm-trace 能力 | ⏳ 待开始 | — |
| 4.7 | ai-training 能力 | ⏳ 待开始 | — |
| 4.8 | mlops 能力 | ✅ 已完成 (2026-07-05) | MLOpsService ModelDeployment identity 保持 | 🔵 | 11 tests pass
| 4.9 | training API 路由 | ✅ 已完成 (2026-07-05) | 4 endpoints (start/get/cancel/list) + main.py 注册 | 🔵 | 已注册
| 4.10 | mlops API 路由 | ✅ 已完成 (2026-07-05) | 4 endpoints (register/deploy/get/list) + main.py 注册 | 🔵 | 已注册
| 4.11 | 决策扩展端点 (feature-importance/confidence/history) | ✅ 已完成 (2026-07-05) | 3 新决策端点 + 服务方法 + 前端代理 | 🔵 | 193 tests pass

### Phase 5: 双写验证 + TS 下线

| 步骤 | 任务 | 状态 | 完成日期 |
|------|------|------|---------|
| 5.1 | 双写期验证 | ⏳ 待开始 | — |
| 5.2 | E2E 测试 | ⏳ 待开始 | — |
| 5.3 | 下线 TS 路由 | ⏳ 待开始 | — |
| 5.4 | 下线 TS barrel 导出 | ⏳ 待开始 | — |
| 5.5 | TS 文件标记 deprecated | ⏳ 待开始 | — |
