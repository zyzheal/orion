# Phase 5 Go Migration Progress

**更新日期**: 2026-07-14 (Phase 3.1 完成)
**当前分支**: fix/p0-route-auth-and-error-envelope
**总览**: Wave 0-7 完成 (蓝图层), Phase 3.1 Pipeline Engine Core 完成

---

## 1. 整体进度

| Wave | 内容 | 模块数 | 已完成 | 完成率 | 状态 |
|------|------|--------|--------|--------|------|
| Wave 0 | 基础设施 (idempotency/sse/cron/dag/middleware) | 5 共享包 | 5 | 100% | ✅ |
| Wave 1 | 通用域 (user/role/session/api-key/ci-type/api-market/eventbus/event-trigger/hook-chain) | 9 | 9 | 100% | ✅ |
| Wave 2 | 认证+权限 (auth-enhanced/auth-mfa/sso-unified/sso-providers/abac-policy/permission-audit) | 6 | 6 | 100% | ✅ |
| Wave 3 | 通知上下文 (notification/policy/template/scheduled/webhook/do-not-disturb/channel) | 7 | 7 | 100% | ✅ |
| Wave 4 | 工作流+低代码 (workflow/trigger/task/dependency/lowcode/webhook) | 6 | 6 | 100% | ✅ |
| Wave 5 | Pipeline 辅助 (batch/sse/execution-control/audit-log/graph/template/version/run-history/batch-operations/trend/change-intelligence) | 11 | 11 | 100% | ✅ |
| Wave 6 | 可观测性 (tracing/slo/health-check) | 3 | 3 | 100% | ✅ |
| Wave 7a | P2 模块批次1 (compliance/supply-chain/secret/chaos-enhanced/ueba) | 5 | 5 | 100% | ✅ |
| Wave 7b-j | P2 模块+Webhook (alert-breaker~version-archive + 30 webhook-* + automation) | 80+ | 80+ | 100% | ✅ |
| **小计** | **Go 蓝图层 (标准 CRUD 模板)** | **194** | **188 registered** | **—** | **✅ 完成** |

---

## 2. Phase 路线图 (来自主计划)

| Phase | 内容 | 计划预估 | 状态 |
|-------|------|---------|------|
| Phase 0 | 基础设施先行 | 2.5d | ✅ 完成 |
| Phase 0.5 | DDD 梳理 + Schema 对齐 | 2d | ⚠️ 部分 |
| Phase 1 | 消除代码重复 + 注册未注册模块 | 4d | ✅ 完成 |
| Phase 2 | 合并蓝图中有完整代码的模块 | 7d | ⚠️ 进行中 |
| **Phase 3** | **核心域 TS 迁移 (Pipeline/Saga 引擎)** | **5d** | **🔄 进行中** |
| Phase 4 | Gateway 业务逻辑迁移 + P1 TS 模块 | 16.5d | ❌ 未开始 |
| Phase 5 | 剩余 TS 模块 + Gateway 瘦身 | 10d | ❌ 未开始 |
| Phase 6 | 可选微服务拆分 | 待定 | ⬜ |

---

## 3. 实际代码状态 (2026-07-14 扫描)

### 3.1 Go 模块完整性

| 指标 | 数值 |
|------|------|
| 总模块目录 | 194 |
| 完整 4 层 (models/repo/service/handler) | 179 |
| 部分实现 (缺 handler 或 repo) | 15 |
| handler import 数 | 188 |
| RegisterRoutes 调用 | 189 |
| go build | ✅ PASS (42MB binary) |

### 3.2 部分实现模块 (15 个)

| 模块 | 有 | 缺 |
|------|----|----|
| api-key | H R S | M (models) |
| event-trigger | H R S | M (models) |
| eventbus | H R S | M (models) |
| hook-chain | H R S | M (models) |
| permission | H R S | M (models) |
| role | H R S | M (models) |
| session | H R S | M (models) |
| webhook | H R S | M (models) |
| environment | H M | R S |
| feature-flag | H M | R S |
| federation | H M | R S |
| inception | H M | R S |
| plugin | H M | R S |
| project | H M | R S |
| skill | H S M | R (repository) |

### 3.3 P0 阻塞问题状态

| P0 | 问题 | 文档状态 | 实际验证 |
|----|------|---------|---------|
| P0-1 | 影子模式只读化 | ✅ 已解决 | ✅ `readonly.go` 存在 |
| P0-2 | 双写冲突防范 | ✅ 已解决 | ⚠️ 未验证运行时 |
| P0-3 | Go migration Down() | ✅ 已实现 | ✅ migrate.go 有 Down 支持 |
| P0-4 | Gateway 灰度 | ⚠️ 代码已存在 | `gray_release.go` 基础版, 待完善 |
| P0-5 | CI/CD 集成 | ✅ 已完成 | ✅ ci.yml 含 go build |
| P0-6 | Helm 健康检查 | ✅ 已完成 | ✅ liveness/readiness 已配置 |

---

## 4. 核心差距 (真正的未完成工作)

### 4.1 TS-only 服务 (60+ 个, 有业务逻辑但 Go 无对应)

**大模块 (≥10 .ts files)**:

| TS 服务 | TS 文件数 | Go 对应 | 重要性 |
|---------|----------|---------|--------|
| `pipeline` | **124** | internal/pipeline-* (辅助模块, 无引擎) | **P0** |
| `build` | 46 | — | P1 |
| `ai` | 40 | — | P0 |
| `config-mgmt` | 30 | internal/config (部分) | P1 |
| `auth` | 25 | internal/auth-* (完整) | P0 |
| `sbom` | 17 | — | P1 |
| `security` | 19 | — | P1 |
| `self-healing` | 14 | — | P1 |
| `smart-deploy` | 15 | — | P1 |
| `test-selector` | 14 | — | P2 |
| `ai-agents` | 16 | — | P1 |
| `chaos-engineering` | 16 | internal/chaos (部分) | P1 |

**Pipeline 引擎 (最关键)**:
- TS: PipelineEngine(405r) + ContainerExecutor(272r) + CheckpointManager(474r) + MultiTargetExecutor(167r) = **1,318 行**
- Go: 仅有辅助模块 (batch/sse/graph/version 等), **无执行引擎**

**Saga 编排**:
- TS: SagaCoordinator(432r) + DeploySaga(532r) + IdempotencyChecker(260r) = **1,281 行**
- Go: go-common/pkg/idempotency (仅幂等性 Key), **无 Saga 编排**

### 4.2 Gateway 业务逻辑 (12 个 routes.ts 待迁移)

| 路由 | 行数 | 存储 | 迁移目标 |
|------|------|------|---------|
| ai-models | 712 | Map() 内存 | internal/ai/llm/ |
| ai-decisions | 791 | Map() 内存 | internal/ai/intelligence/ |
| ai-degradation | 637 | Map() 内存 | internal/ai/degradation/ |
| chaos | 784 | Map() 内存 | internal/chaos-gateway/ |
| digital-twin | 865 | Map() 内存 | internal/digital-twin-simulation/ |
| governance | 864 | Map() 内存 | internal/governance/ |
| pipeline-versions | 472 | Map() 内存 | internal/pipeline/ |
| pipeline-budget | 521 | Map() 内存 | internal/pipeline/ |
| pipeline-templates | 710 | Map() 内存 | internal/pipeline/ |
| resilience-score | 688 | Map() 内存 | internal/resilience-score/ |
| sbom | 886 | Map() 内存 | internal/sbom/ |
| tenant | 630 | Redis | internal/tenant/ |
| **合计** | **8,719** | — | — |

---

## 5. Phase 3 核心域 TS 引擎迁移 (当前)

### 5.1 目标

将 TS 平台的 **Pipeline 执行引擎 + Saga 编排** 迁移到 Go, 这是整个平台最复杂的核心域。

### 5.2 TS 核心组件清单

```
orion-platform-service/src/
├── engine/                          # Pipeline 执行引擎
│   ├── PipelineEngine.go            # 阶段执行编排 (405r)
│   ├── ContainerExecutor.go         # 容器执行 (272r)
│   ├── CheckpointManager.go         # 断点续传 (474r)
│   └── MultiTargetExecutor.go       # 多目标部署 (167r)
├── saga/                            # Saga 编排
│   ├── SagaCoordinator.go           # Saga 协调器 (432r)
│   ├── DeploySaga.go                # 部署 Saga (532r)
│   ├── IdempotencyChecker.go        # 幂等性检查 (260r)
│   └── TransactionLog.go            # 事务日志
├── events/                          # 事件系统
│   ├── publishers/                  # 事件发布器
│   └── consumers/                   # JetStream 消费者
├── services/pipeline/               # Pipeline 业务逻辑 (124r)
└── services/build/                  # Build 业务逻辑 (46r)
```

### 5.3 Go 已有基础设施

```
orion-platform-svc-go/
├── internal/pipeline-batch/         # 批次执行 (CRUD)
├── internal/pipeline-sse/           # SSE 日志流
├── internal/pipeline-execution-control/ # 执行控制
├── internal/pipeline-audit-log/     # 审计日志
├── internal/pipeline-graph/         # DAG 图
├── internal/pipeline-template/      # 模板
├── internal/pipeline-version/       # 版本管理
├── internal/pipeline-run-history/   # 历史
├── internal/pipeline-batch-operations/ # 批量操作
├── internal/pipeline-trend/         # 趋势
├── internal/change-intelligence/    # 变更影响分析
├── go-common/pkg/idempotency/       # 幂等性 Key
└── go-common/pkg/nats/              # NATS 连接 (已有)
```

### 5.4 Phase 3 任务拆解

| 任务 | 描述 | TS 源 | Go 目标 | 预估 |
|------|------|-------|---------|------|
| 3.1 | PipelineEngine 迁移 | engine/PipelineEngine (405r) | internal/pipeline-engine/ | 2d |
| 3.2 | ContainerExecutor 迁移 | engine/ContainerExecutor (272r) | internal/pipeline-engine/ | 1.5d |
| 3.3 | CheckpointManager 迁移 | engine/CheckpointManager (474r) | internal/pipeline-engine/ | 1.5d |
| 3.4 | MultiTargetExecutor 迁移 | engine/MultiTargetExecutor (167r) | internal/pipeline-engine/ | 1d |
| 3.5 | SagaCoordinator 迁移 | saga/SagaCoordinator (432r) | internal/saga/ | 1.5d |
| 3.6 | DeploySaga 迁移 | saga/DeploySaga (532r) | internal/saga/ | 1.5d |
| 3.7 | TransactionLog 迁移 | saga/TransactionLog | internal/saga/ | 0.5d |
| 3.8 | 事件系统迁移 | events/ (19 文件) | 复用 NATS | 1d |
| 3.9 | 集成测试 + 性能基线对比 | — | — | 1d |
| **合计** | | **~2,600 行 TS** | | **~10d** |

---

## 6. 下一步行动 (Phase 3 启动)

1. **Phase 3.1**: 分析 TS PipelineEngine 源码, 提取领域模型
2. **Phase 3.2**: 创建 Go internal/pipeline-engine/ 模块
3. **Phase 3.3**: 迁移 Saga 编排框架
4. **Phase 3.4**: 集成测试 + 性能基线

**预估完成**: 2026-07-24 (~10d)

---

## 7. Git 提交记录

| Commit | 说明 |
|--------|------|
| `a7d6341d` | chore: update go.mod/go.sum for Wave 7 |
| `6316cf01` | feat: add 45 Wave 7 P2 + 33 webhook modules, 188 handlers |
| `50cd4f8d` | feat: create 10 placeholder modules (4-layer) |
| `5e4aedc8` | feat(health-check): create 4-layer module |
| `1948306d` | Register api-market and ci-type routes |
| `aa4000a0` | feat(go-svc): migrate 8 TS modules, add error envelope |
| `8f0c44a0` | Implement: migrate TS deploy-enhanced (15 endpoints) |
| `12dd5cdc` | chore: archive 51 migrated TS modules |
| `87fec078` | feat(cmdb): add 7 integration endpoints |
