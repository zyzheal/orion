# Gap Analysis: orion-ai-svc → orion-ai-svc-go

> Generated: 2026-07-24 | Agent-3

## 现状

| 指标 | 值 |
|------|-----|
| TS 源文件 | 76 |
| Go 文件 | 56 |
| Go 域数 | 7 (aigateway, aiagent, aicost, aireview, aisecurity, intelligence, llm, skill) |
| 缺失域数 | 20 |

## 已覆盖域 (Go)

| Go 域 | TS 对应 | 功能 |
|-------|---------|------|
| aigateway | AIGateway.ts | AI 网关、场景路由 |
| aiagent | AgentService.ts, AgentRunService.ts | Agent 管理、运行 |
| aicost | CostTracker.ts, CostOptimizerService.ts | AI 成本追踪、优化 |
| aireview | AIReviewService.ts | AI 代码审查 |
| aisecurity | AISecurityService.ts, PromptInjectionDetector.ts | AI 安全、Prompt 注入检测 |
| intelligence | AIGenerateService.ts, AIDiagnosisService.ts | AI 生成、诊断 |
| llm | ProviderRegistry.ts, ModelVersionService.ts | LLM 提供商、模型版本管理 |
| skill | ToolRegistry.ts, ToolExecutor.ts | 技能管理、工具执行 |

## 缺失域 (需补全)

### P0 — 核心 AI 功能

| TS 服务 | TS 文件 | 功能描述 | 优先级 |
|---------|---------|---------|--------|
| KnowledgeService | KnowledgeService.ts | 知识库检索 (RAG) | P0 |
| VectorStore | VectorStore.ts | 向量数据库操作 | P0 |
| SemanticSearchService | SemanticSearchService.ts | 语义搜索 | P0 |
| MultiAgentOrchestrator | MultiAgentOrchestrator.ts | 多 Agent 编排 | P0 |
| TaskExecutor | TaskExecutor.ts | 任务执行器 | P0 |
| RunnerManager | RunnerManager.ts | Runner 管理 | P0 |
| CodeEmbeddingService | CodeEmbeddingService.ts | 代码嵌入 | P0 |
| DecisionExplanationService | DecisionExplanationService.ts | 决策解释 | P0 |
| LLMTraceService | LLMTraceService.ts, CostCalculator.ts | LLM 追踪、成本计算 | P0 |
| AIDegradationRouter | AIDegradationRouter.ts | AI 降级路由 | P0 |

### P1 — 增强功能

| TS 文件 | 功能描述 |
|---------|---------|
| AutoRecoveryService | 自动恢复 |
| CircuitBreakerManager | 断路器管理 |
| ProviderCircuitBreaker | 提供商断路器 |
| ComplianceReporter | 合规报告 |
| RuleEngine | 规则引擎 |
| ScenarioRouter | 场景路由 |
| PromptGuardService | Prompt 防护 |
| PromptSanitizer | Prompt 清洗 |
| PromptSecurity | Prompt 安全 |
| ThreatMonitor | 威胁监控 |
| AuditRepository | 审计仓库 |

## 实施计划

### Phase 1 (Day 1): P0 核心
- [ ] 实现 knowledge 域 (handler/service/repository/models) — RAG 知识库
- [ ] 实现 vector 域 (handler/service/repository/models) — 向量存储
- [ ] 实现 semantic-search 域 (handler/service/repository)
- [ ] 实现 orchestration 域 (handler/service/repository) — 多 Agent 编排
- [ ] 实现 llm-trace 域 (handler/service/repository/models) — LLM 追踪

### Phase 2 (Day 2): P0 续 + P1
- [ ] 实现 task-executor 域 (handler/service/repository/models)
- [ ] 实现 code-embedding 域 (handler/service/repository)
- [ ] 实现 decision-explanation 域 (handler/service/repository)
- [ ] 实现 degradation 域 (handler/service)
- [ ] 实现 provider-circuit-breaker 域 (handler/service)

### Phase 3 (Day 3): 完善 + 验证
- [ ] 补充 auto-recovery 域
- [ ] 补充 rule-engine 域
- [ ] 补充 prompt-security 域 (合并到 aisecurity)
- [ ] 补充所有 model 定义
- [ ] 补充 wiring (main.go DI 组装)
- [ ] go build 验证
- [ ] 路由数对等验证
- [ ] 更新 TRACKER.md
