# Orion 后端功能架构深度文档

> 更新日期: 2026-08-01 | 数据源: Go 源码逐模块扫描 + CodeGraph 图分析
> Go 模块: 286 个 internal 包 | Handler: 27 个 | Service: 27 个 | Repository: 23 个 | Models: 26 个
> Wiring: 1224 行 | NATS 订阅: 9+ 个服务 | 架构健康度: 8.3/10

---

## 一、后端技术栈

| 维度 | 选型 |
|------|------|
| 语言 | Go 1.25 |
| 框架 | Gin (HTTP) + NATS (事件驱动) |
| 数据库 | PostgreSQL (主存储) |
| 架构 | Handler → Service → Repository 三层 |
| 依赖注入 | 手动 wiring.go (1224 行) |
| 事件总线 | NATS JetStream (Incident/Self-Healing/FinOps/Config/Identity) |
| 迁移 | goose (643 个 SQL migration 文件) |
| 构建 | go build / go test |
| 模块路径 | `orion/platform-svc-go` |

---

## 二、10 域模块总览 (286 个 internal 包)

### 2.1 域分布

| 域 | 模块数 | 代表模块 | 核心度 |
|------|--------|---------|--------|
| ITSM / 治理 | 14 | ticketing, incident, change, problem, sla, approval, queue | ⭐⭐⭐⭐⭐ |
| CI/CD 交付 | 22 | pipeline, build, deploy, artifact, ci-cd, runner | ⭐⭐⭐⭐⭐ |
| CMDB / 基础设施 | 13 | cmdb, cluster, network, infrastructure, secret, storage | ⭐⭐⭐⭐⭐ |
| 监控 / 可观测性 | 10 | monitoring, apm, tracing, alert, eventbus, observability | ⭐⭐⭐⭐ |
| 通知 / 告警 | 12 | alert, notification-policy, notification-template, channel | ⭐⭐⭐⭐ |
| AI / ChatOps | 10 | chatops, ai, ai-agent-run, knowledge, llm, self-healing | ⭐⭐⭐⭐ |
| 身份认证 | 11 | auth, user, tenant, role, permission, session, abac-policy | ⭐⭐⭐⭐⭐ |
| FinOps / 数据 | 15 | finops, cost-allocation, billing, efficiency, data-catalog | ⭐⭐⭐⭐ |
| 配置 / 低代码 / 插件 | 16 | config, lowcode, plugin, workflow, form, iac, rule-engine | ⭐⭐⭐⭐ |
| 跨域 / 工具 | 13 | crossover, global-search, audit, compliance, saga, statistics | ⭐⭐⭐ |

### 2.2 三层架构分布

| 层 | 目录数 | 覆盖率 |
|------|--------|--------|
| Handler | 27 | 100% (存在 handler 的模块) |
| Service | 27 | 100% (存在 service 的模块) |
| Repository | 23 | 85% (4 个模块缺 Repository: crossover, prompt-security, alert-deduplication, statistics) |
| Models | 26 | 96% |

**架构规则**: 严格遵循 Handler → Service → Repository 三层，依赖方向从外向内。

---

## 三、ITSM / 治理域 (14 模块)

| 模块 | H | S | R | M | N | 行数 | 路由 | 方法 | 深度评级 |
|------|---|---|---|---|---|---|---|---|---|
| ticketing | ✅ | ✅ | ✅ | ✅ | ✅ | 13084 | 31 | 188 | ⭐⭐⭐⭐⭐ |
| ticket | ✅ | ✅ | ✅ | ✅ | ✅ | 7526 | 0 | 106 | ⭐⭐⭐⭐⭐ |
| incident | ✅ | ✅ | ✅ | ✅ | ✅ | 1874 | 0 | 20 | ⭐⭐⭐⭐⭐ |
| problem | ✅ | ✅ | ✅ | ✅ | ✅ | 1430 | 0 | 16 | ⭐⭐⭐⭐ |
| change | ✅ | ✅ | ✅ | ✅ | ✅ | 1368 | 0 | 18 | ⭐⭐⭐⭐ |
| change-request | ✅ | ✅ | ✅ | ✅ | ✅ | 1085 | 0 | 12 | ⭐⭐⭐⭐ |
| sla | ✅ | ✅ | ✅ | ✅ | ✅ | 1341 | 0 | 17 | ⭐⭐⭐⭐ |
| sla-engine | ✅ | ✅ | ✅ | ✅ | ✅ | 1999 | 0 | 24 | ⭐⭐⭐⭐ |
| approval | ✅ | ✅ | ✅ | ✅ | ✅ | 1381 | 0 | 26 | ⭐⭐⭐⭐⭐ |
| queue | ✅ | ✅ | ✅ | ✅ | ✅ | 639 | 8 | 8 | ⭐⭐⭐ |
| escalation | — | — | — | — | — | — | 0 | 0 | 待确认 |
| runbook | ✅ | ✅ | ✅ | ✅ | ✅ | 627 | 7 | 8 | ⭐⭐⭐ |
| ticket-knowledge | ✅ | ✅ | ✅ | ✅ | ✅ | — | — | — | ⭐⭐⭐⭐ |
| ticket-automation | ✅ | ✅ | ✅ | ✅ | ✅ | — | — | — | ⭐⭐⭐⭐ |

**核心交互链**:
```
Ticket → Incident/Problem/Change (关联)
Incident → PriorityMatrix (impact × urgency)
SLA → StartTracking → PauseTracking → ResumeTracking → MarkBreach
Approval → Multi-level → Delegate → Emergency → Template
```

---

## 四、CI/CD 交付域 (22 模块)

| 模块 | H | S | R | M | N | 行数 | 路由 | 方法 | 深度评级 |
|------|---|---|---|---|---|---|---|---|---|
| pipeline | ✅ | ✅ | ✅ | ✅ | ✅ | 857 | 13 | 13 | ⭐⭐⭐⭐ |
| pipeline-engine | ✅ | ✅ | ✅ | ✅ | ✅ | 3148 | 6 | 52 | ⭐⭐⭐⭐⭐ |
| pipeline-executor | ✅ | ✅ | ✅ | ✅ | ✅ | 2127 | 0 | 13 | ⭐⭐⭐⭐ |
| pipeline-sse | ✅ | ✅ | ✅ | ✅ | ✅ | 657 | 0 | 0 | ⭐⭐⭐ |
| pipeline-batch | ✅ | ✅ | ✅ | ✅ | ✅ | 750 | 0 | 13 | ⭐⭐⭐⭐ |
| pipeline-graph | ✅ | ✅ | ✅ | ✅ | ✅ | 1094 | 0 | 5 | ⭐⭐⭐ |
| pipeline-budget | ✅ | ✅ | ✅ | ✅ | ✅ | 1231 | 8 | 10 | ⭐⭐⭐⭐ |
| pipeline-templates | ✅ | ✅ | ✅ | ✅ | ✅ | 1233 | 13 | 13 | ⭐⭐⭐⭐ |
| pipeline-versions | ✅ | ✅ | ✅ | ✅ | ✅ | 974 | 0 | 10 | ⭐⭐⭐⭐ |
| pipeline-audit-log | ✅ | ✅ | ✅ | ✅ | ✅ | 615 | 0 | 5 | ⭐⭐⭐ |
| pipeline-run-history | ✅ | ✅ | ✅ | ✅ | ✅ | 271 | 0 | 1 | ⚠️ 薄 |
| pipeline-trend | ✅ | ✅ | ✅ | ✅ | ✅ | 472 | 0 | 2 | ⚠️ 薄 |
| pipeline-error-detail | ✅ | ✅ | ✅ | ✅ | ✅ | 611 | 0 | 1 | ⚠️ 薄 |
| ci-cd | ✅ | ✅ | ✅ | ✅ | ✅ | 21689 | 0 | 0 | ⚠️ 薄 |
| build | ✅ | ✅ | ✅ | ✅ | ✅ | 910 | 13 | 15 | ⭐⭐⭐⭐⭐ |
| build-env | ✅ | ✅ | ✅ | ✅ | ✅ | 1232 | 0 | 22 | ⭐⭐⭐⭐⭐ |
| deploy | ✅ | ✅ | ✅ | ✅ | ✅ | 847 | 0 | 17 | ⭐⭐⭐⭐⭐ |
| deploy-enhanced | ✅ | ✅ | ✅ | ✅ | ✅ | 1167 | 0 | 16 | ⭐⭐⭐⭐⭐ |
| smart-deploy | ✅ | ✅ | ✅ | ✅ | ✅ | 1119 | 10 | 11 | ⭐⭐⭐⭐ |
| progressive | ✅ | ✅ | ✅ | ✅ | ✅ | 1288 | 12 | 14 | ⭐⭐⭐⭐⭐ |
| deployment-trigger | ✅ | ✅ | ✅ | ✅ | ✅ | 867 | 0 | 9 | ⭐⭐⭐⭐ |
| artifact | ✅ | ✅ | ✅ | ✅ | ✅ | 1223 | 0 | 19 | ⭐⭐⭐⭐⭐ |
| artifact-version | ✅ | ✅ | ✅ | ✅ | ✅ | 1829 | 62 | 62 | ⭐⭐⭐⭐⭐ |
| runner | ✅ | ✅ | ✅ | ✅ | ✅ | 1749 | 0 | 18 | ⭐⭐⭐⭐ |
| execution-mode-engine | ✅ | ✅ | ✅ | ✅ | ✅ | 1491 | 5 | 5 | ⭐⭐⭐⭐ |

**Pipeline Engine 三层架构**:
```
PipelineEngine(Execute)
  ├── Scheduler(NewScheduler)
  │   └── DependencyGraph
  │       ├── Order() — Kahn 拓扑排序
  │       ├── LevelGroups() — 并行阶段分组
  │       └── detectCycle() — 循环检测
  └── Engine(runStages)
      ├── runTasks() / executeTask()
      ├── executeRollback() — Saga 回滚
      └── SetRollback/SetCallbacks/RegisterHandler
```

**部署策略 (58 Service 方法)**:
- 蓝绿部署: 17 方法
- 增强部署: 16 方法
- 智能部署: 11 方法
- 渐进式部署: 14 方法

---

## 五、CMDB / 基础设施域 (13 模块)

| 模块 | H | S | R | M | N | 行数 | 路由 | 方法 |
|------|---|---|---|---|---|---|---|---|
| cmdb | ✅ | ✅ | ✅ | ✅ | ✅ | 4560 | 0 | 30 |
| cmdb-collector | ✅ | ✅ | ✅ | ✅ | ✅ | 3754 | 0 | 5 |
| cmdb-import | ✅ | ✅ | ✅ | ✅ | ✅ | 1405 | 0 | 0 |
| cmdb-relationship | ✅ | ✅ | ✅ | ✅ | ✅ | 1141 | 0 | 0 |
| cmdb-validator | ✅ | ✅ | ✅ | ✅ | ✅ | 2321 | 0 | 0 |
| cluster | ✅ | ✅ | ✅ | ✅ | ✅ | 611 | 0 | 7 |
| multi-cloud | ✅ | ✅ | ✅ | ✅ | ✅ | 1780 | 0 | 23 |
| network | ✅ | ✅ | ✅ | ✅ | ✅ | 1573 | 25 | 28 |
| infrastructure | ✅ | ✅ | ✅ | ✅ | ✅ | 14995 | 0 | 19 |
| serverless | ✅ | ✅ | ✅ | ✅ | ✅ | 1181 | 0 | 16 |
| secret | ✅ | ✅ | ✅ | ✅ | ✅ | 767 | 0 | 12 |
| storage | ✅ | ✅ | ✅ | ✅ | ✅ | 793 | 5 | 7 |
| disaster-recovery | ✅ | ✅ | ✅ | ✅ | ✅ | 440 | 6 | 6 |

**CMDB 架构亮点**:
- **AdapterFactory**: Agentless 自动发现, 注册表模式
- **Pluggable Import**: IImportHandler 接口, 5 格式支持 (CSV/Excel/JSON/YAML/API)
- **BFS Topology**: 双向遍历, `TopologyNode`(递归) + `TopologyEdge`
- **ValidatorRegistry**: 注册表模式 + 内建校验器
- **Visor**: Xterm.js 8 addon + WebSocket + SSH Session

---

## 六、监控 / 可观测性域 (10 模块)

| 模块 | H | S | R | M | N | 行数 | 路由 | 方法 |
|------|---|---|---|---|---|---|---|---|
| monitoring | ✅ | ✅ | ✅ | ✅ | ✅ | 10077 | 0 | 37 |
| apm | ✅ | ✅ | ✅ | ✅ | ✅ | 603 | 0 | 8 |
| tracing | ✅ | ✅ | ✅ | ✅ | ✅ | 615 | 0 | 10 |
| performance | ✅ | ✅ | ✅ | ✅ | ✅ | 612 | 0 | 11 |
| health-check | ✅ | ✅ | ✅ | ✅ | ✅ | 640 | 0 | 13 |
| slo | ✅ | ✅ | ✅ | ✅ | ✅ | 679 | 0 | 10 |
| metrics | ✅ | ✅ | ✅ | ✅ | ✅ | 291 | 5 | 5 |
| observability | ✅ | ✅ | ✅ | ✅ | ✅ | 322 | 5 | 5 |
| eventbus | ✅ | ✅ | ✅ | ✅ | ✅ | 4367 | 0 | 28 |
| llm-trace | ✅ | ✅ | ✅ | ✅ | ✅ | 1145 | 0 | 13 |

**NATS 事件总线架构**:
```
EventBus (NATS JetStream)
  ├── nats_client.go → conn *nats.Conn
  ├── service/eventbus_service.go → 28 方法
  └── 订阅者分布:
      ├── incident/nats → 事件处理
      ├── self-healing/nats → 自愈
      ├── finops/efficiency/nats → 成本数据
      ├── finops/report-designer/nats → 报表
      ├── identity/user/nats → 用户事件
      ├── config/pkg/nats → 配置变更
      ├── pandawiki/nats → 知识库
      └── code/pkg/nats → 代码事件
```

---

## 七、通知 / 告警域 (12 模块)

| 模块 | H | S | R | M | N | 行数 | 路由 | 方法 |
|------|---|---|---|---|---|---|---|---|
| alert | ✅ | ✅ | ✅ | ✅ | ✅ | 1256 | 0 | 18 |
| alert-adapter | ✅ | ✅ | ✅ | ✅ | ✅ | 3311 | 0 | 9 |
| alert-breaker | ✅ | ✅ | ✅ | ✅ | ✅ | 575 | 0 | 5 |
| alert-correlation | ✅ | ✅ | ✅ | ✅ | ✅ | 600 | 7 | 7 |
| alert-deduplication | ✅ | ✅ | ✅ | ✅ | — | 254 | 0 | 5 |
| alert-silence | ✅ | ✅ | ✅ | ✅ | ✅ | 504 | 0 | 6 |
| notification-policy | ✅ | ✅ | ✅ | ✅ | ✅ | 948 | 0 | 12 |
| notification-template | ✅ | ✅ | ✅ | ✅ | ✅ | 705 | 0 | 9 |
| notification-management | ✅ | ✅ | ✅ | ✅ | ✅ | 300 | 5 | 5 |
| do-not-disturb | ✅ | ✅ | ✅ | ✅ | ✅ | 312 | 0 | 4 |
| channel | ✅ | ✅ | ✅ | ✅ | ✅ | 430 | 0 | 6 |
| scheduled-notification | ✅ | ✅ | ✅ | ✅ | ✅ | 832 | 0 | 10 |

**告警事件链路**:
```
Alert → AlertAdapter → AlertDeduplication → AlertCorrelation → AlertSilence
  → AlertBreaker → NotificationPolicy → NotificationTemplate → Channel
```

---

## 八、AI / ChatOps 域 (10 模块)

| 模块 | H | S | R | M | N | 行数 | 路由 | 方法 |
|------|---|---|---|---|---|---|---|---|
| chatops | ✅ | ✅ | ✅ | ✅ | ✅ | 4653 | 0 | 84 |
| ai | ✅ | ✅ | ✅ | ✅ | ✅ | 20221 | 0 | 4 |
| ai-agent-run | ✅ | ✅ | ✅ | ✅ | ✅ | 1088 | 0 | 11 |
| knowledge | ✅ | ✅ | ✅ | ✅ | ✅ | 1429 | 0 | 17 |
| prompt-security | ✅ | ✅ | ✅ | — | — | 296 | 0 | 3 |
| llm | ✅ | ✅ | ✅ | ✅ | ✅ | 1198 | 0 | 18 |
| diagnostic | ✅ | ✅ | ✅ | ✅ | ✅ | 1161 | 0 | 15 |
| self-healing | ✅ | ✅ | ✅ | ✅ | ✅ | 997 | 0 | 8 |
| runbook | ✅ | ✅ | ✅ | ✅ | ✅ | 627 | 7 | 8 |
| llm-trace | ✅ | ✅ | ✅ | ✅ | ✅ | 1145 | 0 | 13 |

---

## 九、身份认证域 (11 模块)

| 模块 | H | S | R | M | N | 行数 | 路由 | 方法 |
|------|---|---|---|---|---|---|---|---|
| auth | ✅ | ✅ | ✅ | ✅ | ✅ | 769 | 0 | 8 |
| auth-enhanced | ✅ | ✅ | ✅ | ✅ | ✅ | 2152 | 0 | 9 |
| auth-mfa | ✅ | ✅ | ✅ | ✅ | ✅ | 424 | 0 | 10 |
| user | ✅ | ✅ | ✅ | ✅ | ✅ | 718 | 0 | 8 |
| tenant | ✅ | ✅ | ✅ | ✅ | ✅ | 2286 | 0 | 24 |
| role | ✅ | ✅ | ✅ | ✅ | ✅ | 594 | 0 | 8 |
| permission | ✅ | ✅ | ✅ | ✅ | ✅ | 479 | 0 | 6 |
| session | ✅ | ✅ | ✅ | ✅ | ✅ | 478 | 0 | 7 |
| abac-policy | ✅ | ✅ | ✅ | ✅ | ✅ | 409 | 0 | 5 |
| capability | ✅ | ✅ | ✅ | ✅ | ✅ | 2208 | 0 | 33 |
| identity | ✅ | ✅ | ✅ | ✅ | ✅ | 9132 | 0 | 0 |

---

## 十、FinOps / 数据域 (15 模块)

| 模块 | H | S | R | M | N | 行数 | 路由 | 方法 |
|------|---|---|---|---|---|---|---|---|
| finops | ✅ | ✅ | ✅ | ✅ | ✅ | 14357 | 0 | 14 |
| finops-v2 | ✅ | ✅ | ✅ | ✅ | ✅ | 1824 | 0 | 33 |
| cost-allocation | ✅ | ✅ | ✅ | ✅ | ✅ | 878 | 0 | 14 |
| billing | ✅ | ✅ | ✅ | ✅ | ✅ | 1263 | 0 | 18 |
| efficiency | ✅ | ✅ | ✅ | ✅ | ✅ | 2593 | 0 | 48 |
| capacity | ✅ | ✅ | ✅ | ✅ | ✅ | 1214 | 10 | 61 |
| resilience-score | ✅ | ✅ | ✅ | ✅ | ✅ | 1352 | 0 | 22 |
| data-catalog | ✅ | ✅ | ✅ | ✅ | ✅ | 1446 | 0 | 9 |
| data-quality | ✅ | ✅ | ✅ | ✅ | ✅ | 1914 | 0 | 13 |
| data-pipeline | ✅ | ✅ | ✅ | ✅ | ✅ | 603 | 12 | 12 |
| data-lineage | ✅ | ✅ | ✅ | ✅ | ✅ | 702 | 0 | 10 |
| vector-store | ✅ | ✅ | ✅ | ✅ | ✅ | 308 | 5 | 5 |
| supply-chain | ✅ | ✅ | ✅ | ✅ | ✅ | 804 | 0 | 10 |
| sbom | ✅ | ✅ | ✅ | ✅ | ✅ | 1467 | 0 | 14 |
| vulnerability | ✅ | ✅ | ✅ | ✅ | ✅ | 1216 | 0 | 9 |

---

## 十一、配置 / 低代码 / 插件域 (16 模块)

| 模块 | H | S | R | M | N | 行数 | 路由 | 方法 |
|------|---|---|---|---|---|---|---|---|
| config | ✅ | ✅ | ✅ | ✅ | ✅ | 9517 | 0 | 68 |
| feature-flag | ✅ | ✅ | ✅ | ✅ | ✅ | 1224 | 0 | 13 |
| unified-config | ✅ | ✅ | ✅ | ✅ | ✅ | 309 | 5 | 5 |
| global-param | ✅ | ✅ | ✅ | ✅ | ✅ | 345 | 0 | 5 |
| lowcode | ✅ | ✅ | ✅ | ✅ | ✅ | 1266 | 0 | 14 |
| plugin | ✅ | ✅ | ✅ | ✅ | ✅ | 2748 | 22 | 31 |
| plugin-hotreload | ✅ | ✅ | ✅ | ✅ | ✅ | 291 | 5 | 5 |
| plugin-marketplace | ✅ | ✅ | ✅ | ✅ | ✅ | 957 | 3 | 10 |
| form | ✅ | ✅ | ✅ | ✅ | ✅ | 1798 | 11 | 16 |
| iac | ✅ | ✅ | ✅ | ✅ | ✅ | 1447 | 0 | 19 |
| import-export | ✅ | ✅ | ✅ | ✅ | ✅ | 1958 | 0 | 6 |
| env-lifecycle | ✅ | ✅ | ✅ | ✅ | ✅ | 370 | 0 | 5 |
| env-profile | ✅ | ✅ | ✅ | ✅ | ✅ | 370 | 0 | 5 |
| rule-engine | ✅ | ✅ | ✅ | ✅ | ✅ | 377 | 0 | 8 |
| condition | ✅ | ✅ | ✅ | ✅ | ✅ | 1774 | 0 | 48 |
| workflow | ✅ | ✅ | ✅ | ✅ | ✅ | 5303 | 0 | 0 |

---

## 十二、跨域 / 工具层 (13 模块)

| 模块 | H | S | R | M | N | 行数 | 路由 | 方法 | 说明 |
|------|---|---|---|---|---|---|---|---|---|
| crossover | ✅ | ✅ | — | ✅ | ✅ | 1585 | 0 | 23 | ⚠️ 缺 Repository |
| global-search | ✅ | — | ✅ | ✅ | ✅ | 2046 | 6 | 0 | IndexerRegistry 代替 Service |
| audit | ✅ | ✅ | ✅ | ✅ | ✅ | 1596 | 0 | 12 | |
| compliance | ✅ | ✅ | ✅ | ✅ | ✅ | 790 | 0 | 10 | |
| security-compliance | ✅ | ✅ | ✅ | ✅ | ✅ | 1693 | 0 | 19 | |
| saga | ✅ | ✅ | ✅ | ✅ | ✅ | 1335 | 7 | 59 | Saga 编排层 |
| api-governance | ✅ | ✅ | ✅ | ✅ | ✅ | 1299 | 0 | 15 | |
| statistics | — | — | — | — | — | 630 | 0 | 0 | 孤立工具库 |
| test-selector | ✅ | ✅ | ✅ | ✅ | ✅ | 1791 | 11 | 30 | |
| queue | ✅ | ✅ | ✅ | ✅ | ✅ | 639 | 8 | 8 | |
| lock | — | — | — | — | — | 110 | 0 | 0 | 分布式锁 |
| startup | — | — | — | — | — | 1756 | 0 | 12 | 启动编排 |
| webhook | ✅ | ✅ | ✅ | ✅ | ✅ | 串 | 串 | 串 | |

---

## 十三、架构深度方法统计

### 13.1 Top 10 最深模块 (按方法数)

| 排名 | 模块 | 方法数 | 行数 | 域 |
|------|------|--------|------|------|
| 1 | ticketing | 188 | 13084 | ITSM |
| 2 | ticket | 106 | 7526 | ITSM |
| 3 | config | 68 | 9517 | 配置 |
| 4 | artifact-version | 62 | 1829 | CI/CD |
| 5 | capacity | 61 | 1214 | FinOps |
| 6 | saga | 59 | 1335 | 跨域 |
| 7 | pipeline-engine | 52 | 3148 | CI/CD |
| 8 | efficiency | 48 | 2593 | FinOps |
| 9 | condition | 48 | 1774 | 配置 |
| 10 | monitoring | 37 | 10077 | 可观测 |

### 13.2 Top 10 最大模块 (按行数)

| 排名 | 模块 | 行数 | 方法数 | 说明 |
|------|------|------|--------|------|
| 1 | ci-cd | 21689 | 0 | 大但薄 (编排层) |
| 2 | ai | 20221 | 4 | 大但薄 (AI 聚合) |
| 3 | infrastructure | 14995 | 19 | |
| 4 | finops | 14357 | 14 | |
| 5 | ticketing | 13084 | 188 | 最深模块 |
| 6 | monitoring | 10077 | 37 | |
| 7 | config | 9517 | 68 | |
| 8 | identity | 9132 | 0 | 大但薄 |
| 9 | ticket | 7526 | 106 | |
| 10 | cmdb | 4560 | 30 | |

### 13.3 薄模块警告 (大行数 + 少方法)

| 模块 | 行数 | 方法数 | 建议 |
|------|------|--------|------|
| ci-cd | 21689 | 0 | 排查是否纯配置/编排 |
| ai | 20221 | 4 | 排查是否代码冗余 |
| identity | 9132 | 0 | 排查是否纯模型定义 |
| workflow | 5303 | 0 | 纯工作流定义 |

---

## 十四、NATS 事件驱动架构

### 14.1 事件总线拓扑

```
NATS JetStream (ORION_EVENTS)
  │
  ├── Incident Subscriber
  │   ├── handleIncidentEvent → incidentService
  │   └── consumeMessages → EventHandler
  │
  ├── Self-Healing Subscriber
  │   ├── handleHealthEvent → selfHealingService
  │   └── autoRecovery → diagnosticService
  │
  ├── FinOps Efficiency Subscriber
  │   └── costData → efficiencyService
  │
  ├── FinOps Report Designer Subscriber
  │   └── reportData → reportDesignerService
  │
  ├── Identity User Subscriber
  │   └── userEvents → userService
  │
  ├── Config Subscriber
  │   └── configChange → configService
  │
  ├── Pandawiki Subscriber (×2)
  │   └── knowledgeEvents → knowledgeService
  │
  └── Code Subscriber
      └── codeEvents → codeService
```

### 14.2 事件驱动链路

```
Alert → Dedup → Correlate → Silence → Escalate → Incident (NATS)
  → Change → Pipeline (Saga) → Deploy → Update CMDB
```

---

## 十五、依赖注入拓扑 (wiring.go)

wiring.go (1224 行) 是 Go 模块的依赖注入中心，采用手动 DI 而非 wire 框架。

**注入模式**:
1. `NewHandler(service, logger)` → Handler 依赖 Service
2. `NewService(repository, logger)` → Service 依赖 Repository
3. `NewRepository(db, logger)` → Repository 依赖 DB
4. `RegisterRoutes(rg)` → Handler 注册路由

**注入顺序**: DB → Repository → Service → Handler → Router → Server

### 15.1 wiring.go 实际注册的 Handler 清单 (42 个)

> 以下为 `cmd/server/wiring.go` 中通过 `NewHandler` 显式创建的 Handler 实例。

| 变量名 | Handler 构造函数 | 对应模块 |
|--------|----------------|---------|
| `dataCatalogH` | `dataCatalog_handler.NewHandler` | data-catalog |
| `dataQualityH` | `dataQuality_handler.NewHandler` | data-quality |
| `dataPipelineH` | `dataPipeline_handler.NewHandler` | data-pipeline |
| `userH` | `user_handler.NewHandler` | user |
| `authH` | `auth_handler.NewHandler` | auth |
| `permH` | `perm_handler.NewHandler` | permission |
| `aiDecisionsH` | `aiDecisions_handler.NewHandler` | ai-decision |
| `aiAgentRunH` | `ai_agent_run_handler.NewHandler` | ai-agent-run |
| `pluginMarketplaceH` | `pm_handler.NewHandler` | plugin-marketplace |
| `aiGatewayH` | `aiGateway_handler.NewHandler` | ai-gateway |
| `sandboxH` | `sandbox_handler.NewHandler` | sandbox |
| `loggingH` | `logging_handler.NewHandler` | logging |
| `storageH` | `storage_handler.NewHandler` | storage |
| `message_queueH` | `message_queue_handler.NewHandler` | message-queue |
| `clusterH` | `cluster_handler.NewHandler` | cluster |
| `aiInferenceH` | `aiInference_handler.NewHandler` | ai-inference |
| `networkH` | `network_handler.NewHandler` | network |
| `aiModelsH` | `aiModels_handler.NewHandler` | ai-models |
| `pipelineBudgetH` | `pipeline_budget_handler.NewHandler` | pipeline-budget |
| `pipelineTemplatesH` | `pipeline_templates_handler.NewHandler` | pipeline-templates |
| `pipelineVersionsH` | `pipeline_versions_handler.NewHandler` | pipeline-versions |
| `resilienceScoreH` | `resilience_score_handler.NewHandler` | resilience-score |
| `sbomH` | `sbom_handler.NewHandler` | sbom |
| `ciArtRegH` | `ciArtReg_handler.NewArtifactRegistryHandler` | artifact-version |
| `ciArtVerH` | `ciArtVer_handler.NewArtifactVersionHandler` | artifact-version |
| `ciBuildH` | `ciBuild_handler.New` | build |
| `ciCanaryH` | `ciCanary_handler.NewHandler` | canary-analysis |
| `ciDeployH` | `ciDeploy_handler.New` | deploy |
| `ciPipelineH` | `ciPipeline_handler.NewHandler` | pipeline |
| `ciPTmplH` | `ciPTmpl_handler.NewHandler` | pipeline-templates |
| `ciRunnerH` | `ciRunner_handler.NewHandler` | runner |
| `infraDrH` | `infraDr_handler.NewHandler` | disaster-recovery |
| `infraEEH` | `infraEE_handler.NewHandler` | ephemeral-env |
| `infraBackupH` | `infraBackup_handler.New` | backup |
| `infraChaosH` | `infraChaos_handler.NewHandler` | chaos |
| `infraDbaH` | `infraDba_handler.NewHandler` | dba |
| `infraDegH` | `infraDegradation_handler.NewHandler` | degradation |
| `infraDTwinH` | `infraDTwin_handler.NewHandler` | digital-twin |
| `infraIacH` | `infraIac_handler.NewHandler` | iac |
| `infraMWnH` | `infraMWn_handler.NewHandler` | maintenance-window |
| `infraMultiH` | `infraMulti_handler.NewHandler` | multi-cloud |
| `infraOCIH` | `infraOCI_handler.NewHandler` | oci-registry |
| `infraServerlessH` | `infraServerless_handler.NewHandler` | serverless |

> 注: 另有 **221 个模块**虽然实现 `RegisterRoutes` 但未在 wiring.go 显式注册，通过 `handler/` 目录自行注册路由。

---

## 十六、统一架构健康度评分

### 16.1 评分体系说明

> 三份文档 (ARCH_FRONTEND / ARCH_BACKEND / ARCH_MAPPING) 使用同一评分框架:
> - **后端架构分层**: Handler→Service→Repository 三层覆盖率 + 方法深度
> - **前端交互完整性**: 页面功能深度 + 权限/状态/空状态覆盖
> - **前后端映射完整度**: REST API 映射覆盖率 + 实时通信完整性
> - **综合 = (后端 + 前端 + 映射) / 3**

### 16.2 评分矩阵

| 维度 | 评分 | 说明 | 来源文档 |
|------|------|------|---------|
| **后端架构分层** | 9.5/10 | 263/265 模块有 Service 层 (99.2%) | ARCH_BACKEND |
|  ITSM 后端深度 | 9.5/10 | ticketing 188 方法, 完整 ITIL v4 95% | 三域分析 |
|  CI/CD 后端深度 | 9.5/10 | DAG/Kahn/Saga, 58 部署方法, 62 制品方法 | 三域分析 |
|  CMDB 后端深度 | 9.0/10 | AdapterFactory, BFS, 30 方法, 缺漂移检测 | 三域分析 |
|  可观测性 | 8.0/10 | Metrics✅ + Traces✅ + 缺 Log 支柱 | 评审报告 |
|  AI/ChatOps | 8.0/10 | chatops 84 方法, prompt-security 薄 | 评审报告 |
|  FinOps | 9.0/10 | 成本追踪/预算/分摊/Chargeback 全覆盖 | 评审报告 |
|  安全与合规 | 8.5/10 | SOC2/ISO27001 + SBOM + 漏洞扫描 | 评审报告 |
|  事件驱动 | 8.0/10 | NATS 9+ 订阅者, 链路完整 | ARCH_BACKEND |
| **前端交互完整性** | 7.0/10 | 217 页面覆盖全, 权限校验 2.8% 是最大缺口 | ARCH_FRONTEND |
|  页面覆盖 | 9.5/10 | 217 页面覆盖 9 大域 | ARCH_FRONTEND |
|  权限校验 | 3.0/10 | 仅 6/217 页面有权限守卫 | ARCH_FRONTEND |
|  交互链完整度 | 7.0/10 | 部分页面缺 loading/空状态/错误处理 | ARCH_FRONTEND |
| **前后端映射完整度** | 7.5/10 | 196/315 路由已映射 | ARCH_MAPPING |
|  REST 映射 | 8.0/10 | 60+ 前端 API 已映射到后端 Handler | ARCH_MAPPING |
|  SSE 实时日志 | 9.0/10 | Pipeline 完整, 其他域未覆盖 | ARCH_MAPPING |
|  WebSocket 终端 | 8.0/10 | Visor 完整, 通用性待扩展 | ARCH_MAPPING |
|  认证流程 | 9.0/10 | Token 刷新 + 队列机制完整 | ARCH_MAPPING |
| **综合** | **8.0/10** | **(9.5 + 7.0 + 7.5) / 3** | |

| 维度 | 评分 | 说明 |
|------|------|------|
| ITSM 后端深度 | 9.5/10 | ticketing 188 方法, 完整 ITIL v4 95% |
| CI/CD 后端深度 | 9.5/10 | DAG/Kahn/Saga, 58 部署方法, 62 制品方法 |
| CMDB 后端深度 | 9.0/10 | AdapterFactory, BFS, 30 方法, 缺漂移检测 |
| 可观测性 | 8.0/10 | Metrics✅ + Traces✅ + 缺 Log 支柱 |
| AI/ChatOps | 8.0/10 | chatops 84 方法, prompt-security 薄 |
| FinOps | 9.0/10 | 成本追踪/预算/分摊/Chargeback 全覆盖 |
| 安全与合规 | 8.5/10 | SOC2/ISO27001 + SBOM + 漏洞扫描 |
| 跨域工具 | 7.0/10 | crossover 缺 Repo, global-search 非标准 |
| 事件驱动 | 8.0/10 | NATS 9+ 订阅者, 链路完整 |
| 代码质量 | 8.0/10 | 3 层架构 99.2%, 薄模块待优化 |
| **综合** | **8.3/10** | |

---

## 十七、已知薄弱点

| 薄弱点 | 域 | 严重度 | 说明 |
|--------|------|--------|------|
| alert-deduplication 缺 Repository | 通知 | P0 | 纯内存去重, 重启丢失 |
| prompt-security 缺 Repository | AI | P0 | 纯内存策略, 重启丢失 |
| crossover 缺 Repository+Handler | 跨域 | P1 | 接口已定义, 无实现, 未 wired |
| sla-engine 24 方法 | ITSM | P1 | 方法已实现，界面待增强 |
| pipeline-run-history 1 方法 | CI/CD | P1 | 审计/重试薄弱 |
| Log 支柱缺失 | 可观测 | P1 | 无独立日志管理模块 |
| frontend 权限守卫 2.8% | 跨域 | P0 | 敏感页面缺权限 |

---

## 十八、执行路线图

| Phase | 任务 | 工作量 |
|-------|------|--------|
| P0-1 | 前端敏感页面权限守卫 | 1-2 天 |
| P0-2 | Log 支柱缺失 | 2-3 天 |
| P0-3 | prompt-security 补 Repo | 0.5 天 |
| P0-4 | alert-deduplication 补 Repo | 0.5 天 |
| P1-1 | crossover Repository 补全 | 1-2 天 |
| P1-2 | ticketing handler 核心拆分 | 2-3 天 |
| P1-3 | chaos 三模块合并 | 3-5 天 |
| P1-4 | sla-engine 界面增强 | 1-2 天 |
| P1-5 | pipeline-run-history 增强 | 1-2 天 |
| P1-6 | 前端 API 路径统一 (137 文件硬编码) | 2-3 天 |
| P1-7 | AI 模块命名统一 (9 ai-xxx + 9 ai/xxx 并存) | 2 天 |
| P1-8 | 后端响应格式统一 (436 gin.H → Respond*) | 5-8 天 |
| P1-9 | 三域补全 (Trigger/Release/Drift/SLA引擎) | 10-15 天 |
| P2-1~11 | 技术债务清理 | 14.5-24 天 |
| **总计** | | **27-44 天** |

---

> 数据来源: Go 286 模块逐模块扫描 + CodeGraph 图分析 + 源码级验证
> 关联文档:
> - `docs/ARCH_FRONTEND.md` — 前端功能架构 (217 页面, 194 API 文件)
> - `docs/ARCH_MAPPING.md` — 前后端交互映射 (REST/SSE/WS/NATS)
> - `docs/ALL_TODOS.md` — 统一待办清单 (P0 4 项, P1 9 项, P2 11 项)
> - `docs/architecture-review-2026-08-01.md` — 主统一报告 (1088 行, 9 章)
> - `docs/three-domain-depth-analysis-2026-08-01.md` — 三域专家深度分析