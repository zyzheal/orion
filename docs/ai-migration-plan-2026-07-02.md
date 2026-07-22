# Orion AI 域 TS → Python 迁移计划

**生成日期**: 2026-07-02
**状态**: 最终版
**决策**: 保留 `orion-ai-service` Python 版本作为 AI 域权威实现，将 `orion-platform-service/src/services/ai/` 的功能迁移到 Python 服务

---

## 一、迁移范围

### 1.1 源（TS，待迁移）

| 服务目录 | 文件数 | 核心能力 | 迁移策略 |
|---------|--------|---------|---------|
| `services/ai/` | 40 | LLM 网关、生成服务、Prompt 安全、向量搜索、ML 推理、成本优化 | **全部迁移** |
| `services/ai-agents/` | 16 | 5 类 Agent (base/monitoring/performance/pipeline/release/stability) | **全部迁移** |
| `services/agent/` | 10 | AgentRepository、AgentSandbox、sandbox-worker | 保留沙箱运行时，Agent 逻辑迁移 |
| `services/ai-review/` | 14 | AI 代码 Review | 迁移到 Python |
| `services/llm-trace/` | 8 | LLM Trace 链路追踪 | 迁移到 Python |
| `services/ai-training/` | 7 | AI 模型训练 | 迁移到 Python |
| `services/mlops/` | 3 | MLOps 模型版本/部署 | 迁移到 Python |

### 1.2 目标（Python，权威实现）

| 服务目录 | 当前状态 | 增强内容 |
|---------|---------|---------|
| `orion-ai-service/` | 骨架 + 2 个事件处理器 + 占位 AI | 接收全部迁移能力 |
| `orion-ai-agents-svc/` | 4 个骨架文件 | 接收 ai-agents 的 5 类 Agent |
| `orion-knowledge/` | 8 文件，已有实现 | 保持独立，通过事件总线和 AI 服务交互 |

### 1.3 不迁移（保留 TS）

| 目录 | 原因 |
|------|------|
| `services/knowledge/` | 已有独立 Python 服务 `orion-knowledge/`，通过事件交互 |
| `services/agent/` (沙箱部分) | AgentSandbox 是通用运行时，与 AI 逻辑解耦，保留在平台服务 |
| `orion-ai-svc/` | TS 蓝图，微服务拆分预留，功能由 orion-ai-service 覆盖 |

---

## 二、功能映射表

### 2.1 services/ai/ → orion-ai-service

| TS 文件 | 功能 | 目标 Python 文件 | 依赖 |
|---------|------|-----------------|------|
| `AIGateway.ts` | LLM 提供商路由、负载均衡 | `src/services/llm_gateway.py` | PromptSecurity, CircuitBreaker |
| `AIGenerateService.ts` | 文本生成、对话 | `src/services/generation.py` | AIGateway |
| `PromptSecurity.ts` | Prompt 安全配置 | `src/services/prompt_security.py` | — |
| `PromptInjectionDetector.ts` | 注入攻击检测 | `src/services/prompt_security.py` | — |
| `PromptSanitizer.ts` | Prompt 清洗 | `src/services/prompt_security.py` | — |
| `VectorStore.ts` | 向量存储接口 | `src/services/vector_store.py` | 外部向量 DB |
| `CodeEmbeddingService.ts` | 代码嵌入 | `src/services/vector_store.py` | VectorStore |
| `SemanticSearchService.ts` | 语义搜索 | `src/services/vector_store.py` | VectorStore |
| `MLInferenceService.ts` | ML 模型推理 | `src/services/ml_inference.py` | ModelVersionService |
| `ModelVersionService.ts` | 模型版本管理 | `src/services/model_version.py` | PostgreSQL |
| `CostOptimizerService.ts` | 成本优化分析 | `src/services/cost_optimizer.py` | AIGateway |
| `AIDiagnosisService.ts` | AI 诊断 | `src/services/diagnosis.py` | AIGateway |
| `DecisionExplanationService.ts` | 决策解释 | `src/services/explanation.py` | — |
| `RuleEngine.ts` | 规则引擎 | `src/services/rule_engine.py` | — |
| `AIDegradationRouter.ts` | 降级路由 | `src/services/degradation_router.py` | CircuitBreaker |
| `CircuitBreakerManager.ts` | 熔断管理 | `src/services/circuit_breaker.py` | — |
| `ProviderCircuitBreaker.ts` | 提供商熔断 | `src/services/circuit_breaker.py` | — |
| `types.ts` | 类型定义 | `src/models/ai_types.py` | — |

### 2.2 services/ai-agents/ → orion-ai-agents-svc

| TS 子目录/文件 | 功能 | 目标 Python 文件 |
|--------------|------|-----------------|
| `base/BaseAgent.ts` | Agent 基类 | `app/agents/base.py` |
| `base/ToolAdapter.ts` | 工具适配器（5 预置工具） | `app/agents/tools.py` |
| `monitoring/` | 监控 Agent | `app/agents/monitoring.py` |
| `performance/PerfOptAgent.ts` | 性能优化 Agent | `app/agents/performance.py` |
| `pipeline/PipelineYamlAgent.ts` | Pipeline YAML Agent | `app/agents/pipeline.py` |
| `release/ReleaseNotesAgent.ts` | 发布说明 Agent | `app/agents/release.py` |
| `stability/types.ts` | 稳定性类型 | `app/agents/stability_types.py` |

### 2.3 services/ai-review/ → orion-ai-service

| TS 文件 | 功能 | 目标 Python 文件 |
|---------|------|-----------------|
| AIReviewService 相关 | AI 代码审查 | `src/services/code_review.py` |
| Review 规则引擎 | 审查规则 | `src/services/review_rules.py` |

### 2.4 services/llm-trace/ → orion-ai-service

| TS 文件 | 功能 | 目标 Python 文件 |
|---------|------|-----------------|
| LLMTraceService 相关 | LLM 调用追踪 | `src/services/llm_trace.py` |
| Trace 存储 | 追踪数据持久化 | `src/models/trace.py` |

### 2.5 services/ai-training/ → orion-ai-service

| TS 文件 | 功能 | 目标 Python 文件 |
|---------|------|-----------------|
| AITrainingService 相关 | 模型训练流程 | `src/services/training.py` |
| 训练数据管理 | 数据集管理 | `src/services/training_data.py` |

### 2.6 services/mlops/ → orion-ai-service

| TS 文件 | 功能 | 目标 Python 文件 |
|---------|------|-----------------|
| MLOpsService 相关 | 模型版本/部署 | `src/services/mlops.py` (已存在 ModelVersionService) |

---

## 三、API 端点映射

### 3.1 当前 TS API（services/ai/ 路由）

通过 `routes.ts` 注册，前缀通常为 `/api/v1/ai/` 或类似。

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

### 3.2 Python 服务当前 API

| 端点 | 方法 | 功能 |
|------|------|------|
| `GET /` | GET | 服务信息 |
| `GET /api/v1/ai/healthz` | GET | 健康检查 |
| `GET /api/v1/ai/status` | GET | 服务状态 |

### 3.3 API 迁移策略

1. **路径保持一致**: Python 服务沿用 `/api/v1/ai/` 前缀
2. **渐进式切换**: 先在 Python 服务新增端点，再修改前端 API 客户端 baseURL
3. **双写期**: TS 和 Python 端点并行运行 1 周，验证后再下线 TS 路由
4. **网关路由**: API Gateway 保持代理，前端无需感知后端语言切换

---

## 四、数据模型迁移

### 4.1 TS → Python 模型映射

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

### 4.2 数据库迁移

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

## 五、外部依赖迁移

### 5.1 当前 TS 依赖

| 依赖 | TS 服务 | Python 替代方案 |
|------|---------|---------------|
| `@langchain/*` 或类似 LLM SDK | AIGateway | `litellm` 或 `openai` SDK |
| 向量数据库客户端 | VectorStore | `pgvector` (PostgreSQL 扩展) 或 `qdrant-client` |
| ML 推理引擎 | MLInferenceService | `torch` / `tensorflow` / `onnxruntime` |
| 代码解析库 | CodeEmbeddingService | `tree-sitter` (已有 Python 绑定) |
| Prompt 模板引擎 | PromptSanitizer | `jinja2` + 自定义过滤 |

### 5.2 基础设施依赖

| 组件 | 当前 | 迁移后 |
|------|------|--------|
| LLM 提供商 | TS AIGateway | Python LiteLLM 统一网关 |
| 向量存储 | TS VectorStore (接口) | Python pgvector / Qdrant |
| 消息队列 | NATS (已有) | 保持不变 |
| 数据库 | 内存 Map | PostgreSQL + pgvector |
| 缓存 | 无 | Redis (可选) |

---

## 六、事件总线集成

### 6.1 已有事件（Python 服务）

| 主题 | 方向 | 事件类型 |
|------|------|---------|
| `pipeline.run.completed` | 消费 | PipelineRunCompletedEvent |
| `code.pr.opened` | 消费 | CodePROpenedEvent |

### 6.2 新增事件（迁移后）

| 主题 | 方向 | 事件类型 | 说明 |
|------|------|---------|------|
| `ai.generation.completed` | 发布 | AIGenerationCompletedEvent | 生成完成通知 |
| `ai.review.completed` | 发布 | AIReviewCompletedEvent | 代码审查完成 |
| `ai.agent.task.completed` | 发布 | AgentTaskCompletedEvent | Agent 任务完成 |
| `ai.model.deployed` | 发布 | AIModelDeployedEvent | 模型部署通知 |
| `ai.training.completed` | 发布 | AITrainingCompletedEvent | 训练完成通知 |
| `code.pr.ai_reviewed` | 发布 | PRReviewedEvent | PR AI 审查结果 |

---

## 七、前端影响

### 7.1 需要修改的前端 API 客户端

| 前端文件 | 改动 |
|---------|------|
| `orion-frontend/src/api/ai.ts` (或类似) | baseURL 从 `:3001` 改为 `:8000` |
| `orion-frontend/src/api/agent.ts` | baseURL 从 `:3001` 改为 `:8000` |
| `orion-frontend/src/api/llm-trace.ts` | baseURL 从 `:3001` 改为 `:8000` |
| `orion-frontend/src/api/ai-training.ts` | baseURL 从 `:3001` 改为 `:8000` |

### 7.2 前端页面影响

| 页面 | 依赖的 API | 改动 |
|------|-----------|------|
| AI 平台相关页面 | `/api/v1/ai/*` | baseURL 切换，路径不变 |
| Agent 管理页面 | `/api/v1/agent/*` | baseURL 切换 |
| LLM 追踪页面 | `/api/v1/llm-trace/*` | baseURL 切换 |

---

## 八、迁移步骤

### Phase A: 基础设施准备（1 周）

| 步骤 | 任务 | 产出 |
|------|------|------|
| A1 | 在 orion-ai-service 创建项目结构（services/、models/、api/） | 目录结构 |
| A2 | 安装 Python 依赖（fastapi、pydantic、nats、pgvector、litellm） | requirements.txt |
| A3 | 创建数据库迁移文件（050-056） | 7 个 SQL 文件 |
| A4 | 实现 Pydantic 数据模型 | `src/models/` 下 11 个模型文件 |
| A5 | 实现 PostgreSQL Repository 基类 | `src/repositories/base.py` |

### Phase B: 核心能力迁移（2 周）

| 步骤 | 任务 | 产出 |
|------|------|------|
| B1 | 迁移 PromptSecurity（注入检测 + 清洗） | `src/services/prompt_security.py` |
| B2 | 迁移 AIGateway（LLM 路由 + 负载均衡） | `src/services/llm_gateway.py` |
| B3 | 迁移 AIGenerateService（文本生成 + 对话） | `src/services/generation.py` |
| B4 | 迁移 CircuitBreaker（熔断管理） | `src/services/circuit_breaker.py` |
| B5 | 迁移 VectorStore + CodeEmbedding + SemanticSearch | `src/services/vector_store.py` |
| B6 | 新增 API 路由（generate、chat、embed、search） | `src/api/ai_routes.py` |
| B7 | 前端 API 客户端 baseURL 切换 | `orion-frontend/src/api/ai.ts` |

### Phase C: Agent 迁移（1 周）

| 步骤 | 任务 | 产出 |
|------|------|------|
| C1 | 扩展 orion-ai-agents-svc 项目结构 | 目录 + 依赖 |
| C2 | 迁移 BaseAgent + ToolAdapter | `app/agents/base.py` + `tools.py` |
| C3 | 迁移 5 类专项 Agent | `app/agents/{monitoring,performance,pipeline,release}.py` |
| C4 | 新增 Agent API 路由 | `app/api/agent_routes.py` |
| C5 | 前端 API 客户端 baseURL 切换 | `orion-frontend/src/api/agent.ts` |

### Phase D: 辅助能力迁移（1 周）

| 步骤 | 任务 | 产出 |
|------|------|------|
| D1 | 迁移 MLInference + ModelVersion | `src/services/ml_inference.py` + `model_version.py` |
| D2 | 迁移 CostOptimizer | `src/services/cost_optimizer.py` |
| D3 | 迁移 AIDiagnosis + DecisionExplanation | `src/services/diagnosis.py` + `explanation.py` |
| D4 | 迁移 RuleEngine + DegradationRouter | `src/services/rule_engine.py` + `degradation_router.py` |
| D5 | 迁移 ai-review 能力 | `src/services/code_review.py` |
| D6 | 迁移 llm-trace 能力 | `src/services/llm_trace.py` |
| D7 | 迁移 ai-training 能力 | `src/services/training.py` |
| D8 | 迁移 mlops 能力 | 合并到 `model_version.py` |

### Phase E: 双写验证 + TS 下线（1 周）

| 步骤 | 任务 | 产出 |
|------|------|------|
| E1 | 双写期：TS + Python 端点并行 | 验证报告 |
| E2 | 前端 E2E 测试全量验证 | 测试报告 |
| E3 | 下线 TS 路由（services/ai/ 相关 routes） | routes.ts 更新 |
| E4 | 下线 TS 服务 barrel 导出 | index.ts 更新 |
| E5 | 将 TS 文件标记为 deprecated（保留代码） | 注释标记 |

---

## 九、风险评估

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| Python 服务性能不如 TS | 中 | LiteLLM 性能接近原生 SDK；pgvector 查询效率验证 |
| 前端切换 baseURL 影响其他调用 | 高 | 仅切换 AI 相关 API 客户端，其他不变 |
| 向量数据库选型 | 中 | 优先 pgvector（已有 PostgreSQL），备选 Qdrant |
| Agent 沙箱隔离 | 低 | AgentSandbox 保留在 TS，仅迁移 Agent 逻辑 |
| NATS 事件格式兼容 | 低 | Python 服务已消费相同主题，格式不变 |
| LLM 提供商 SDK 差异 | 低 | LiteLLM 统一 100+ 提供商接口 |

---

## 十、回退策略

| 阶段 | 回退触发条件 | 回退操作 |
|------|------------|---------|
| Phase B | Python 端点错误率 > 5% | 切回 TS 端点，排查 Python 实现 |
| Phase C | Agent 任务失败率 > 10% | 切回 TS Agent，保留 Python 核心能力 |
| Phase E | 生产环境异常 | 重新启用 TS 路由，Python 服务保留观察 |

---

## 十一、进度追踪

> 格式：`⏳ 待开始` / `🔄 进行中` / `✅ 已完成` / `❌ 阻塞`

### Phase A: 基础设施准备

| 步骤 | 任务 | 状态 | 完成日期 |
|------|------|------|---------|
| A1 | orion-ai-service 项目结构 | ⏳ 待开始 | — |
| A2 | Python 依赖安装 | ⏳ 待开始 | — |
| A3 | 数据库迁移文件 | ⏳ 待开始 | — |
| A4 | Pydantic 数据模型 | ⏳ 待开始 | — |
| A5 | PostgreSQL Repository 基类 | ⏳ 待开始 | — |

### Phase B: 核心能力迁移

| 步骤 | 任务 | 状态 | 完成日期 |
|------|------|------|---------|
| B1 | PromptSecurity | ⏳ 待开始 | — |
| B2 | AIGateway | ⏳ 待开始 | — |
| B3 | AIGenerateService | ⏳ 待开始 | — |
| B4 | CircuitBreaker | ⏳ 待开始 | — |
| B5 | VectorStore + Embedding + Search | ⏳ 待开始 | — |
| B6 | API 路由 | ⏳ 待开始 | — |
| B7 | 前端 API 客户端切换 | ⏳ 待开始 | — |

### Phase C: Agent 迁移

| 步骤 | 任务 | 状态 | 完成日期 |
|------|------|------|---------|
| C1 | orion-ai-agents-svc 项目结构 | ⏳ 待开始 | — |
| C2 | BaseAgent + ToolAdapter | ⏳ 待开始 | — |
| C3 | 5 类专项 Agent | ⏳ 待开始 | — |
| C4 | Agent API 路由 | ⏳ 待开始 | — |
| C5 | 前端 API 客户端切换 | ⏳ 待开始 | — |

### Phase D: 辅助能力迁移

| 步骤 | 任务 | 状态 | 完成日期 |
|------|------|------|---------|
| D1 | MLInference + ModelVersion | ⏳ 待开始 | — |
| D2 | CostOptimizer | ⏳ 待开始 | — |
| D3 | AIDiagnosis + DecisionExplanation | ⏳ 待开始 | — |
| D4 | RuleEngine + DegradationRouter | ⏳ 待开始 | — |
| D5 | ai-review 能力 | ⏳ 待开始 | — |
| D6 | llm-trace 能力 | ⏳ 待开始 | — |
| D7 | ai-training 能力 | ⏳ 待开始 | — |
| D8 | mlops 能力 | ⏳ 待开始 | — |

### Phase E: 双写验证 + TS 下线

| 步骤 | 任务 | 状态 | 完成日期 |
|------|------|------|---------|
| E1 | 双写期验证 | ⏳ 待开始 | — |
| E2 | E2E 测试 | ⏳ 待开始 | — |
| E3 | 下线 TS 路由 | ⏳ 待开始 | — |
| E4 | 下线 TS barrel 导出 | ⏳ 待开始 | — |
| E5 | TS 文件标记 deprecated | ⏳ 待开始 | — |
