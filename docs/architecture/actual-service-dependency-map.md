# Orion 实际服务依赖图

**生成日期**: 2026-07-02
**数据来源**: `orion-platform-service/src/services/` 全量 import 分析 + Gateway 路由配置
**注意**: 本文档描述的是**当前实际代码中的依赖关系**，与 `架构重构设计.md` 的目标设计不同。

---

## 一、核心热点模块（PageRank Top 10）

| 排名 | 模块 | 被依赖次数 | 主要依赖方 | 耦合风险 |
|------|------|-----------|-----------|---------|
| 1 | **Pipeline** | 10+ | Artifact, Deploy, Notification, SCM, Approval, Quality, Cache, Secrets, Skill, EventBus | 🔴 高 |
| 2 | **Auth/User/Role** | 10+ | 几乎所有模块（JWT 认证、权限检查、租户上下文） | 🔴 高 |
| 3 | **EventBus** | 9+ | Pipeline, Code, Deploy, Config, Incident, SelfHealing, ChatOps | 🟡 中 |
| 4 | **Approval** | 6+ | Pipeline, Deploy, Emergency, Lowcode, ChatOps, Config | 🟡 中 |
| 5 | **Notification** | 5+ | Approval, Monitoring, Pipeline, ChatOps, SelfHealing | 🟢 低 |
| 6 | **CMDB** | 4+ | Monitoring, Pipeline, K8s, Integration | 🟢 低 |
| 7 | **Tenant** | 4+ | 所有多租户模块 | 🟡 中 |
| 8 | **Config** | 4+ | Pipeline, Deploy, Plugin, FeatureFlag | 🟢 低 |
| 9 | **Code** | 3+ | Pipeline, Approval, ChatOps | 🟢 低 |
| 10 | **Deploy** | 3+ | Pipeline, Approval, Notification | 🟢 低 |

---

## 二、关键同步调用依赖链

### 2.1 高耦合依赖（直接 import）

```typescript
// Pipeline → 多模块直接依赖（10+）
services/pipeline/PipelineService.ts
  ├── import { ArtifactService } from '../artifact/ArtifactService'
  ├── import { DeployService } from '../deploy/DeployService'
  ├── import { NotificationService } from '../notification/NotificationService'
  ├── import { CodeService } from '../code-repo/CodeService'
  ├── import { ApprovalService } from '../approval/ApprovalService'
  └── import { EventBusService } from '../event-bus/EventBusService'

// Auth → 几乎所有模块
services/auth/AuthService.ts
  ├── import { UserService } from '../user/UserService'
  ├── import { RoleService } from '../role/RoleService'
  └── import { TenantService } from '../tenant/TenantService'

// Approval → 多模块直接依赖
services/approval/ApproverResolver.ts
  ├── import { UserRepository } from '../user/UserRepository'
  ├── import { CapabilityRepository } from '../capability/CapabilityRepository'
  └── import { PipelineService } from '../pipeline/PipelineService'

// AuthZ → 权限引擎（多向依赖）
services/authz/AuthorizationEngine.ts
  ├── import { RoleService } from '../role/RoleService'
  ├── import { TeamService } from '../team/TeamService'
  ├── import { CapabilityService } from '../capability/CapabilityService'
  └── import { PipelineRBACService } from '../pipeline/PipelineRBACService'
```

### 2.2 循环依赖

| 循环链路 | 代码路径 | 严重度 |
|---------|---------|--------|
| ConfigChangeService ↔ ConfigService | `services/config-mgmt/ConfigChangeService.ts:15-16` | 🟡 中 |
| PipelineService ↔ ApprovalService | `services/pipeline/PipelineService.ts` ↔ `services/approval/ApprovalService.ts` | 🟡 中 |

---

## 三、事件驱动依赖

### 3.1 当前有效的事件通信

| 发布者 | 主题 | 消费者 | 状态 |
|--------|------|--------|------|
| PipelineEventPublisher | `pipeline.run.completed` | PipelineEventListener, ChatOps | ⚠️ 命名不一致 |
| PipelineEventPublisher | `pipeline.run.created` | — | ⚠️ 无消费者（命名不一致） |
| CodeEventPublisher | `code.pr.opened` | ChatOps, Approval | ✅ |
| DeploymentEventPublisher | `deploy.completed` | Notification, ChatOps | ✅ |
| IncidentEventPublisher | `incident.created` | SelfHealing, ChatOps | ✅ |

### 3.2 事件命名不一致（P0 问题）

```typescript
// 发布时：无 orion. 前缀
PipelineEventPublisher.ts:68:
  this.adapter.publish('pipeline.run.created', {...})

// 订阅时：有 orion. 前缀
PipelineEventListener.ts:44:
  const unsub = await this.eventBus.subscribe('orion.pipeline.run.created', handler, {...})

// EventTypes.ts 定义了 toSubject() 统一加 orion. 前缀，但发布时未使用
```

**影响**: `pipeline.run.created` 事件发布后，`orion.pipeline.run.created` 的订阅者无法收到消息。

---

## 四、内存状态耦合（最高风险）

### 4.1 Saga 内存状态

```typescript
// PipelineSaga.ts — 进程级内存 Map
const pipelineRuns = new Map<string, PipelineRun>();     // 行 87
const stagesByRun = new Map<string, Stage[]>();           // 行 88
const tasksByStage = new Map<string, Task[]>();           // 行 89

// DeploySaga.ts — 进程级内存 Map
const deployments = new Map<string, {...}>();             // 行 120
```

**风险**: 进程重启 → 所有 Saga 状态丢失 → Pipeline/Deploy 运行中断

### 4.2 其他内存 Map

| 服务 | 内存 Map | 用途 | 风险 |
|------|---------|------|------|
| Notification | `notificationSettings` | 用户通知设置 | 进程重启丢失 |
| ChatOps | `commandHistory` | 命令历史 | 进程重启丢失 |
| Cache | `cacheEntries` | 缓存条目 | 进程重启丢失 |

---

## 五、God Module 分析

### 5.1 被依赖最多的模块

| 模块 | 被直接 import 次数 | 风险等级 | 建议 |
|------|-------------------|---------|------|
| `services/auth/AuthService` | 10+ | 🔴 高 | 提取为独立服务或共享库 |
| `services/event-bus/EventBusService` | 9+ | 🟡 中 | 保持现状，已有 fallback |
| `services/pipeline/PipelineService` | 10+ | 🔴 高 | 通过事件解耦 |
| `services/approval/ApprovalService` | 6+ | 🟡 中 | 通过事件解耦 |
| `services/tenant/TenantService` | 4+ | 🟡 中 | 保持现状 |

---

## 六、独立部署就绪度

### 6.1 已独立部署的服务（Gateway 有独立路由）

| 服务 | 端口 | 技术栈 | 独立部署状态 |
|------|------|--------|------------|
| Pipeline | 3002 | Go | ✅ 已部署 |
| Deploy | 3003 | Go | ✅ 已部署 |
| Ticket | 3004 | Go | ✅ 已部署 |
| Monitor | 3005 | Go | ✅ 已部署 |
| Intelligence | 3006 | Go | ✅ 已部署 |
| Platform | 3001 | Node.js | ✅ 已部署（单体核心） |
| CMDB | 3030 | Go | ✅ 已部署 |
| Knowledge | 8002 | Python | ✅ 已部署 |

### 6.2 配置就绪但未启动的服务

| 服务 | 端口 | 技术栈 | 当前路由目标 |
|------|------|--------|------------|
| Agent | 3007 | Go | localhost:3007 |
| Digital-Twin | 3008 | Go | localhost:3008 |
| FinOps | 3009 | Go | localhost:3009 |
| Code | 3010 | Go | localhost:3010 |
| Plugin | 3011 | Go | localhost:3011 |
| AI | 3012 → 8000 | **Python** | Python 服务 |
| Security | 3013 | Go | localhost:3013 |
| Artifact | 3014 | Go | localhost:3014 |

### 6.3 路由到平台服务的服务

| 服务 | 端口 | 技术栈 | 实际路由目标 |
|------|------|--------|------------|
| Notify | 3019 | Go | **localhost:3001** |
| ChatOps | 3027 | Go | **localhost:3001** |

---

## 七、解耦改进路线图

| 阶段 | 改进项 | 预期效果 |
|------|--------|---------|
| Phase 1 | 修复事件命名不一致 | Pipeline 事件正常通信 |
| Phase 1 | Saga 状态持久化 | 消除进程重启数据丢失 |
| Phase 2 | 补充 tenant_id | 多租户隔离完整 |
| Phase 2 | 统一 fallback 策略 | 事件发布可靠性提升 |
| Phase 3 | 打破同步调用环 | Approval → User/Capability 改为事件 |
| Phase 4 | 微服务化拆分 | 单体 → 独立服务 |
| Phase 5 | 事件 Schema 注册 | 强制事件格式校验 |

---

## 八、基础设施依赖层

### 8.1 数据存储

| 基础设施 | 类型 | 用途 | 当前状态 | 风险 |
|---------|------|------|---------|------|
| **PostgreSQL** | 关系数据库 | 统一元数据存储（70+ 表） | ✅ 已部署（16） | 单点风险 |
| **Redis** | KV 缓存 | Token/Session/Cache | ⚠️ 可选（部分模块降级为内存 Map） | 性能/一致性问题 |
| **NATS JetStream** | 消息队列 | 事件总线（EventBus） | ⚠️ 可选（无 NATS 时降级为内存事件） | 事件丢失风险 |

**关键发现**：
- PostgreSQL 是唯一持久化存储，643 个 migration 文件，30+ 服务使用 Repository pattern
- Redis 非强制依赖，无 Redis 时 Cache/CircuitBreaker 等模块降级为内存 Map
- NATS 非强制依赖，`EventBusService.ts` 在无 NATS 时使用内存 `EventEmitter`

### 8.2 API Gateway 路由架构

```
前端 (orion-frontend, React+微前端)
    │
    ▼
API Gateway (orion-api-gateway, Fastify 代理, 端口 3000)
    │
    ├── /api/v1/pipelines      → localhost:3002 (Go, Pipeline)
    ├── /api/v1/deployments    → localhost:3003 (Go, Deploy)
    ├── /api/v1/tickets        → localhost:3004 (Go, Ticket)
    ├── /api/v1/monitoring     → localhost:3005 (Go, Monitor)
    ├── /api/v1/intelligence   → localhost:3006 (Go, Intelligence)
    ├── /api/v1/ai             → localhost:8000 (Python, AI 服务)
    ├── /api/v1/knowledge      → localhost:8002 (Python, PandaWiki)
    ├── /api/v1/notifications  → localhost:3001 (Node.js, 平台服务)
    ├── /api/v1/chatops        → localhost:3001 (Node.js, 平台服务)
    ├── /api/v1/cmdb           → localhost:3030 (Go, CMDB)
    └── /api/v1/* (其余)       → localhost:3001 (Node.js, 平台服务)
```

**路由策略**：
- Go 服务（6个）：直接路由到 Go 服务端口
- Python 服务（2个）：直接路由到 Python 服务端口
- Node.js 服务（Notify/ChatOps）：路由到 platform-service（3001）
- 其余服务：路由到 platform-service（3001）作为单体处理

### 8.3 外部系统集成

| 外部系统 | 用途 | 集成方式 | 文档位置 |
|---------|------|---------|---------|
| GitLab / GitHub | 代码托管 + Webhook | REST API + Webhook | `外部服务集成清单.md` |
| Tekton | CI/CD 引擎 | K8s CRD + API | `外部服务集成清单.md` |
| Prometheus + Grafana | 监控指标 | 拉取 + 可视化 | `外部服务集成清单.md` |
| Harbor / Nexus | 制品仓库 | REST API | `外部服务集成清单.md` |
| K8s API | 部署/伸缩 | client-go | 平台服务内置 |
| 钉钉/企业微信/飞书 | 通知 + ChatOps | Webhook + Bot API | `外部服务集成清单.md` |
| SSO (OIDC/SAML) | 统一认证 | OAuth 2.0 / SAML | `外部服务集成清单.md` |
| orion-dba (Yearning) | SQL 审计 | 微前端子应用 | `外部组件集成架构设计.md` |
| orion-knowledge (PandaWiki) | 知识库/RAG | 微服务 + 微前端 | `外部组件集成架构设计.md` |
| orion-visor (Dromara) | CMDB/资产管理 | 微服务 API (3034) | `外部组件集成架构设计.md` |

**完整外部集成清单**：见 [`docs/architecture/外部服务集成清单.md`](./外部服务集成清单.md)（28 个外部服务 + 6 个微服务包装）

**集成架构图**：见 [`docs/architecture/外部组件集成架构设计.md`](./外部组件集成架构设计.md)
