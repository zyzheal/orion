# Orion 代码架构分层与数据流分析

> 分析日期: 2026-05-12
> 基于: orion-platform-service (62 子模块) + 24 个独立微服务 + API Gateway

---

## 一、代码架构分层（5 层）

```
┌─────────────────────────────────────────────────────────┐
│ Layer 5: 客户端层 (Client)                               │
│  orion-frontend (React 18 + Vite + wujie 微前端)         │
│  27 页面目录 / 98 API 客户端 / 全局 Store (Zustand)       │
├─────────────────────────────────────────────────────────┤
│ Layer 4: 网关层 (Gateway)                                │
│  orion-api-gateway (Fastify)                             │
│  认证代理 / 限流 / 路由转发 / 57+ 微服务代理路由           │
├─────────────────────────────────────────────────────────┤
│ Layer 3: 服务层 (Services)                               │
│  ├── orion-platform-service (核心单体, 38 路由)          │
│  │   ├── 62 内部子模块 (80K+ 行)                         │
│  │   ├── 92 Repository / 35 Model                       │
│  │   └── EventBus / NATS / Redis / PostgreSQL           │
│  ├── 24 个独立微服务 (orion-*-svc)                       │
│  │   ├── P0 完整: ticket, finops, code, plugin, ai,     │
│  │   │   security, artifact (7 服务, 54K+ 行)            │
│  │   ├── P1 迁移: efficiency, dr, federation (3 服务)    │
│  │   └── 骨架: pipeline, deploy, monitor, agent, intel  │
│  ├── 2 个 Python 服务: orion-ai-service, orion-knowledge │
│  └── 2 个 Java 服务: orion-visor, orion-dba              │
├─────────────────────────────────────────────────────────┤
│ Layer 2: 基础设施层 (Infrastructure)                     │
│  ├── 数据库: PostgreSQL 集群 (194 migrations)            │
│  ├── 缓存: Redis (RedisCache, 366 行)                    │
│  ├── 消息: NATS JetStream (EventBus, 1079 行)           │
│  └── 编排: Docker Compose (orion-microservices)          │
├─────────────────────────────────────────────────────────┤
│ Layer 1: 公共组件层 (Shared)                             │
│  ├── 认证中间件: authMiddleware, roleGuard               │
│  ├── 租户隔离: TenantIsolationService, RLS               │
│  ├── 错误处理: errors/, ErrorHandler                     │
│  └── 工具库: utils/ (配置解析、格式化、验证)              │
└─────────────────────────────────────────────────────────┘
```

## 二、platform-service 内部架构（92 Repos / 35 Models）

### Repository 分布（按领域）

| 领域 | Repository 数量 | 关键文件 |
|------|----------------|----------|
| **制品管理** | 8 | Artifact, ArtifactVersion, BuildArtifact, BuildLog, BuildCache, BuildPod, BuilderImage |
| **Agent** | 3 | AgentProfile, AgentRun, AgentRepository |
| **告警** | 2 | AlertRule, AlertSuppression |
| **审批** | 1 | ApprovalRepository |
| **审计** | 1 | AuditRepository |
| **分支策略** | 1 | BranchPolicyRepository |
| **预算/成本** | 3 | BudgetRepository, CostRepository, BuildCostRepository |
| **Canary** | 3 | CanaryAnalysis, CanaryMetrics, CanaryThresholds |
| **CMDB** | 4 | CiCdNode, CmdbApplication, CmdbBusinessDomain, CmdbProductLine |
| **配置** | 4 | ConfigHistory, ConfigProfile, ConfigTemplate, DiffHistory |
| **部署** | 4 | DeployApproval, DeployKey, DeployStage, DeployStageLog |
| **EventBus** | 3 | EventBusConfig, EventSubscription, EventBusEvent |
| **流水线** | 5+ | Pipeline, PipelineRun, PipelineStage, PipelineTemplate, PipelineTrigger |
| **安全** | 3+ | SecurityScan, SecurityScanResult, SecurityToolType |
| **自愈** | 3 | SelfHealingIncident, SelfHealingAction, SelfHealingRule |
| **用户/角色** | 2 | UserRepository, RoleRepository |
| **其他** | 35+ | OnCall, Schedule, Backup, ChatOps, Skill, Knowledge, Environment 等 |

### 数据流模式

```
Request → Route → Controller → Service → Repository → PostgreSQL
                                              ↓
                                        RedisCache (缓存)
                                              ↓
                                    EventBus → NATS → 订阅服务
```

## 三、跨服务数据流

### 事件驱动流（NATS）

```
orion-platform-service (EventBus)
    ↓ NATS JetStream
├── orion-ai-service (Python) ← Code Review, 智能测试
├── orion-knowledge (Python) ← 知识同步
├── orion-notify-svc ← 通知触发
├── orion-monitor-svc ← 指标采集
├── orion-intelligence-svc ← AI 分析
└── orion-ticket-svc ← 工单自动创建
```

### 服务间调用（HTTP via Gateway）

```
orion-frontend → orion-api-gateway → orion-platform-service (IAM, 配置, 项目)
                              → orion-pipeline-svc (CI/CD)
                              → orion-ticket-svc (工单)
                              → orion-finops-svc (成本)
                              → orion-security-svc (安全)
                              → orion-deploy-svc (部署)
                              → ... (24 个微服务)
```

### 核心数据流场景

1. **Pipeline 执行**:
   ```
   前端触发 → Gateway → pipeline-svc → 编排 Stage → 调用 Runner → 上报结果 → EventBus → 通知/监控/AI
   ```

2. **代码提交到部署**:
   ```
   Webhook → code-svc → pipeline-svc 触发 → 构建 → 制品 → artifact-svc → deploy-svc → monitor-svc
   ```

3. **AI 智能闭环**:
   ```
   事件 → ai-service(Python) → NATS → intelligence-svc → ticket-svc 自动建单 → 自愈 → 通知
   ```

## 四、关键技术决策

| 决策 | 选择 | 说明 |
|------|------|------|
| 服务间通信 | NATS JetStream + HTTP | 事件用 NATS，同步用 HTTP |
| 数据持久化 | PostgreSQL + Repository 模式 | 30+ 服务已迁移 |
| 缓存 | Redis (单例) | Token 黑名单、会话、热点数据 |
| 多租户 | 行级安全 (RLS) + 中间件隔离 | TenantIsolationService |
| 微前端 | wujie | 子应用独立部署 |
| 技术多样性 | Python/Java/Node.js | 按场景选择 |
