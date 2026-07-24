# Orion 系统架构模块拆分方案

> 视角: 架构师
> 生成日期: 2026-05-11
> 拆分原则: DDD 领域驱动 + 微服务自治 + 渐进式演进

---

## 一、当前架构问题诊断

### 1.1 核心痛点

```
┌─────────────────────────────────────────────────────────────────┐
│                    orion-platform-service                        │
│                                                                 │
│  70+ 服务  │  900+ 行路由  │  100+ 文件  │  90 次 DB 迁移        │
│                                                                 │
│  Pipeline  │  Ticketing  │  AI  │  Self-Healing  │  Monitoring  │
│  Deploy    │  Approval   │  MCP │  OnCall         │  Community   │
│  SCM       │  ChatOps    │  SBOM│  OPA            │  Multi-Cloud │
│  Config    │  Webhook    │  Cron│  Vector DB      │  Agent       │
│  Tenant    │  Project    │  ... 还有 40+ 领域 ...              │
└─────────────────────────────────────────────────────────────────┘
         ↑ 单进程承载所有业务领域，无法独立扩展
```

### 1.2 问题清单

| # | 问题 | 严重性 | 影响 |
|---|------|--------|------|
| P1 | platform-service 单体膨胀 | 🔴 | 无法独立扩展、部署慢、故障影响全量 |
| P2 | 认证逻辑重复 3 处 | 🔴 | 安全策略不一致，改一处需改三处 |
| P3 | AI 能力双重重叠 | ⚠️ | platform-service 和 ai-service 职责不清 |
| P4 | 数据库无版本管理 | ⚠️ | 迁移回滚困难，多模块共享 schema |
| P5 | 外部项目版本未锁定 | ⚠️ | Yearning/PandaWiki/Visor 升级风险 |
| P6 | 事件总线无持久化 | ⚠️ | 事件丢失无法恢复 |
| P7 | 无统一错误码 | 💡 | 跨模块错误格式不一致 |

---

## 二、目标架构设计

### 2.1 拆分原则

| 原则 | 说明 |
|------|------|
| **领域自治** | 每个微服务对应一个 DDD 限界上下文，独立数据库 |
| **API 聚合** | Gateway 按领域聚合，路由到对应服务 |
| **共享基础** | 认证、配置、事件总线作为基础设施层 |
| **渐进演进** | 按依赖关系分阶段拆分，不破坏现有功能 |
| **技术栈统一** | 同领域保持技术栈一致，降低运维复杂度 |

### 2.2 目标架构图

```
                    ┌──────────────────────────────┐
                    │    orion-api-gateway         │
                    │  (API 聚合 + 认证 + 限流)     │
                    └──────────┬───────────────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
    ┌─────────▼─────┐ ┌───────▼──────┐ ┌───────▼───────┐
    │ Pipeline      │ │  Ticketing   │ │  Intelligence │
    │ Service       │ │  Service     │ │  Service (AI) │
    │ CI/CD 引擎    │ │ ITSM 工单    │ │ AI 能力层     │
    └───────────────┘ └──────────────┘ └───────────────┘
              │                │                │
    ┌─────────▼─────┐ ┌───────▼──────┐ ┌───────▼───────┐
    │ Deploy        │ │  Monitoring  │ │  Knowledge    │
    │ Service       │ │  Service     │ │  Service (RAG)│
    │ 部署管理      │ │ 监控自愈     │ │ 知识库        │
    └───────────────┘ └──────────────┘ └───────────────┘
              │                │
    ┌─────────▼─────┐ ┌───────▼──────┐
    │ Agent         │ │  Platform    │
    │ Service       │ │  Core        │
    │ Runner 管理   │ │ 租户/项目/配置│
    └───────────────┘ └──────────────┘

              ┌──────────────────────┐
              │   基础设施层          │
              │  Auth │ Config │ EventBus │
              └──────────────────────┘
```

---

## 三、模块拆分详细方案

### 3.1 拆分后模块清单

| # | 模块名称 | 对应现有 | 职责 | 技术栈 | 优先级 |
|---|---------|---------|------|--------|--------|
| 1 | **orion-gateway** | orion-api-gateway | API 聚合、认证、限流、路由 | Fastify/Node.js | P0 (保持不变) |
| 2 | **orion-pipeline-svc** | platform-service 子集 | CI/CD Pipeline 引擎 | Fastify/Node.js | P1 |
| 3 | **orion-deploy-svc** | platform-service 子集 | 部署管理、环境管理 | Fastify/Node.js | P1 |
| 4 | **orion-ticket-svc** | platform-service 子集 | ITSM 工单、派单、SLA | Fastify/Node.js | P1 |
| 5 | **orion-monitor-svc** | platform-service 子集 | 监控、自愈、告警 | Fastify/Node.js | P1 |
| 6 | **orion-intelligence-svc** | orion-ai-service + platform-service AI 部分 | AI 分类、根因分析、LLM | Python/FastAPI | P2 |
| 7 | **orion-knowledge-svc** | orion-knowledge | 知识库、RAG 问答 | Go + Python RAG | P2 |
| 8 | **orion-agent-svc** | orion-runner-agent | Runner 管理、任务执行 | Fastify/Node.js | P2 |
| 9 | **orion-platform-core** | platform-service 剩余 | 租户、项目、配置、权限 | Fastify/Node.js | P3 |
| 10 | **orion-visor** | orion-visor | 运维可视化 (外部项目) | Java/Spring Boot | 保持独立 |
| 11 | **orion-dba-plugin** | orion-dba | SQL 审核插件 (外部项目) | Go | 保持独立 |

---

### 3.2 各模块详细拆分方案

#### 模块 1: orion-gateway (保持不变)

**当前状态**: 已独立，架构合理

**调整内容**:
- 统一认证逻辑，从 3 处收敛到 1 处
- 添加服务发现，动态路由到拆分后的微服务
- 添加请求聚合（跨服务查询时聚合多个服务结果）

**依赖变化**:
```
当前: gateway → platform-service
未来: gateway → [pipeline, deploy, ticket, monitor, platform-core, ...]
```

---

#### 模块 2: orion-pipeline-svc (P1 优先拆分)

**从 platform-service 提取的内容**:

| 文件/目录 | 说明 |
|-----------|------|
| `src/engine/PipelineEngine.ts` | Pipeline 执行引擎 |
| `src/engine/StageExecutor.ts` | 阶段执行器 |
| `src/engine/TaskRunner.ts` | 任务运行器 |
| `src/services/pipeline/` | Pipeline 相关服务 (~20 文件) |
| `src/services/build/` | 构建环境服务 |
| `src/services/scm/` | 代码仓库集成 |
| `src/services/webhook/` | Webhook 通知 |
| `src/services/scm-trigger/` | SCM 触发器 |
| `src/db/migrations/` 中 Pipeline 相关迁移 | 001, 002, 005, 008, 015, 022, 030, 035, 040, 048, 055 |

**独立数据库表**:
- pipelines, pipeline_runs, pipeline_stages, stage_runs
- pipeline_tasks, task_runs, builds, build_environments
- scm_integrations, scm_triggers, webhooks

**对外 API**:
```
POST   /api/v1/pipelines          创建 Pipeline
GET    /api/v1/pipelines          列表 Pipeline
GET    /api/v1/pipelines/:id      获取详情
POST   /api/v1/pipelines/:id/run  运行 Pipeline
GET    /api/v1/pipelines/:id/runs/:rid/logs  SSE 日志
POST   /api/v1/pipelines/:id/runs/:rid/cancel 取消运行
```

**依赖**:
- orion-platform-core (租户、项目)
- orion-agent-svc (任务执行)
- orion-gateway (API 入口)

---

#### 模块 3: orion-deploy-svc (P1 优先拆分)

**从 platform-service 提取的内容**:

| 文件/目录 | 说明 |
|-----------|------|
| `src/services/deploy/` | 部署服务 (~15 文件) |
| `src/services/environment/` | 环境管理 |
| `src/services/config/` | 配置管理 (GitOps) |
| `src/services/ml-canary/` | ML 金丝雀分析 |
| `src/db/migrations/` 中 Deploy 相关迁移 | 012, 018, 025, 033, 042, 050 |

**独立数据库表**:
- deployments, deployment_environments, deployment_configs
- canary_analyses, rollout_strategies

**对外 API**:
```
POST   /api/v1/deployments          创建部署
GET    /api/v1/deployments          列表部署
GET    /api/v1/deployments/:id      获取详情
POST   /api/v1/deployments/:id/rollback 回滚
GET    /api/v1/environments         列表环境
POST   /api/v1/environments/:id/config 更新配置
```

**依赖**:
- orion-pipeline-svc (Pipeline 触发部署)
- orion-monitor-svc (部署后监控)
- orion-platform-core (租户、项目)

---

#### 模块 4: orion-ticket-svc (P1 优先拆分)

**从 platform-service 提取的内容**:

| 文件/目录 | 说明 |
|-----------|------|
| `src/services/ticketing/` | 工单服务 (12 文件, ~5800 行) |
| `src/api/ticketing-routes.ts` | 工单路由 (1884 行) |
| `src/api/controllers/ticketing/` | 工单控制器 |
| `src/mcp/tools/ticket-tools.ts` | MCP 工单工具 |
| `src/db/migrations/` 中 Ticketing 相关迁移 | 011, 038, 061 |

**独立数据库表**:
- tickets, ticket_workflow_history, ticket_sla
- dispatch_queue, engineer_load, ticket_assignments
- ticket_relations, dispatch_rules, ticket_transfers
- engineer_suspensions

**对外 API** (按领域拆分为 4 个子路由):
```
# 工单管理
POST   /api/v1/tickets              创建工单
GET    /api/v1/tickets              列表工单
GET    /api/v1/tickets/:id          获取详情
POST   /api/v1/tickets/:id/transition 状态流转
POST   /api/v1/tickets/:id/assign   分配工单
POST   /api/v1/tickets/:id/resolve  解决工单
POST   /api/v1/tickets/:id/close    关闭工单

# 智能派单
POST   /api/v1/tickets/dispatch/auto/:id    自动派单
GET    /api/v1/tickets/dispatch/best-match/:id 最佳匹配
GET    /api/v1/tickets/dispatch/engineers   工程师列表

# SLA 管理
POST   /api/v1/ticketing/sla        设置 SLA
GET    /api/v1/tickets/reports/sla  SLA 合规报告

# BI 分析
GET    /api/v1/tickets/bi/dashboard/executive  高管看板
GET    /api/v1/tickets/bi/dashboard/manager    经理看板
GET    /api/v1/tickets/bi/efficiency/:id       效率分析
```

**依赖**:
- orion-monitor-svc (告警转工单)
- orion-intelligence-svc (AI 分类、根因分析)
- orion-knowledge-svc (知识库推荐)
- orion-platform-core (租户、用户)

---

#### 模块 5: orion-monitor-svc (P1 优先拆分)

**从 platform-service 提取的内容**:

| 文件/目录 | 说明 |
|-----------|------|
| `src/services/monitoring/` | 监控服务 |
| `src/services/alerting/` | 告警服务 |
| `src/services/self-healing/` | 自愈引擎 |
| `src/services/oncall/` | OnCall 排班 |
| `src/db/migrations/` 中 Monitor 相关迁移 | 009, 016, 023, 031, 039, 047 |

**独立数据库表**:
- monitoring_rules, alerts, alert_history
- self_healing_policies, self_healing_actions, self_healing_runs
- oncall_schedules, oncall_shifts, oncall_escalations

**对外 API**:
```
# 监控
POST   /api/v1/monitoring/rules     创建监控规则
GET    /api/v1/monitoring/rules     列表规则
POST   /api/v1/alerts/subscribe     订阅告警

# 自愈
POST   /api/v1/self-healing/policies  创建自愈策略
GET    /api/v1/self-healing/runs      自愈执行记录

# OnCall
POST   /api/v1/oncall/schedules       创建排班
GET    /api/v1/oncall/schedules       列表排班
GET    /api/v1/oncall/current         当前值班人
```

**依赖**:
- orion-ticket-svc (告警转工单)
- orion-platform-core (租户、项目)

---

#### 模块 6: orion-intelligence-svc (P2 AI 统一)

**整合来源**: orion-ai-service (placeholder) + platform-service 中 AI 增强部分

**职责**:
- AI 工单分类 (替代关键词匹配)
- AI Code Review
- Pipeline 智能分析
- 根因分析 (服务拓扑 + 事件时间线)
- 解决方案推荐 (RAG)
- 工单摘要生成
- 情感分析
- SLA 预测性预警

**技术栈**: Python/FastAPI + LLM SDK + ClickHouse (分析数据)

**对外 API**:
```
POST   /api/v1/ai/classify          工单分类
POST   /api/v1/ai/code-review       代码审查
POST   /api/v1/ai/root-cause        根因分析
POST   /api/v1/ai/suggest-solution  解决方案推荐
POST   /api/v1/ai/summarize         工单摘要
POST   /api/v1/ai/sentiment         情感分析
POST   /api/v1/ai/predict-sla       SLA 预测
```

**依赖**:
- 外部 LLM API
- orion-knowledge-svc (RAG 知识库)
- ClickHouse (分析数据存储)

---

#### 模块 7: orion-knowledge-svc (P2 独立)

**当前状态**: 本质上是 PandaWiki git submodule

**调整内容**:
- 实现与 Orion 主系统的 SSO 集成
- 添加 RAG 接口供 orion-intelligence-svc 调用
- 实现工单创建时自动知识推荐

**对外 API**:
```
GET    /api/v1/knowledge/search     搜索知识
GET    /api/v1/knowledge/:id/relevant  相关知识
POST   /api/v1/knowledge/embed     嵌入向量生成
```

---

#### 模块 8: orion-agent-svc (P2 独立)

**从独立模块升级为正式服务**:

**当前问题**: 无 Dockerfile、无测试、无健康检查

**调整内容**:
- 添加 Dockerfile
- 添加健康检查端点
- 添加 graceful shutdown
- 实现沙箱隔离 (Docker-in-Docker 或 gVisor)
- 添加 Runner 弹性扩缩容

**对外 API**:
```
POST   /api/v1/agents/register      注册 Runner
POST   /api/v1/agents/:id/heartbeat 心跳
POST   /api/v1/agents/:id/tasks     接收任务
GET    /api/v1/agents/:id/tasks/:tid/logs  任务日志
```

---

#### 模块 9: orion-platform-core (P3 最后拆分)

**platform-service 拆分后剩余的核心功能**:

| 文件/目录 | 说明 |
|-----------|------|
| `src/services/tenant/` | 多租户管理 |
| `src/services/project/` | 项目管理 |
| `src/services/rbac/` | RBAC 权限 |
| `src/services/abac/` | ABAC 属性权限 |
| `src/services/config/` (全局配置) | 系统配置 |
| `src/services/api-key/` | API Key 管理 |
| `src/services/community/` | 社区生态 |
| `src/db/migrations/` 中 Core 相关迁移 | 003, 007, 014, 020, 028, 036, 044 |

**职责**: 作为系统的"底座"，提供租户、项目、权限、配置等基础能力

**对外 API**:
```
POST   /api/v1/tenants              创建租户
GET    /api/v1/tenants              列表租户
POST   /api/v1/tenants/:id/projects  创建项目
GET    /api/v1/roles                角色列表
POST   /api/v1/roles/:id/permissions 设置权限
GET    /api/v1/api-keys             API Key 列表
```

---

## 四、拆分优先级与阶段规划

### 第一阶段: 基础拆分 (P1) — 解决单体膨胀

| 步骤 | 拆分内容 | 预计工作量 | 风险 |
|------|---------|-----------|------|
| 1.1 | 提取 orion-ticket-svc | 2 周 | 低 (已模块化) |
| 1.2 | 提取 orion-pipeline-svc | 3 周 | 中 (核心引擎) |
| 1.3 | 提取 orion-monitor-svc | 2 周 | 低 (独立服务) |
| 1.4 | 提取 orion-deploy-svc | 2 周 | 低 (独立服务) |

### 第二阶段: AI 统一 (P2) — 解决 AI 能力重叠

| 步骤 | 拆分内容 | 预计工作量 | 风险 |
|------|---------|-----------|------|
| 2.1 | 合并 AI 能力到 orion-intelligence-svc | 3 周 | 中 (需实现 AI) |
| 2.2 | orion-knowledge-svc 独立集成 | 1 周 | 低 |
| 2.3 | orion-agent-svc 正式化 | 2 周 | 低 |

### 第三阶段: 核心收敛 (P3) — 剩余拆分

| 步骤 | 拆分内容 | 预计工作量 | 风险 |
|------|---------|-----------|------|
| 3.1 | platform-service 拆分为 orion-platform-core | 2 周 | 低 |
| 3.2 | Gateway 服务发现改造 | 1 周 | 中 |
| 3.3 | 统一认证收敛 | 1 周 | 低 |

**总预计工作量: 19 周 (约 4.5 个月)**

---

## 五、横切关注点处理

### 5.1 认证统一

**当前**: 3 处实现 (gateway JWT, platform-service RBAC, frontend Token)

**目标**:
```
┌──────────────┐
│  orion-auth   │  ← 新增统一认证服务 (可选，或使用 gateway 内置)
│  (JWT 签发)   │
└──────┬───────┘
       │ JWT 验证
┌──────▼───────┐
│  orion-gateway│  ← 统一 JWT 验证 + 权限检查
└──────┬───────┘
       │ 传递 user/tenant context
┌──────▼───────┐
│  各微服务     │  ← 仅读取 context，不重复验证
└──────────────┘
```

### 5.2 数据库隔离

| 模块 | 数据库 | 共享? |
|------|--------|-------|
| orion-pipeline-svc | pipeline_db | 否 |
| orion-deploy-svc | deploy_db | 否 |
| orion-ticket-svc | ticket_db | 否 |
| orion-monitor-svc | monitor_db | 否 |
| orion-intelligence-svc | intelligence_db + ClickHouse | 否 |
| orion-platform-core | platform_db | 是 (租户信息) |

### 5.3 事件总线

```
各微服务 ──publish──▶ NATS JetStream ──subscribe──▶ 消费者服务

主题设计:
orion.pipeline.run.created
orion.ticket.created
orion.alert.triggered
orion.deploy.completed
orion.selfhealing.executed
```

### 5.4 配置管理

- **开发环境**: 各服务独立 `.env` 文件
- **生产环境**: 统一配置中心 (Consul 或 etcd)
- **敏感配置**: Vault 管理

---

## 六、拆分技术约束

### 6.1 保持不变

| 约束 | 说明 |
|------|------|
| 技术栈 | 业务服务保持 Fastify/Node.js，AI 服务保持 Python |
| 通信协议 | 服务间通过 NATS 事件 + HTTP REST API |
| 数据库 | PostgreSQL 为主，ClickHouse 为分析存储 |
| 部署方式 | Docker Compose (开发) → Kubernetes (生产) |

### 6.2 需要改变

| 约束 | 当前 | 目标 |
|------|------|------|
| 数据库共享 | 所有服务共享 postgres | 每服务独立数据库 |
| 进程模型 | 单进程 70+ 服务 | 每服务独立进程 |
| 错误码 | 各模块独立 | 统一错误码枚举 |
| 日志 | 各模块独立 | 统一日志格式，集中收集 |
| 监控 | 无 | Prometheus + Grafana |

---

## 七、风险评估与缓解

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| 拆分期间功能回归 | 中 | 高 | 每个拆分步骤后立即运行完整测试套件 |
| 数据库迁移丢失数据 | 低 | 高 | 拆分前全量备份，每步迁移验证 |
| 服务间调用延迟增加 | 中 | 中 | 添加请求超时和重试机制 |
| 团队学习曲线 | 中 | 中 | 拆分期间保持技术栈不变 |
| 外部项目兼容 | 低 | 中 | 版本锁定 + 集成测试 |

---

## 八、拆分后架构指标

| 指标 | 拆分前 | 拆分后 |
|------|--------|--------|
| 单进程服务数 | 70+ | 5-10/服务 |
| 最大文件数/模块 | 2500+ | 200-500 |
| 独立部署能力 | 无 | 9 个服务可独立部署 |
| 扩展粒度 | 全量扩展 | 按领域扩展 |
| 故障影响范围 | 全量 | 单服务隔离 |
| 开发团队并行度 | 低 (锁冲突) | 高 (领域自治) |
