# 未迁移模块深度分析与迁移计划

> 生成日期: 2026-07-13
> 分析范围: 147 个 TS 模块（198 总 - 51 已迁移 = 147 未迁移）
> 分析依据: TS route 文件的端点数、实现状态、外部依赖

---

## 一、总体统计

| 指标 | 数量 | 占比 |
|------|------|------|
| **未迁移模块总数** | 147 | 100% |
| **有真实实现 (REAL)** | 118 | 80.3% |
| **仅 Stub/占位 (STUB)** | 29 | 19.7% |
| **可直接迁移 (EASY)** | 109 | 74.1% |
| **中等难度 (MEDIUM)** | 7 | 4.8% |
| **需延期 (DEFER)** | 2 | 1.4% |
| **跳过 (SKIP)** | 29 | 19.7% |

**核心结论: 118 个模块有真实业务逻辑，其中 109 个可直接迁移。**

---

## 二、迁移优先级矩阵（3 阶段路线）

### Phase 5: 核心业务模块（36 个，324 端点）

**特征**: 独立性强、无外部依赖或依赖简单、业务价值高。

#### Phase 5A - 高优先级（12 个模块，先迁移）
| 模块 | 域 | 端点 | 复杂度 | 迁移理由 |
|------|-----|------|--------|----------|
| **oncall** | Observability | 16 | COMPLEX | 值班管理，独立完整 |
| **report-designer** | Data | 16 | COMPLEX | 报表设计器 |
| **api-governance** | API | 15 | COMPLEX | API 治理，高价值 |
| **backup** | Infrastructure | 15 | COMPLEX | 备份管理，独立 |
| **deploy-enhanced** | Deployment | 15 | COMPLEX | 部署增强 |
| **finops** | FinOps | 11 | MEDIUM | 成本分析 |
| **ci-type** | Pipeline | 11 | MEDIUM | CI 类型管理 |
| **api-market** | API | 14 | MEDIUM | API 市场 |
| **diagnostic** | Observability | 14 | MEDIUM | 诊断中心 |
| **problem** | Observability | 14 | MEDIUM | 问题管理 |
| **user** | Auth | 12 | MEDIUM | 用户管理，基础 |
| **change-request** | ITSM | 12 | MEDIUM | 变更请求 |

#### Phase 5B - 次优先级（24 个模块，并行迁移）
| 模块 | 域 | 端点 | 复杂度 |
|------|-----|------|--------|
| performance | Observability | 11 | MEDIUM |
| self-healing | Observability | 10 | MEDIUM |
| slo | Observability | 10 | MEDIUM |
| tracing | Observability | 10 | MEDIUM |
| apm | Observability | 8 | MEDIUM |
| alert-breaker | Observability | 6 | MEDIUM |
| community-advanced | Platform | 12 | MEDIUM |
| script-library | Platform | 11 | MEDIUM |
| chaos-enhanced | Platform | 10 | MEDIUM |
| confirmation | ITSM | 10 | MEDIUM |
| data-pipeline | Data | 12 | MEDIUM |
| self-service | Data | 12 | MEDIUM |
| inspection | Governance | 12 | MEDIUM |
| efficiency | FinOps | 12 | MEDIUM |
| billing | FinOps | 9 | MEDIUM |
| cost-allocation | FinOps | 8 | MEDIUM |
| auth-enhanced | Auth | 10 | MEDIUM |
| auth-mfa | Auth | 10 | MEDIUM |
| compliance | Auth | 8 | MEDIUM |
| session | Auth | 6 | MEDIUM |
| sso-providers | Auth | 6 | MEDIUM |
| capacity | Infrastructure | 10 | MEDIUM |
| oci-registry | Infrastructure | 10 | MEDIUM |
| sbom | Deployment | 10 | MEDIUM |
| pipeline-batch | Pipeline | 13 | MEDIUM |

**Phase 5 预估: 36 模块 × 2 天/模块 = 72 人天**

---

### Phase 6: 中等复杂度模块（9 个模块）

**特征**: 有外部依赖（eventbus/Redis/消息队列）或跨模块集成。

| 模块 | 域 | 端点 | 复杂度 | 外部依赖 | 迁移前提 |
|------|-----|------|--------|----------|----------|
| **mlops** | AI Platform | 16 | COMPLEX | - | Phase 5 完成后 |
| **hook-chain** | Platform | 22 | COMPLEX | eventbus | NATS 集成就绪 |
| **canary-analysis** | Observability | 14 | MEDIUM | eventbus | Phase 5 完成后 |
| **escalation** | Observability | 6 | MEDIUM | eventbus | Phase 5 完成后 |
| **health-check** | Observability | 7 | MEDIUM | redis | Redis 集成就绪 |
| **unified-config** | Environment | 4 | COMPLEX | redis+eventbus | Redis+NATS 就绪 |
| **eventbus** | Notifications | 9 | COMPLEX | eventbus+mq | 消息队列就绪 |
| **api-governance** | API | 15 | COMPLEX | - | 已在 Phase 5 |
| **lowcode** | Data | 14 | MEDIUM | - | Phase 5 完成后 |

**Phase 6 预估: 9 模块 × 2 天/模块 = 18 人天**

---

### Phase 7: 简单快速模块（70+ 个）

**特征**: 端点数 ≤ 10，或实现简单无外部依赖。批量处理。

按域分组迁移：

| 域 | 模块 | 端点合计 |
|-----|------|----------|
| AI Platform | ai-agent, ai-cost, ai-decision, ai-review, ai-gateway, ai-security, decision-explanation, vector-store, llm-trace, mcp, test-generation, test-selector, script | 64 |
| Observability | metrics, canary-traffic | 9 |
| Data & Integration | metadata, runbook, cross-domain, dependency-coordination, integration | 27 |
| API & Governance | queue, global-param, module, service-topology, service-health | 21 |
| Deployment | branch-policy, supply-chain, disaster-recovery, artifact-version | 32 |
| Environment | env-profile, ephemeral-env, maintenance-window, do-not-disturb, secret, config-mgmt-enhanced, middleware-ops | 53 |
| Pipeline | progressive, version-archive, apk-upload-history, pipeline-audit-log, pipeline-budget, pipeline-batch-operations, pipeline-trend, pipeline-run-history, plugin-hotreload, workflow, pipeline-graph, pipeline-sse, pipeline-template, pipeline-version, pipeline-execution-control, autonomous-pipeline | 81 |
| ITSM | change-intelligence, risk, ticket-knowledge | 8 |
| FinOps | bi-dashboard | 4 |
| Auth | security, sso-unified, user-profile, user-status, abac-policy, user-activity | 29 |
| Notifications | multi-modal-trigger, event-trigger, notification-template, scheduled-notification, webhook, notification-policy | 40 |
| Platform | community, script-version, terminal-audit | 16 |
| Workflow | workflow-dependency | 2 |

**Phase 7 预估: 70 模块 × 0.5 天/模块 = 35 人天**

---

## 三、跳过模块（29 个）

**这些模块为 Stub/占位实现，暂不迁移**。分为两类：

### 3.1 架构层占位（有代码但无端点）
| 模块 | 行数 | 说明 |
|------|------|------|
| event-trigger-registry | 474 | 事件注册表，无路由 |
| workflow-trigger | 602 | 工作流触发器，无路由 |
| notification | 492 | 通知模块，无路由 |
| privacy | 275 | 隐私模块，无路由 |
| message-queue | 289 | 消息队列，无路由 |
| cache | 254 | 缓存模块，无路由 |
| artifact-lifecycle | 244 | 制品生命周期，无路由 |
| dual-engine | 179 | 双引擎，无路由 |
| data-lineage | 193 | 数据血缘，无路由 |
| degradation | 197 | 降级，无路由 |
| circuit-breaker | 207 | 熔断器，无路由 |
| channel | 147 | 通道，无路由 |
| data-quality | 134 | 数据质量，无路由 |

### 3.2 零端点小文件
| 模块 | 行数 |
|------|------|
| cache-cleanup | 110 |
| vectorize-rules | 99 |
| api-key | 85 |
| permission-audit | 108 |
| pipeline-error-detail | 42 |
| task-timeout | 158 |
| role | 121 |
| sso | 281 |
| user-token | 221 |
| vector | 103 |
| ueba | 81 |
| process-step | 193 |
| workflow-task | 290 |
| workflow-webhook | 153 |
| observability | 124 |

**处理策略**: 这些模块要么无实现，要么是基础设施层占位。不迁移，等 Phase 5-7 完成后评估是否需要。

---

## 四、迁移资源估算

| 阶段 | 模块数 | 预估人天 | 并行团队 | 日历天数 |
|------|--------|----------|----------|----------|
| **Phase 5** | 36 | 72 人天 | 2 人 | ~36 天 |
| **Phase 6** | 9 | 18 人天 | 1 人 | ~18 天 |
| **Phase 7** | 70+ | 35 人天 | 1 人 | ~35 天 |
| **Phase SKIP** | 29 | - | - | 跳过 |
| **总计** | 115 | ~125 人天 | - | ~89 天（9 周）|

---

## 五、迁移依赖

### 5.1 基础设施依赖
| 依赖 | 涉及模块 | 迁移前提 |
|------|----------|----------|
| Redis 集成 | health-check, auth-enhanced, mcp, sso-unified, unified-config | Go 平台 Redis client 就绪 |
| NATS/消息队列 | eventbus, hook-chain, canary-analysis, escalation | Go 平台 NATS 集成就绪 |
| Event Bus | ephemeral-env, notification-policy 等 | Go 平台 Event Bus 就绪 |
| AI/LLM API | ai-*, mlops, test-generation, script | LLM provider 配置就绪 |

### 5.2 已迁移模块依赖
| Go 模块 | 被依赖模块 |
|---------|------------|
| tenant | 所有模块（多租户隔离）|
| auth | user/session/sso 等 |
| pipeline | pipeline-* 系列模块 |
| config | 配置管理相关模块 |
| internal-library | 暂无 |

---

## 六、迁移流程模板

每个模块迁移遵循以下流程：

```
1. 创建目录: internal/<module>/ (handler, service, repository, models, config)
2. 复制模型: 从 TS models/ 映射到 Go models/*.go
3. 实现仓库: repository.go → PostgreSQL CRUD
4. 实现服务: service.go → 业务逻辑
5. 实现处理器: handler.go → Gin 路由 + auth 守卫
6. 创建迁移: migrations/<N>_create_<module>_tables.sql
7. 注册路由: cmd/server/main.go 或 routes.go
8. 构建验证: go build ./...
9. 测试验证: go test ./internal/<module>/...
10. 归档 TS: 在 TS route 文件添加 [ARCHIVED] 标记
```

---

## 七、下一步行动

1. **[P0]** 启动 Phase 5A：优先迁移 oncall、api-governance、backup、deploy-enhanced、report-designer 等 12 个高价值模块
2. **[P0]** 确认 Go 平台 Redis/NATS/EventBus 集成状态
3. **[P1]** 启动 Phase 5B：并行迁移剩余 24 个模块
4. **[P1]** 每个模块完成后执行 go build + go test 验证
5. **[P2]** Phase 6：迁移依赖外部基础设施的 9 个模块
6. **[P3]** Phase 7：批量迁移 70+ 个简单模块
7. **[P3]** 所有迁移完成后评估 29 个 SKIP 模块是否需要迁移

---

*本计划基于 2026-07-13 的代码状态分析，随项目进展动态更新。*
