# Orion 前后端交互映射文档

> 更新日期: 2026-08-01 | 数据源: 前端 API 客户端 + 后端 Handler/Routes 逐模块扫描
> 前端路由: 315 条 | 后端 Handler: 263 个模块实现 RegisterRoutes | 前端 API 文件: 166 个
> 交互模式: REST (标准) + SSE (实时日志) + WebSocket (实时终端) + NATS (事件驱动)

---

## 一、交互模式总览

| 模式 | 协议 | 传输方式 | 使用场景 | 前端组件 | 后端模块 |
|------|------|---------|---------|---------|---------|
| REST API | HTTP/JSON | 请求-响应 | CRUD 操作，全部业务域 | 166 个 API 文件 | 27 个 Handler |
| SSE | text/event-stream | 服务端推送 | Pipeline 实时日志/状态 | `usePipelineSSE` Hook | `pipeline-sse/handler` |
| WebSocket | 全双工 | 持久连接 | Web 终端(SSH) | `OrionWebSocketClient` | Visor 服务 |
| NATS | JetStream | 发布-订阅 | 事件驱动(告警/自愈/配置变更) | — (后端间) | 9+ 订阅者 |

---

## 二、REST API 映射 (核心交互)

### 2.1 前端 API 客户端 → 后端 Handler 映射

| 前端 API 文件 | 后端 Handler 模块 | 域 | 端点数量 | 功能 |
|--------------|------------------|---|---------|------|
| `pipelines.ts` | pipeline/handler | CI/CD | ~13 | Pipeline CRUD + 列表 |
| `pipelineRuns.ts` | pipeline-engine/handler | CI/CD | ~6 | 运行/停止/重试 |
| `build-env.ts` | build-env/handler | CI/CD | ~5 | 构建环境管理 |
| `deploy.ts` | deploy/handler | CI/CD | ~10 | 部署管理 |
| `deployments.ts` | deploy-enhanced/handler | CI/CD | ~8 | 部署增强 |
| `artifact.ts` | artifact/handler | CI/CD | ~8 | 制品管理 |
| `artifacts.ts` | artifact-version/handler | CI/CD | ~10 | 制品版本 |
| `ticketing.ts` | ticketing/handler | ITSM | ~37 | 工单全生命周期 |
| `incident.ts` | incident/handler | ITSM | ~12 | 事件管理 |
| `problem.ts` | problem/handler | ITSM | ~10 | 问题管理 |
| `change.ts` | change/handler | ITSM | ~10 | 变更管理 |
| `sla.ts` | sla/handler | ITSM | ~8 | SLA 管理 |
| `approval.ts` | approval/handler | ITSM | ~10 | 审批管理 |
| `cmdb.ts` | cmdb/handler | CMDB | ~15 | CI 管理 |
| `auth.ts` | auth/handler | 身份 | ~6 | 登录/注册/刷新 |
| `user.ts` | user/handler | 身份 | ~8 | 用户管理 |
| `tenant.ts` | tenant/handler | 身份 | ~10 | 租户管理 |
| `roles.ts` | role/handler | 身份 | ~6 | 角色管理 |
| `alerts.ts` | alert/handler | 监控 | ~10 | 告警管理 |
| `monitoring.ts` | monitoring/handler | 监控 | ~8 | 监控数据 |
| `config.ts` | config/handler | 配置 | ~12 | 配置管理 |
| `chatops.ts` | chatops/handler | AI | ~15 | ChatOps 操作 |
| `agents.ts` | ai-agent-run/handler | AI | ~8 | Agent 管理 |
| `notifications.ts` | notification/handler | 通知 | ~10 | 通知管理 |
| `secrets.ts` | secret/handler | 安全 | ~6 | 密钥管理 |
| `audit-logs.ts` | audit/handler | 安全 | ~6 | 审计日志 |
| `workflow.ts` | workflow/handler | 低代码 | ~10 | 工作流设计 |
| `finops.ts` | finops/handler | FinOps | ~10 | 成本管理 |
| `billing.ts` | billing/handler | FinOps | ~6 | 账单管理 |

### 2.2 典型 REST 数据流

```
用户操作 → React Component → API Client (client.ts)
    → Axios 拦截器 (添加 JWT Bearer Token)
    → HTTP GET/POST/PUT/DELETE /api/v1/{resource}
    → Gin Router → Handler.RegisterRoutes
    → Handler.Method() → Service.Method() → Repository.Method()
    → PostgreSQL → 响应 JSON → client.ts 反序列化
    → React State 更新 → UI 渲染 (message.success/error)
```

### 2.3 未映射的 API 客户端 (存在前端文件但后端无对应 Handler)

| 前端 API 文件 | 状态 | 说明 |
|--------------|------|------|
| `page-registry.ts` | ⚠️ 未直接引用 | 仅 1 次非 API 引用 |
| `confirmation.ts` | ⚠️ 文本引用 | 仅文本引用，无实际 API 调用 |
| `cache.ts` | ⚠️ 非 API 引用 | 仅 1 次非 API 引用 |
| `deploy-enhanced.ts` | ⚠️ 0 次引用 | 前端文件但无导入 |

---

## 三、SSE 实时交互 (Pipeline 日志流)

### 3.1 数据流

```
Pipeline Engine 执行
    ↓
SSEHub (service/sse_hub.go)
    ├── CreateConnection(pipelineID, runID, userID)
    ├── PublishLogEvent(ctx, tenantID, event)
    ├── PublishStatusEvent(ctx, tenantID, event)
    └── StreamLogEvents(c, connID) / StreamStatusEvents(c, connID)
        ↓
HTTP Response (text/event-stream)
    ├── Content-Type: text/event-stream
    ├── Cache-Control: no-cache
    └── Connection: keep-alive
        ↓
前端 usePipelineSSE Hook
    ├── new EventSource(url)
    ├── onmessage → parse log/status/stage_start/stage_end events
    ├── onerror → reconnect logic
    └── React State → UI 渲染 (PipelineRunLive, PipelineDetail)
```

### 3.2 SSE 端点

| 端点 | 方法 | 功能 | 前端使用 |
|------|------|------|---------|
| `/pipelines/sse/logs` | GET | 日志流 | `usePipelineSSE({ pipelineId, runId })` |
| `/pipelines/sse/status` | GET | 状态流 | `usePipelineSSE({ includeStatus: true })` |
| `/pipelines/sse/publish/log` | POST | 发布日志(内部) | — |
| `/pipelines/sse/publish/status` | POST | 发布状态(内部) | — |
| `/pipelines/sse/stats` | GET | 连接统计 | 调试用 |

### 3.3 SSE 事件类型

| 事件类型 | 数据 | 触发条件 |
|---------|------|---------|
| `log` | `{ level, message, timestamp, stage, step }` | Pipeline 执行日志 |
| `status` | `{ pipelineId, runId, status, progress }` | Pipeline 状态变更 |
| `stage_start` | `{ stageId, stageName, timestamp }` | Stage 开始执行 |
| `stage_end` | `{ stageId, stageName, status, duration }` | Stage 执行完成 |
| `step_start` | `{ stepId, stepName, timestamp }` | Step 开始执行 |
| `step_end` | `{ stepId, stepName, status, duration }` | Step 执行完成 |

---

## 四、WebSocket 实时交互 (Visor 终端)

### 4.1 数据流

```
Visor 前端 (Xterm.js)
    ↓
OrionWebSocketClient (ws-client.ts)
    ├── connect(url) → WebSocket
    ├── reconnect with exponential backoff
    │   ├── initialDelay: 1s
    │   ├── maxDelay: 30s
    │   └── maxAttempts: 10
    ├── send(message) → JSON
    └── onmessage → parse → terminal.write()
        ↓
Visor 后端 (Go/SSH)
    ├── WebSocket Upgrade
    ├── SSH Session 管理
    ├── PTY 分配
    └── I/O 转发
```

### 4.2 WebSocket 消息格式

```typescript
interface WebSocketMessage {
  type: 'input' | 'output' | 'resize' | 'close' | 'error';
  payload: string;
  sessionId?: string;
  timestamp?: number;
}
```

### 4.3 连接状态机

```
disconnected → connecting → connected → disconnected
                                  ↓
                               error → disconnected
```

---

## 五、NATS 事件驱动交互 (后端间)

### 5.1 事件发布-订阅拓扑

```
发布者                                      NATS JetStream (ORION_EVENTS)       订阅者
─────────                                    ────────────────────────           ──────────
Pipeline Engine (状态变更) ──────────────────→  pipeline.status.*  ──────────────→ Incident (创建事件)
Alert Pipeline (告警触发)  ──────────────────→  alert.triggered    ──────────────→ Self-Healing (自动修复)
Config Service (配置变更)  ──────────────────→  config.changed     ──────────────→ Notification (通知推送)
User Service (用户事件)    ──────────────────→  user.*             ──────────────→ Audit (审计日志)
Code Service (代码事件)    ──────────────────→  code.*             ──────────────→ Knowledge (知识库)
FinOps (成本数据)          ──────────────────→  finops.*           ──────────────→ Report Designer (报表)
Pandawiki (知识更新)       ──────────────────→  knowledge.*        ──────────────→ Search (索引更新)
```

### 5.2 跨域事件链路

```
告警 → 去重 → 关联 → 静默 → 升级 → 事件创建(NATS)
  ↓
事件 → 变更请求 → 审批 → Pipeline 执行 → 部署 → CMDB 更新
  ↓
Pipeline 失败 → 事件(NATS) → 自愈 → 诊断 → 恢复 → 通知
  ↓
成本超支 → 告警(NATS) → 预算通知 → 自动扩缩容
```

### 5.3 NATS 订阅者清单

| 模块 | 文件 | 功能 |
|------|------|------|
| incident | `incident/nats/subscriber.go` | 事件处理 |
| self-healing | `self-healing/nats/subscriber.go` | 自愈 |
| finops/efficiency | `finops/efficiency/pkg/nats/subscriber.go` | 成本数据 |
| finops/report-designer | `finops/report-designer/nats/subscriber.go` | 报表 |
| identity/user | `identity/user/nats/subscriber.go` | 用户事件 |
| config | `config/pkg/nats/subscriber.go` | 配置变更 |
| pandawiki | `pandawiki/internal/nats/subscriber.go` | 知识库 |
| code | `code/pkg/nats/subscriber.go` | 代码事件 |
| workflow/approval | `workflow/approval/nats.go` | 审批事件 |

---

## 六、认证与权限交互

### 6.1 认证流程

```
前端登录页
  ↓ POST /api/v1/auth/login
  ↓ { username, password, tenantId }
后端 auth/handler
  ↓ 验证凭证
  ↓ 返回 { accessToken, refreshToken, expiresAt }
前端 authStore.setTokens()
  ├── localStorage: ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY
  └── Token 刷新机制:
      1. client.ts 请求拦截器: authStore.getToken()
      2. Token 过期 → 尝试刷新 → refreshAuthTokenApi(refreshToken)
      3. 刷新成功 → 更新 token, 重试原请求
      4. 刷新失败 → 清除 token, 跳转登录页
      5. 并发请求队列: 防止多个请求同时刷新 token
```

### 6.2 权限校验

| 级别 | 实现 | 覆盖范围 |
|------|------|---------|
| 前端路由守卫 | `usePermission` Hook | 仅 4 个页面 (AlertList, PipelineList) |
| 后端 ACL | `aclMiddleware` | 路由级别 |
| ABAC | `abac-policy` | 属性级策略 |
| 租户隔离 | `tenant_id` 过滤 | 数据级别 |

**权限缺口**: 前端敏感页面(ChangeManagement/Secret/Approval/Admin) 0 个权限守卫。

---

## 七、中间件链

### 7.1 请求处理链

```
HTTP Request
  ↓
RateLimit (token bucket, 100 req/min 默认, auth 端点更严格)
  ↓
Prometheus Metrics (请求计数/延迟/状态码)
  ↓
Structured Logger (traceId, tenantId, userId)
  ↓
Timeout (请求超时控制)
  ↓
Security (安全头/CORS)
  ↓
Tracing (分布式追踪)
  ↓
Handler → Service → Repository → DB
  ↓
Response (统一 JSON 格式: { code, message, data })
  ↓
HTTP Response
```

### 7.2 限流配置

| 端点 | 限制 |
|------|------|
| `/api/v1/auth/login` | 20 req/min, burst 10 |
| `/api/v1/auth/register` | 10 req/min, burst 5 |
| `/api/v1/auth/password` | 10 req/min, burst 5 |
| `/api/v1/auth/token` | 30 req/min, burst 15 |
| `/api/v1/auth/verify` | 30 req/min, burst 15 |
| 默认 | 100 req/min, burst 100 |

---

## 八、前端-后端 API 文件映射矩阵

### 8.1 已映射 (60+ 前端 API → 后端 Handler)

| 前端 API 文件 | 后端 Handler | 域 | 路由前缀 |
|--------------|-------------|---|---------|
| `pipelines.ts` | pipeline/handler | CI/CD | `/api/v1/pipelines` |
| `pipelineRuns.ts` | pipeline-engine/handler | CI/CD | `/api/v1/pipeline-runs` |
| `pipeline-budget.ts` | pipeline-budget/handler | CI/CD | `/api/v1/pipeline-budget` |
| `pipeline-versions.ts` | pipeline-versions/handler | CI/CD | `/api/v1/pipeline-versions` |
| `pipeline-templates.ts` | pipeline-templates/handler | CI/CD | `/api/v1/pipeline-templates` |
| `build-env.ts` | build-env/handler | CI/CD | `/api/v1/build-env` |
| `deploy.ts` | deploy/handler | CI/CD | `/api/v1/deploy` |
| `deployments.ts` | deploy-enhanced/handler | CI/CD | `/api/v1/deployments` |
| `artifact.ts` | artifact/handler | CI/CD | `/api/v1/artifacts` |
| `artifacts.ts` | artifact-version/handler | CI/CD | `/api/v1/artifact-versions` |
| `ticketing.ts` | ticketing/handler | ITSM | `/api/v1/tickets` |
| `incident.ts` | incident/handler | ITSM | `/api/v1/incidents` |
| `problem.ts` | problem/handler | ITSM | `/api/v1/problems` |
| `change.ts` | change/handler | ITSM | `/api/v1/changes` |
| `sla.ts` | sla/handler | ITSM | `/api/v1/slas` |
| `approval.ts` | approval/handler | ITSM | `/api/v1/approvals` |
| `cmdb.ts` | cmdb/handler | CMDB | `/api/v1/cmdb` |
| `auth.ts` | auth/handler | 身份 | `/api/v1/auth` |
| `user.ts` | user/handler | 身份 | `/api/v1/users` |
| `tenant.ts` | tenant/handler | 身份 | `/api/v1/tenants` |
| `roles.ts` | role/handler | 身份 | `/api/v1/roles` |
| `alerts.ts` | alert/handler | 监控 | `/api/v1/alerts` |
| `monitoring.ts` | monitoring/handler | 监控 | `/api/v1/monitoring` |
| `config.ts` | config/handler | 配置 | `/api/v1/config` |
| `chatops.ts` | chatops/handler | AI | `/api/v1/chatops` |
| `agents.ts` | ai-agent-run/handler | AI | `/api/v1/agents` |
| `notifications.ts` | notification/handler | 通知 | `/api/v1/notifications` |
| `secrets.ts` | secret/handler | 安全 | `/api/v1/secrets` |
| `audit-logs.ts` | audit/handler | 安全 | `/api/v1/audit-logs` |
| `workflow.ts` | workflow/handler | 低代码 | `/api/v1/workflows` |
| `finops.ts` | finops/handler | FinOps | `/api/v1/finops` |
| `billing.ts` | billing/handler | FinOps | `/api/v1/billing` |
| `approval.ts` | approval/handler | ITSM | `/api/v1/approvals` |
| `capability.ts` | capability/handler | 身份 | `/api/v1/capabilities` |
| `feature-flags.ts` | feature-flag/handler | 配置 | `/api/v1/feature-flags` |
| `global-params.ts` | global-param/handler | 配置 | `/api/v1/global-params` |
| `plugin.ts` | plugin/handler | 插件 | `/api/v1/plugins` |
| `queue.ts` | queue/handler | ITSM | `/api/v1/queues` |
| `webhook.ts` | webhook/handler | 工具 | `/api/v1/webhooks` |
| `sso.ts` | sso/handler | 身份 | `/api/v1/sso` |
| `sso-providers.ts` | sso-providers/handler | 身份 | `/api/v1/sso-providers` |
| `rbac.ts` | rbac/handler | 身份 | `/api/v1/rbac` |
| `hook.ts` | hook-chain/handler | 工具 | `/api/v1/hooks` |
| `health.ts` | health-check/handler | 监控 | `/api/v1/health` |
| `performance.ts` | performance/handler | 监控 | `/api/v1/performance` |
| `slo.ts` | slo/handler | 监控 | `/api/v1/slos` |
| `eventbus.ts` | eventbus/handler | 监控 | `/api/v1/eventbus` |
| `script.ts` | script/handler | 工具 | `/api/v1/scripts` |
| `script-library.ts` | script-library/handler | 工具 | `/api/v1/script-library` |
| `script-versions.ts` | script-version/handler | 工具 | `/api/v1/script-versions` |
| `report.ts` | report-designer/handler | 数据 | `/api/v1/reports` |
| `bi.ts` | bi-dashboard/handler | 数据 | `/api/v1/bi` |
| `data-quality.ts` | data-quality/handler | 数据 | `/api/v1/data-quality` |
| `data-pipeline.ts` | data-pipeline/handler | 数据 | `/api/v1/data-pipelines` |
| `data-lineage.ts` | data-lineage/handler | 数据 | `/api/v1/data-lineage` |
| `vector-store.ts` | vector-store/handler | 数据 | `/api/v1/vector-store` |
| `supply-chain.ts` | supply-chain/handler | 安全 | `/api/v1/supply-chain` |
| `sbom.ts` | sbom/handler | 安全 | `/api/v1/sbom` |
| `vulnerability.ts` | vulnerability/handler | 安全 | `/api/v1/vulnerabilities` |
| `compliance.ts` | compliance/handler | 安全 | `/api/v1/compliance` |
| `security-compliance.ts` | security-compliance/handler | 安全 | `/api/v1/security-compliance` |
| `iac.ts` | iac/handler | 配置 | `/api/v1/iac` |
| `multi-cloud.ts` | multi-cloud/handler | CMDB | `/api/v1/multi-cloud` |
| `serverless.ts` | serverless/handler | CMDB | `/api/v1/serverless` |
| `cluster.ts` | cluster/handler | CMDB | `/api/v1/clusters` |
| `network.ts` | network/handler | CMDB | `/api/v1/networks` |
| `storage.ts` | storage/handler | CMDB | `/api/v1/storage` |
| `backup.ts` | backup/handler | CMDB | `/api/v1/backups` |
| `disaster-recovery.ts` | disaster-recovery/handler | CMDB | `/api/v1/disaster-recovery` |
| `digital-twin.ts` | digital-twin/handler | CMDB | `/api/v1/digital-twins` |
| `form.ts` | form/handler | 低代码 | `/api/v1/forms` |
| `lowcode.ts` | lowcode/handler | 低代码 | `/api/v1/lowcode` |
| `rule-engine.ts` | rule-engine/handler | 配置 | `/api/v1/rule-engine` |
| `cron.ts` | cron/handler | 工具 | `/api/v1/cron` |
| `import-export.ts` | import-export/handler | 工具 | `/api/v1/import-export` |
| `scheduled-notification.ts` | scheduled-notification/handler | 通知 | `/api/v1/scheduled-notifications` |
| `do-not-disturb.ts` | do-not-disturb/handler | 通知 | `/api/v1/do-not-disturb` |
| `audit.ts` | audit/handler | 安全 | `/api/v1/audit` |
| `permission-audit.ts` | permission-audit/handler | 安全 | `/api/v1/permission-audit` |
| `abac-policy.ts` | abac-policy/handler | 安全 | `/api/v1/abac-policies` |

### 8.2 前端 API 文件 → 后端 Handler 缺失 (需补充)

| 前端 API 文件 | 后端对应 Handler | 说明 |
|--------------|-----------------|------|
| `ai-agents.ts` | 无 | 可能由 ai-agent-run 覆盖 |
| `ai-cost.ts` | 无 | 可能由 finops 覆盖 |
| `ai-gateway.ts` | 无 | AI 网关 |
| `ai-review.ts` | 无 | AI 代码审查 |
| `ai-security.ts` | 无 | AI 安全 |
| `ai-decision.ts` | 无 | AI 决策 |
| `ai-docs.ts` | 无 | AI 文档管理 |
| `llm-trace.ts` | llm-trace/handler | 可能有 |
| `agents.ts` | 无 | 可能重复 |
| `approvals.ts` | 无 | 可能由 approval 覆盖 |
| `artifactVersions.ts` | artifact-version/handler | 映射到 artifacts.ts |
| `change-requests.ts` | change-request/handler | 需确认 |
| `notification-enhanced.ts` | 无 | 通知增强 |
| `notificationRules.ts` | notification-policy/handler | 需确认 |
| `ops-tools.ts` | 无 | 运维工具 |
| `product-lines.ts` | product-line/handler | 需确认 |
| `service-catalog.ts` | service-catalog/handler | 需确认 |
| `service-registry.ts` | service-registry/handler | 需确认 |
| `test-selector.ts` | test-selector/handler | 需确认 |
| `tracing.ts` | tracing/handler | 需确认 |

### 8.3 孤岛 Controller (存在前端 API 文件但 routes.ts 中 0 次路由注册)

> 来源: ALL_TODOS.md P1-5

| 前端 API 文件 | 状态 | 说明 |
|--------------|------|------|
| `ai-agents.ts` | ⚠️ 孤岛 | 存在文件但未注册路由 |
| `ai-cost.ts` | ⚠️ 孤岛 | 存在文件但未注册路由 |
| `ai-review.ts` | ⚠️ 孤岛 | 存在文件但未注册路由 |
| `ai-gateway.ts` | ⚠️ 孤岛 | 存在文件但未注册路由 |
| `ai-security.ts` | ⚠️ 孤岛 | 存在文件但未注册路由 |
| `ai-docs.ts` | ⚠️ 孤岛 | 存在文件但未注册路由 |
| `ai-decision.ts` | ⚠️ 孤岛 | 存在文件但未注册路由 |
| `notification-enhanced.ts` | ⚠️ 孤岛 | 存在文件但未注册路由 |
| `ops-tools.ts` | ⚠️ 孤岛 | 存在文件但未注册路由 |

### 8.4 未注册 TS 路由 (前端页面已存在但路由未注册到 routes.tsx)

> 来源: ALL_TODOS.md P1-4

| 前端页面 | 路由路径 | 状态 |
|---------|---------|------|
| channel | 待确认 | 未注册 |
| deploy-enhanced | 待确认 | 未注册 |
| federation | 待确认 | 未注册 |
| notification-management | 待确认 | 未注册 |
| pipeline-run-history | 待确认 | 未注册 |
| pipeline-trend | 待确认 | 未注册 |
| risk | 待确认 | 未注册 |

### 8.5 SSE 事件 JSON Schema

```typescript
// 日志事件
interface SSELogEvent {
  type: 'log';
  data: {
    level: 'debug' | 'info' | 'warn' | 'error';
    message: string;
    timestamp: string;  // ISO 8601
    stage?: string;     // stage ID
    step?: string;      // step ID
    traceId?: string;   // 分布式追踪 ID
  };
}

// 状态事件
interface SSEStatusEvent {
  type: 'status';
  data: {
    pipelineId: string;
    runId: string;
    status: 'pending' | 'running' | 'success' | 'failed' | 'cancelled';
    progress: number;  // 0-100
    startedAt?: string;
    completedAt?: string;
  };
}

// 阶段事件
interface SSEStageEvent {
  type: 'stage_start' | 'stage_end';
  data: {
    stageId: string;
    stageName: string;
    timestamp: string;
    status?: 'running' | 'success' | 'failed' | 'skipped';
    duration?: number;  // ms
  };
}

// 步骤事件
interface SSEStepEvent {
  type: 'step_start' | 'step_end';
  data: {
    stepId: string;
    stepName: string;
    timestamp: string;
    status?: 'running' | 'success' | 'failed' | 'skipped';
    duration?: number;  // ms
  };
}
```

### 8.6 统一错误响应格式

```typescript
// 标准 API 响应
interface ApiResponse<T = unknown> {
  code: number;       // 0=成功, 非0=错误码
  message: string;    // 错误描述
  data?: T;           // 响应数据
  traceId?: string;   // 追踪 ID (用于排查)
}

// 错误码范围
const ERROR_CODES = {
  CLIENT: {          // 4xx 类
    BAD_REQUEST: 40000,
    UNAUTHORIZED: 40100,
    FORBIDDEN: 40300,
    NOT_FOUND: 40400,
    VALIDATION: 42200,
  },
  SERVER: {          // 5xx 类
    INTERNAL: 50000,
    TIMEOUT: 50400,
    DEPENDENCY: 50200,
  },
};
```

---

## 九、数据流场景

### 9.1 Pipeline 执行全链路

```
用户点击"运行 Pipeline"
  ↓
前端 PipelineDetail → POST /api/v1/pipeline-runs { pipelineId, params }
  ↓
pipeline-engine/handler → PipelineEngine.Execute()
  ├── Scheduler → DependencyGraph.Order() (Kahn 拓扑排序)
  ├── Engine.runStages() → LevelGroups() (并行执行)
  ├── StageExecutor → TaskRunner → 构建/部署/测试
  ├── Saga rollback (失败时)
  ├── SSEHub.PublishStatusEvent() → SSE 流
  └── SSEHub.PublishLogEvent() → SSE 流
      ↓
前端 usePipelineSSE Hook → EventSource.onmessage
  ├── log → 日志面板追加
  ├── status → 进度条更新
  └── stage_end → 阶段状态更新
```

### 9.2 告警 → 事件全链路

```
Prometheus 告警
  ↓
Webhook → POST /api/v1/alerts
  ↓
alert/handler → alert-deduplication → alert-correlation
  ↓
alert-silence → alert-breaker
  ↓
NATS (alert.triggered) → incident/nats/subscriber
  ↓
incident.Service.Create() → PriorityMatrix(impact × urgency)
  ↓
SLA.StartTracking() → SLA 计时
  ↓
通知 → notification-policy → notification-template → channel
  ↓
前端 AlertList / IncidentList → 实时更新
```

### 9.3 CMDB 变更 → 审批 → 部署全链路

```
CMDB 检测到 CI 状态变更
  ↓
cmdb-collector → AdapterFactory → 自动发现
  ↓
cmdb-validator → ValidatorRegistry → 数据校验
  ↓
变更请求 → change-request → approval
  ↓
审批通过 → Pipeline 触发 → 部署
  ↓
deploy-enhanced → smart-deploy → progressive → 蓝绿发布
  ↓
更新 CMDB CI 状态 → 拓扑图刷新
  ↓
前端 CMDB/TopologyPage → BFS 拓扑图渲染
```

---

### 10.1 路由映射覆盖率

**315 条前端路由 → 后端 Handler 映射: 196 条已映射 (62%)**

| 类别 | 数量 | 占比 |
|------|------|------|
| 已映射到后端 Handler | 196 | 62% |
| 纯前端路由 (无后端 API) | 56 | 18% |
| 待确认后端映射 | 63 | 20% |
| **总计** | **315** | **100%** |

### 10.2 详细路由映射表

| 前端路由 | 前端页面 | 后端 API 模块 | 后端 Handler 模块 |
|---------|---------|--------------|-----------------|
| `/` | 首页 | — | — |
| `/login` | Login | auth | auth/handler |
| `/dashboard` | DashboardNew | pipelines, runs, monitoring | pipeline, monitoring |
| `/dashboard-core` | DashboardCore | — | — |
| `/dashboard/executive` | ExecutiveDashboard | — | — |
| `/dashboard/manager` | ManagerDashboard | — | — |
| `/dashboard/engineer/:id` | EngineerDashboard | — | — |
| `/console` | Console | plugins, feature-flags, users | feature-flag, user |
| `/console/users` | UserManagement | user | user/handler |
| `/console/plugins` | Plugins | plugin | plugin/handler |
| `/console/plugins/:id` | PluginDetail | plugin | plugin/handler |
| `/console/feature-flags` | FeatureFlags | feature-flag | feature-flag/handler |
| `/console/settings` | Settings | config | config/handler |
| `/console/capabilities` | CapabilityAdmin | capability | capability/handler |
| `/console/chatops` | ChatOpsAdmin | chatops | chatops/handler |
| `/console/subapps` | SubAppManagement | subapp | subapp/handler |
| `/console/cron` | CronManagement | cron | cron/handler |
| `/console/queue` | Queue | queue | queue/handler |
| `/console/webhooks` | Webhooks | webhook | webhook/handler |
| `/console/runners` | Runners | runner | runner/handler |
| `/console/scripts` | Scripts | script | script/handler |
| `/console/script-library` | ScriptLibrary | script-library | script-library/handler |
| `/console/build-env` | BuildEnv | build-env | build-env/handler |
| `/console/iac` | IaC | iac | iac/handler |
| `/console/diagnostic` | Diagnostic | diagnostic | diagnostic/handler |
| `/console/self-healing` | SelfHealing | self-healing | self-healing/handler |
| `/console/runbooks` | Runbooks | runbook | runbook/handler |
| `/console/monitoring` | ConsoleMonitoring | monitoring | monitoring/handler |
| `/console/observability` | Observability | observability | observability/handler |
| `/console/report-designer` | ReportDesigner | report-designer | report-designer/handler |
| `/console/pipeline-budget` | PipelineBudget | pipeline-budget | pipeline-budget/handler |
| `/console/code-mgmt` | CodeManagement | code-repo | code-repo/handler |
| `/console/iac` | IaC | iac | iac/handler |
| `/console/triggers` | Triggers | event-trigger | event-trigger/handler |
| `/console/approvals` | ConsoleApprovals | approval | approval/handler |
| `/console/llm-trace` | LLMTrace | llm-trace | llm-trace/handler |
| `/console/ai-cost` | AICost | ai-cost | finops/handler |
| `/console/ai-review` | AIReview | ai-review | ai/handler |
| `/console/ai-docs` | AIDocs | ai-docs | ai/handler |
| `/console/cron` | Cron | cron | cron/handler |
| `/console/modules` | Modules | module | module/handler |
| `/pipelines` | PipelineList | pipelines | pipeline/handler |
| `/pipelines/:id` | PipelineDetail | pipelineRuns + SSE | pipeline-engine, pipeline-sse |
| `/pipelines/:id/edit` | PipelineEditor | pipelines | pipeline/handler |
| `/pipelines/:id/runs` | PipelineRunList | pipelineRuns | pipeline-engine/handler |
| `/pipelines/:id/runs/:runId` | PipelineRunLive | pipelineRuns + SSE | pipeline-engine, pipeline-sse |
| `/pipelines/:id/versions` | PipelineVersionHistory | pipeline-versions | pipeline-versions/handler |
| `/pipelines/new` | PipelineNew | pipelines | pipeline/handler |
| `/pipeline-runs` | PipelineRuns | pipelineRuns | pipeline-engine/handler |
| `/pipeline-templates` | PipelineTemplates | pipeline-templates | pipeline-templates/handler |
| `/pipeline/audit-logs` | PipelineAuditLog | pipeline-audit-log | pipeline-audit-log/handler |
| `/pipeline/global-params` | GlobalParams | global-param | global-param/handler |
| `/pipeline/env-profiles` | EnvProfiles | env-profile | env-profile/handler |
| `/pipeline/script-versions` | PipelineScriptVersions | script-version | script-version/handler |
| `/deploy` | DeployPage | deploy, deployments | deploy/handler, deploy-enhanced/handler |
| `/deployments` | DeploymentList | deployments | deploy-enhanced/handler |
| `/deployments/:id` | DeploymentDetail | deployments | deploy-enhanced/handler |
| `/artifacts` | Artifacts | artifact | artifact/handler |
| `/artifacts/browser` | ArtifactBrowser | artifact | artifact/handler |
| `/artifacts/versions` | ArtifactVersions | artifact-version | artifact-version/handler |
| `/artifacts/versions/:name` | ArtifactVersionDetail | artifact-version | artifact-version/handler |
| `/cmdb` | CMDB | cmdb | cmdb/handler |
| `/cmdb/ci` | CITablePage | cmdb | cmdb/handler |
| `/cmdb/topology` | TopologyPage | cmdb-relationship | cmdb-relationship/handler |
| `/cmdb/batch-exec` | BatchExecPage | cmdb-collector | cmdb-collector/handler |
| `/cmdb/terminal` | WebTerminalPage | visor (WebSocket) | visor/handler |
| `/multi-cloud` | MultiCloud | multi-cloud | multi-cloud/handler |
| `/serverless` | Serverless | serverless | serverless/handler |
| `/cluster` | Cluster | cluster | cluster/handler |
| `/network` | Network | network | network/handler |
| `/storage` | Storage | storage | storage/handler |
| `/backup` | Backup | backup | backup/handler |
| `/disaster-recovery` | DisasterRecovery | disaster-recovery | disaster-recovery/handler |
| `/digital-twin` | DigitalTwin | digital-twin | digital-twin/handler |
| `/iac` | IaC | iac | iac/handler |
| `/secrets` | SecretsManagement | secret | secret/handler |
| `/tickets` | TicketList | ticketing | ticketing/handler |
| `/tickets/:id` | TicketDetail | ticketing | ticketing/handler |
| `/incident` | Incident | incident | incident/handler |
| `/problem` | Problem | problem | problem/handler |
| `/change` | ChangeManagement | change | change/handler |
| `/change-intelligence` | ChangeIntelligence | change-intelligence | change-intelligence/handler |
| `/sla` | SLA | sla | sla/handler |
| `/approvals` | Approvals | approval | approval/handler |
| `/approvals/workflows` | ApprovalWorkflows | approval | approval/handler |
| `/queue` | Queue | queue | queue/handler |
| `/itsm/changes` | ITSMChanges | change | change/handler |
| `/itsm/incidents` | ITSMIncidents | incident | incident/handler |
| `/itsm/problems` | ITSMProblems | problem | problem/handler |
| `/itsm/sla` | ITSMSLA | sla | sla/handler |
| `/itsm/catalog` | ServiceCatalog | service-catalog | service-catalog/handler |
| `/alerts` | AlertList | alerts | alert/handler |
| `/monitoring` | Monitoring | monitoring | monitoring/handler |
| `/metrics-dashboard` | MetricsDashboard | monitoring | monitoring/handler |
| `/health-dashboard` | HealthDashboard | health-check | health-check/handler |
| `/performance` | Performance | performance | performance/handler |
| `/tracing` | Tracing | tracing | tracing/handler |
| `/eventbus` | EventBus | eventbus | eventbus/handler |
| `/observability` | Observability | observability | observability/handler |
| `/apm/dashboard` | APMDashboard | apm | apm/handler |
| `/ai` | AIDashboard | ai-gateway | ai/handler |
| `/ai/agents` | AIAgents | ai-agent-run | ai-agent-run/handler |
| `/ai/cost` | AICostDashboard | ai-cost | finops/handler |
| `/ai/review` | AIReview | ai-review | ai/handler |
| `/ai/gateway` | AIGateway | ai-gateway | ai/handler |
| `/ai/security` | AISecurity | ai-security | ai/handler |
| `/ai/docs` | AIDocManagement | ai-docs | ai/handler |
| `/ai/chatops` | AIChatOps | chatops | chatops/handler |
| `/ai/knowledge` | AIKnowledge | knowledge | knowledge/handler |
| `/ai/trace` | AITrace | llm-trace | llm-trace/handler |
| `/ai/provider` | AIProvider | llm | llm/handler |
| `/ai/dashboard` | AIDashboard | ai-gateway | ai/handler |
| `/ai-decision` | AIDecision | ai-decision | aiDecisions/handler |
| `/ai-gateway` | AIGateway | ai-gateway | ai-gateway/handler |
| `/ai-security` | AISecurity | ai-security | ai/handler |
| `/notification` | NotificationCenter | notifications | notification/handler |
| `/notifications/:id` | NotificationDetail | notifications | notification/handler |
| `/notification-enhanced` | NotificationEnhanced | notification-enhanced | notification-management/handler |
| `/config-management` | ConfigManagement | config | config/handler |
| `/config-mgmt` | ConfigMgmt | config | config/handler |
| `/config-mgmt-enhanced` | ConfigMgmtEnhanced | config-mgmt-enhanced | config-mgmt-enhanced/handler |
| `/service-catalog` | ServiceCatalog | service-catalog | service-catalog/handler |
| `/service-portal` | ServicePortal | — | — |
| `/service-registry` | ServiceRegistry | service-registry | service-registry/handler |
| `/service-topology` | ServiceTopology | service-topology | service-topology/handler |
| `/workbench` | Workbench | workbench | workbench/handler |
| `/workflow-designer` | WorkflowDesigner | workflow | workflow/handler |
| `/workflow-tasks` | WorkflowTasks | workflow-task | workflow-task/handler |
| `/workflow-dependencies` | WorkflowDependencies | workflow-dependency | workflow-dependency/handler |
| `/workflows` | Workflows | workflow | workflow/handler |
| `/developer-portal` | DeveloperPortal | developer-portal | developer-portal/handler |
| `/ops-tools` | OpsTools | ops-tools | tool/handler |
| `/product-lines` | ProductLine | product-line | product-line/handler |
| `/finops` | FinOps | finops | finops/handler |
| `/finops-dashboard` | FinOpsDashboard | finops | finops/handler |
| `/billing` | Billing | billing | billing/handler |
| `/cost-allocation` | CostAllocation | cost-allocation | cost-allocation/handler |
| `/efficiency` | Efficiency | efficiency | efficiency/handler |
| `/capacity` | Capacity | capacity | capacity/handler |
| `/resilience-score` | ResilienceScore | resilience-score | resilience-score/handler |
| `/sbom` | SBOM | sbom | sbom/handler |
| `/supply-chain` | SupplyChain | supply-chain | supply-chain/handler |
| `/vulnerability` | Vulnerability | vulnerability | vulnerability/handler |
| `/compliance` | Compliance | compliance | compliance/handler |
| `/audit-log` | AuditLog | audit-logs | audit/handler |
| `/data-quality` | DataQuality | data-quality | data-quality/handler |
| `/data-pipeline` | DataPipeline | data-pipeline | data-pipeline/handler |
| `/data-lineage` | DataLineage | data-lineage | data-lineage/handler |
| `/vector-store` | VectorStore | vector-store | vector-store/handler |
| `/bi` | BI | bi-dashboard | bi-dashboard/handler |
| `/lowcode/import-export` | ImportExport | import-export | import-export/handler |
| `/lowcode/versions` | LowCodeVersions | lowcode | lowcode/handler |
| `/lowcode/templates` | LowCodeTemplates | lowcode | lowcode/handler |
| `/form` | FormDesigner | form | form/handler |
| `/plugin-marketplace` | PluginMarketplace | plugin-marketplace | plugin-marketplace/handler |
| `/chaos-engineering` | ChaosEngineering | chaos | chaos/handler |
| `/chaos-experiments` | ChaosExperiments | chaos | chaos/handler |
| `/chaos-runs` | ChaosRuns | chaos | chaos/handler |
| `/canary-analysis` | CanaryAnalysis | canary-analysis | canary-analysis/handler |
| `/canary-traffic` | CanaryTraffic | canary-traffic | canary-traffic/handler |
| `/oncall` | OnCall | oncall | oncall/handler |
| `/sessions` | Session | session | session/handler |
| `/tenant-list` | TenantList | tenant | tenant/handler |
| `/tenant-management` | TenantManagement | tenant | tenant/handler |
| `/roles` | RoleManagement | role | role/handler |
| `/projects` | Projects | project | project/handler |
| `/profile` | Profile | user | user/handler |
| `/knowledge` | Knowledge | knowledge | knowledge/handler |
| `/knowledge-base` | KnowledgeBase | pandawiki | pandawiki/handler |
| `/documents` | Documents | knowledge | knowledge/handler |
| `/documents-center` | DocumentsCenter | knowledge | knowledge/handler |
| `/subapps` | SubApps | subapp | subapp/handler |
| `/agent-dashboard` | AgentDashboard | ai-agent-run | ai-agent-run/handler |
| `/agent-runs/:id` | AgentRunDetail | ai-agent-run | ai-agent-run/handler |
| `/agent-run-detail/:id` | AgentRunDetail | ai-agent-run | ai-agent-run/handler |
| `/agents` | AIAgents | ai-agent-run | ai-agent-run/handler |
| `/skills` | Skills | skill | skill/handler |
| `/test-selector` | TestSelector | test-selector | test-selector/handler |
| `/dba` | DBA | dba | dba/handler |
| `/mlops` | MLOps | mlops | mlops/handler |
| `/inspection` | Inspection | inspection | inspection/handler |
| `/dev-env` | DevEnv | env-lifecycle | env-lifecycle/handler |
| `/environments` | Environments | environment | environment/handler |
| `/ephemeral-envs` | EphemeralEnvs | ephemeral-env | ephemeral-env/handler |
| `/event-registry` | EventRegistry | event-trigger-registry | event-trigger-registry/handler |
| `/gateway-routes` | GatewayRoutes | gateway-dynamic | gateway-dynamic/handler |
| `/api-governance` | APIGovernance | api-governance | api-governance/handler |
| `/middleware` | Middleware | middleware-ops | middleware-ops/handler |
| `/circuit-breaker` | CircuitBreaker | circuit-breaker | circuit-breaker/handler |
| `/autonomous-pipeline` | AutonomousPipeline | autonomous-pipeline | autonomous-pipeline/handler |
| `/orchestration` | Orchestration | orchestration | orchestration/handler |
| `/federation` | Federation | federation | federation/handler |
| `/governance` | Governance | governance | governance/handler |
| `/inception` | Inception | inception | inception/handler |
| `/risk-dashboard` | Risk | risk | risk/handler |
| `/traffic-governance` | TrafficGovernance | api-governance | api-governance/handler |
| `/ecosystem` | Ecosystem | — | — |
| `/delivery` | Delivery | — | — |
| `/infra` | Infrastructure | infrastructure | infrastructure/handler |
| `/ops` | Ops | — | — |
| `/settings` | Settings | config | config/handler |
| `/500` | Error500 | — | — |
| `/abac-policy` | ABACPolicy | abac-policy | abac-policy/handler |
| `/permission-audit` | PermissionAudit | permission-audit | permission-audit/handler |
| `/project-member` | ProjectMember | project-member | project-member/handler |
| `/ueba` | UEBA | ueba | ueba/handler |

---

## 十一、认证 Token 刷新流程

```
┌─────────────────────────────────────────────────────────────────┐
│                    前端 Token 刷新流程                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. 请求拦截器: authStore.getToken()                            │
│     ├── Token 有效 → 直接返回, 设置 Authorization header        │
│     └── Token 过期 → 进入刷新流程                              │
│                                                                 │
│  2. Token 刷新流程:                                             │
│     ├── 检查是否有刷新中的请求                                  │
│     │   ├── 有 → 将请求加入队列, 等待刷新完成                  │
│     │   └── 无 → 开始刷新                                      │
│     ├── POST /api/v1/auth/refresh { refreshToken }              │
│     ├── 成功 → store.setTokens(newAccess, newRefresh)           │
│     │        → 处理队列中的等待请求                              │
│     └── 失败 → store.logout()                                   │
│              → 跳转登录页                                        │
│                                                                 │
│  3. 401 响应拦截器:                                              │
│     ├── 排除 /api/v1/auth/ 路径 (防止无限循环)                  │
│     ├── 触发 Token 刷新                                        │
│     └── 重试原请求                                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 十二、统一架构健康度评分 (交互维度)

> 评分体系: 后端架构分层 (9.5) + 前端交互完整性 (7.0) + 前后端映射完整度 (7.5) = 综合 8.0/10
> 详细评分矩阵见 `docs/ARCH_BACKEND.md` 第十六章

| 维度 | 评分 | 说明 |
|------|------|------|
| REST API 映射完整度 | 8.0/10 | 196/315 已映射 (62%) |
| SSE 实时日志 | 9/10 | Pipeline 完整, 其他域未覆盖 |
| WebSocket 终端 | 8/10 | Visor 完整, 通用性待扩展 |
| NATS 事件驱动 | 8/10 | 9+ 订阅者, 链路完整 |
| 认证流程 | 9/10 | Token 刷新 + 队列机制完整 |
| 权限校验 | 3.0/10 | 前端仅 2.8% 页面有守卫 |
| 错误处理 | 7/10 | 统一错误格式, 前端错误提示 |
| Loading 状态 | 7/10 | 部分页面缺 loading |
| 空状态引导 | 6/10 | 部分页面缺 Empty 引导 |
| **交互映射综合** | **7.5/10** | |

---

## 十三、健康度改进建议

| 改进项 | 域 | 优先级 | 说明 |
|--------|----|--------|------|
| 前端权限守卫 | 跨域 | P0 | 敏感页面增加 usePermission |
| AI 模块后端 Handler | AI | P1 | ai-agents/ai-cost/ai-gateway 等缺 Handler |
| 前后端 API 命名对齐 | 跨域 | P1 | 137 个前端文件硬编码 `/api/v1` |
| SSE 扩展 | 可观测 | P2 | 除 Pipeline 外, 告警/部署也支持 SSE |
| Loading 状态统一 | 前端 | P2 | 所有异步操作加 loading |
| 空状态引导 | 前端 | P2 | 所有列表页加 Empty + 引导 |

---

> 数据来源: 前端 166 个 API 客户端 + 后端 27 个 Handler + 源码级路由映射
> 关联文档:
> - `docs/ARCH_FRONTEND.md` — 前端功能架构 (217 页面, 194 API 文件)
> - `docs/ARCH_BACKEND.md` — 后端功能架构 (286 模块, 10 域分类)
> - `docs/ALL_TODOS.md` — 统一待办清单 (P0 4 项, P1 9 项, P2 11 项)
> - `docs/architecture-review-2026-08-01.md` — 主统一报告 (1088 行, 9 章)
> - `docs/three-domain-depth-analysis-2026-08-01.md` — 三域专家深度分析