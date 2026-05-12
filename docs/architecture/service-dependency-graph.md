# Orion 服务依赖关系与数据流图

> 分析日期: 2026-05-12

---

## 一、服务间依赖关系图

```
                    ┌──────────────────┐
                    │   orion-frontend │
                    │   (React + Vite) │
                    └────────┬─────────┘
                             │ HTTP
                    ┌────────▼─────────┐
                    │ orion-api-gateway│ ←── 认证 / 限流 / 路由转发
                    │    (Fastify)     │
                    └──┬───┬───┬───┬──┘
                       │   │   │   │
          ┌────────────┘   │   │   └────────────┐
          ▼                ▼   ▼                ▼
┌─────────────────┐ ┌──────────────┐ ┌─────────────────┐
│platform-service │ │ pipeline-svc │ │   ticket-svc    │
│ (核心单体)       │ │ (CI/CD)      │ │   (工单)         │
│ 38 routes       │ │ 46 services  │ │ 11K lines       │
└──┬──┬──┬──┬─────┘ └──┬──┬────────┘ └──┬──┬───────────┘
   │  │  │  │         │  │             │  │
   │  │  │  │    ┌────▼──▼──┐    ┌─────▼──▼────┐
   │  │  │  │    │deploy-svc│    │intelligence │
   │  │  │  │    │(骨架)     │    │(AI 智能)    │
   │  │  │  │    └────┬─────┘    └─────┬───────┘
   │  │  │  │         │                │
   │  │  │  │    ┌────▼─────┐    ┌─────▼───────┐
   │  │  │  │    │monitor-  │    │selfhealing  │
   │  │  │  │    │svc(半骨) │    │(自愈)       │
   │  │  │  │    └────┬─────┘    └─────┬───────┘
   │  │  │  │         │                │
   │  │  │  │    ┌────▼─────┐    ┌─────▼───────┐
   │  │  │  │    │notify-svc│    │  audit-svc  │
   │  │  │  │    │(通知)    │    │  (审计)      │
   │  │  │  │    └──────────┘    └─────────────┘
   │  │  │  │
   │  │  │  └── NATS JetStream 事件总线 ─────────────┐
   │  │  │                                           │
   │  │  ▼                                           ▼
   │  │  ┌──────────────────────────────────────────────────┐
   │  │  │              NATS JetStream                       │
   │  │  │  (orion-ai-service)  (orion-knowledge)           │
   │  │  │  (Python AI)         (Python 知识库)             │
   │  │  └──────────────────────────────────────────────────┘
   │  │
   │  └── Redis Cache (Token 黑名单 / 会话 / 热点数据)
   │
   └── PostgreSQL (92 Repos / 35 Models / 194 Migrations)
```

## 二、核心数据流场景

### 场景 1: Pipeline 完整执行流程

```
1. 前端 POST /api/v1/pipeline/run → Gateway → pipeline-svc
2. pipeline-svc.PipelineService.createRun()
3. pipeline-svc.PipelineEngine.execute()
   ├── StageExecutor → TaskRunner → Bash/Docker 执行
   ├── VariableContext 变量传播
   └── PipelineEventSSEBridge 实时推送进度
4. 执行完成 → PipelineRunService.updateStatus()
5. EventBusService.publish('pipeline.completed', {...})
   ├── NATS → orion-ai-service 触发 AI Review
   ├── NATS → orion-notify-svc 发送通知
   └── NATS → orion-monitor-svc 更新指标
6. SagaCoordinator 确保事务一致性
   ├── PipelineSaga: createRun → reserveResources → executeStages
   └── 失败时自动补偿: cancelStages → releaseResources
```

### 场景 2: 代码提交到部署闭环

```
1. GitHub Webhook → Gateway → code-svc/webhook
2. code-svc 验证签名 → 发布 'code.pushed' 事件
3. NATS → pipeline-svc 自动触发 CI Pipeline
4. CI Pipeline 执行: build → test → scan
5. 成功 → ArtifactService 上传制品 → artifact-svc
6. 手动触发 CD → Gateway → deploy-svc
7. deploy-svc.DeployWorkflow:
   ├── DeployStrategyEngine (blue-green/canary/rolling)
   ├── CanaryAnalysisService 分析
   ├── monitor-svc 验证健康
   └── 成功 → DeployHistoryService 记录
8. 失败 → RollbackService 自动回滚
```

### 场景 3: AI 智能自愈闭环

```
1. monitor-svc 检测到 Pod Crash
2. SelfHealingService 触发诊断
3. NATS → orion-ai-service (Python) 根因分析
4. AI 返回诊断结果 → intelligence-svc
5. SelfHealingSaga 执行修复:
   ├── detectIssue
   ├── diagnoseRootCause (AI)
   ├── executeRemediation
   └── verifyResult
6. 成功 → audit-svc 记录操作
7. 失败 → ticket-svc 自动建单 → 通知 oncall
```

## 三、Saga 分布式事务流

```
┌─────────────────────────────────────────────────────┐
│                SagaCoordinator                        │
│                                                       │
│  PipelineSaga:                                        │
│    1. createRun      → 补偿: deleteRun               │
│    2. reserveResources → 补偿: releaseResources      │
│    3. executeStages   → 补偿: cancelStages           │
│    4. updateStatus    → 补偿: revertStatus           │
│    5. publishEvents   → 补偿: publishFailureEvents   │
│                                                       │
│  DeploySaga:                                          │
│    1. createDeployment  → 补偿: deleteDeployment     │
│    2. runCanaryAnalysis → 补偿: cancelCanary         │
│    3. promoteToProd   → 补偿: rollback               │
│    4. updateStatus    → 补偿: revertStatus           │
│    5. publishEvents   → 补偿: publishRollbackEvents  │
│                                                       │
│  SelfHealingSaga:                                     │
│    1. detectIssue      → 补偿: clearDetection        │
│    2. diagnoseRootCause → 补偿: cancelDiagnosis      │
│    3. executeRemediation → 补偿: undoRemediation     │
│    4. verifyResult     → 补偿: clearVerification     │
│    5. publishEvents    → 补偿: publishFailureEvents  │
│                                                       │
│  幂等性: Redis IdempotencyChecker (24h TTL)          │
│  事务日志: TransactionLog (可恢复)                    │
└─────────────────────────────────────────────────────┘
```

## 四、EventBus 事件流

```
EventBus (NATS JetStream)
├── Streams:
│   ├── pipeline_events (pipeline.*)
│   ├── code_events (code.*)
│   ├── deploy_events (deploy.*)
│   ├── alert_events (alert.*)
│   └── system_events (system.*)
│
├── Publishers:
│   ├── platform-service (核心事件源)
│   ├── pipeline-svc (CI/CD 事件)
│   ├── code-svc (代码事件)
│   └── deploy-svc (部署事件)
│
└── Subscribers:
    ├── orion-ai-service (Python) → AI Code Review
    ├── orion-knowledge (Python) → 知识同步
    ├── orion-notify-svc → 通知推送
    ├── orion-monitor-svc → 指标采集
    ├── orion-intelligence-svc → AI 分析
    └── orion-ticket-svc → 自动建单
```

## 五、多租户隔离数据流

```
Request → TenantIsolationMiddleware
    ↓
X-Tenant-ID header 提取
    ↓
RLS Policy (PostgreSQL Row-Level Security)
    ├── TenantContextStorage (异步本地存储)
    ├── RLS: SET LOCAL tenant.current_id = ?
    └── 自动过滤所有查询
    ↓
TenantQuotaService → 配额检查
    ↓
NamespacePoolService → 命名空间隔离
    ↓
Response (仅返回租户数据)
```
