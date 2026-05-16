# S18 审批管理模块设计文档 (Approval Management)

> **模块编号**: S18
> **文档版本**: v1.0
> **创建日期**: 2026-05-15
> **状态**: 已实现
> **关联路由前缀**: `/api/v1/approvals/*`, `/api/v1/pipeline-runs/:runId/approvals/*`

---

## 一、模块概述

审批管理模块 (S18) 为 Orion 平台提供统一的工作流审批能力，覆盖部署发布、配置变更、Pipeline 执行等场景的人工审批需求。模块支持多级串行/并行审批链、紧急审批通道、审批模板复用以及 Pipeline 审批门禁四大核心能力。

### 1.1 核心场景

| 场景 | 说明 | 使用能力 |
|------|------|----------|
| 生产部署审批 | 生产环境部署前需多级审批 | 多级审批 + 审批模板 |
| 数据库变更审批 | 数据库结构变更需 DBA 审批 | 多级审批 + SLA 超时 |
| 紧急修复/回滚 | 生产事故快速响应 | 紧急审批通道 |
| Pipeline 审批门禁 | Pipeline 执行到特定 Stage 暂停等待审批 | Pipeline Approval Gate |
| 安全变更审批 | 安全相关变更需安全团队审批 | 审批模板 |

### 1.2 设计原则

- **统一审批引擎**: 将原先散落在 SelfHealing、QualityGate 等模块的审批能力集中管理
- **PostgreSQL 持久化**: 所有审批数据写入 PostgreSQL，不再使用内存 Map
- **多租户隔离**: 所有查询按 `tenant_id` 过滤
- **灵活审批链**: 支持串行（逐级）和并行（同时）两种审批模式

### 1.3 规格对齐

本文档与 `docs/services/approval/05-approval-workflow-spec.md` (Phase 2 规格) 对齐。规格中定义的完整能力分为以下实现阶段：

| 规格能力 | 当前实现 | 状态 |
|----------|----------|------|
| 统一审批引擎 | ApprovalController + 4 个 Service | ✅ 已实现 |
| 多级审批 | MultiLevelApprovalService (串行/并行) | ✅ 已实现 |
| 紧急通道 | EmergencyApprovalService (自动批准超时) | ✅ 已实现 |
| 审批模板 | ApprovalTemplateService (CRUD + 默认模板) | ✅ 已实现 |
| 审批 SLA | 前端 SLA 标签显示 | 🟡 部分实现 (后端自动升级/报表未实现) |
| 审批路由规则 | 按 resourceType 手动选择审批链 | 🟡 部分实现 (自动路由未实现) |
| 审批转交 (delegate) | — | ❌ 未实现 |
| 批量审批 | — | ❌ 未实现 |
| SLA 统计报表 API | — | ❌ 未实现 |

---

## 二、架构设计

### 2.1 分层架构

```
┌─────────────────────────────────────────────────────┐
│                   Frontend (React)                    │
│  orion-frontend/src/pages/approval/ApprovalPage.tsx  │
│  orion-frontend/src/pages/Approvals/index.tsx        │
│  orion-frontend/src/api/approvals.ts                 │
└────────────────────────┬────────────────────────────┘
                         │ HTTP
┌────────────────────────▼────────────────────────────┐
│               Fastify Routes Layer                    │
│  orion-platform-service/src/api/approval-routes.ts   │
│  ├── POST /api/v1/approvals/requests                 │
│  ├── GET  /api/v1/approvals/requests                 │
│  ├── GET  /api/v1/approvals/requests/:id             │
│  ├── POST /api/v1/approvals/requests/:id/review      │
│  ├── GET  /api/v1/approvals/pending                  │
│  ├── POST /api/v1/approvals/emergency                │
│  ├── POST /api/v1/approvals/templates                │
│  ├── GET  /api/v1/approvals/templates                │
│  ├── GET  /api/v1/pipeline-runs/:runId/approvals     │
│  ├── GET  /api/v1/pipeline-runs/:runId/stages/:      │
│  │                              stageId/approval     │
│  ├── POST /api/v1/pipeline-runs/:runId/stages/:      │
│  │                              stageId/approve      │
│  └── POST /api/v1/pipeline-runs/:runId/stages/:      │
│                                 stageId/reject       │
└────────────────────────┬────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────┐
│                  Controller Layer                     │
│  src/api/controllers/ApprovalController.ts            │
│  ├── submitApprovalRequest()                          │
│  ├── listApprovalRequests()                           │
│  ├── getApprovalRequest()                             │
│  ├── reviewApproval()                                 │
│  ├── getPendingApprovals()                            │
│  ├── requestEmergencyApproval()                       │
│  ├── createTemplate() / getTemplates()                │
│  └── listByRun() / getStatus() / approve() / reject() │
└────────┬──────────┬──────────┬───────────────────────┘
         │          │          │
┌────────▼───┐ ┌────▼─────┐ ┌──▼──────────┐ ┌─────────────────────┐
│ MultiLevel │ │Emergency │ │Approval     │ │ ApprovalGateService │
│ Approval   │ │Approval  │ │Template     │ │ (pipeline/)         │
│ Service    │ │Service   │ │Service      │ │                     │
│ (approval/)│ │(approval/)│ │(approval/)  │ │                     │
└────────┬───┘ └────┬─────┘ └──┬──────────┘ └──────────┬──────────┘
         │          │          │                        │
┌────────▼──────────▼──────────▼────────────────────────▼──────────┐
│                    Data Access Layer                              │
│  src/repositories/ApprovalRepository.ts                          │
│  ├── approvals 表: 审批主表                                        │
│  ├── approval_steps 表: 审批步骤                                  │
│  ├── approval_templates 表: 审批模板                               │
│  src/repositories/ApprovalGateRepository.ts                       │
│  ├── approval_gates 表: Pipeline 审批门禁                          │
└──────────────────────────────────────────────────────────────────┘
```

### 2.2 服务依赖关系

```
ApprovalController
  ├── MultiLevelApprovalService(db)         → 多级审批核心引擎
  ├── EmergencyApprovalService(db)          → 紧急审批通道
  ├── ApprovalTemplateService(pool)         → 审批模板管理
  └── ApprovalGateService({repository})     → Pipeline 审批门禁
```

所有 Service 在 `approval-routes.ts` 中通过 `DatabasePool` 或 `Pool` 初始化，要求数据库连接可用，否则抛出异常。

---

## 三、多级审批链

### 3.1 核心概念

`MultiLevelApprovalService` 实现多级审批工作流，支持两种模式：

| 模式 | 枚举值 | 行为 |
|------|--------|------|
| 串行 (Serial) | `ApprovalMode.SERIAL` | 逐级审批，上一级完成后下一级才变为 `pending`，之前为 `waiting` |
| 并行 (Parallel) | `ApprovalMode.PARALLEL` | 所有审批人同时可审批，无先后顺序 |

### 3.2 审批层级结构

```typescript
interface ApprovalLevel {
  levelIndex: number;         // 层级索引 (0, 1, 2, ...)
  approverIds: string[];      // 该层级的审批人 ID 列表
  requiredApprovals: number;  // 该层级需要通过的最少人数
}
```

### 3.3 审批流程

```
提交审批请求
    │
    ├── 创建 ApprovalEntity (status='pending')
    │   ├── 串行模式: 第一级 steps → 'pending', 后续 → 'waiting'
    │   └── 并行模式: 所有 steps → 'pending'
    │
    ▼
审批人 review(approve/reject)
    │
    ├── 拒绝: 整体状态立即变更为 'rejected' (一票否决)
    │
    └── 通过:
        ├── 已通过数 >= requiredApprovals → 整体 'approved'
        └── 未达到要求 → advanceStep() → 激活下一级 waiting steps
```

### 3.4 核心 API

| 方法 | 描述 |
|------|------|
| `submitApprovalRequest(tenantId, input)` | 提交多级审批请求，自动创建所有审批步骤 |
| `review(requestId, reviewerId, action, comment)` | 审批人执行 approve/reject |
| `getApprovalChain(requestId)` | 获取完整审批链及每个步骤的状态 |
| `getPendingApprovals(userId, tenantId)` | 获取指定用户的待审批列表 |
| `isApproved(requestId)` | 检查审批是否已全部批准 |

### 3.5 关键实现细节

- **一票否决**: 任何审批人执行 `reject` 操作，整个审批请求立即变更为 `rejected` 状态
- **层级激活**: 串行模式下，当前层级审批完成后，`advanceStep()` 推进 `currentStep`，然后 `activateCurrentLevelSteps()` 将下一层级的 `waiting` 步骤激活为 `pending`
- **模式检测**: 通过检查是否存在 `waiting` 状态的步骤来判断当前审批是串行还是并行模式

---

## 四、紧急审批流程

### 4.1 设计目的

生产事故修复、安全漏洞修补等紧急场景下，需要缩短审批链路，快速获得审批通过。

### 4.2 紧急审批类型

```typescript
enum EmergencyReason {
  PRODUCTION_INCIDENT = 'production_incident',    // 生产事故
  SECURITY_VULNERABILITY = 'security_vulnerability', // 安全漏洞
  SERVICE_OUTAGE = 'service_outage',              // 服务中断
  DATA_CORRUPTION = 'data_corruption',            // 数据损坏
  OTHER = 'other',                                // 其他
}
```

### 4.3 紧急审批特性

| 特性 | 说明 | 默认值 |
|------|------|--------|
| 最少审批数 | 紧急审批只需 1 人审批即可通过 | `requiredApprovals = 1` |
| 自动批准超时 | 超时未处理时系统自动批准 | `autoApproveTimeoutMs = 300000` (5 分钟) |
| 标记前缀 | 标题自动添加 `[EMERGENCY]` 前缀 | - |
| 审计日志 | 所有紧急审批操作通过 `logger.warn` 记录 | - |

### 4.4 紧急审批流程

```
发起紧急审批
    │
    ├── 创建 ApprovalEntity (result.isEmergency = true)
    ├── 创建审批步骤 (每个审批人一个 step)
    ├── 记录 warn 日志
    │
    ▼
等待审批
    │
    ├── 手动批准: approveEmergency(requestId, reviewerId, comment)
    │   └── 验证审批人权限 → 更新步骤状态 → 更新整体状态为 'approved'
    │
    ├── 自动批准: autoApproveIfEmergency(requestId)
    │   ├── 检查 elapsed >= autoApproveTimeoutMs
    │   ├── 满足条件 → updateStatus('approved')
    │   └── 记录 warn 日志 (reason: 'timeout_auto_approve')
    │
    └── 未超时 → 返回 pending 状态及剩余时间
```

### 4.5 配置管理

`EmergencyApprovalService` 提供运行时配置接口：

```typescript
service.setAutoApproveTimeoutMs(600_000);  // 修改为 10 分钟
service.getAutoApproveTimeoutMs();          // 获取当前超时值
```

---

## 五、审批模板

### 5.1 目的

提供可复用的审批工作流定义，避免每次创建审批时重复配置层级和审批人。

### 5.2 模板结构

```typescript
interface ApprovalTemplate {
  id: string;
  tenantId: string;
  name: string;                  // 模板名称，如 "生产部署审批"
  description: string | null;
  resourceType: string;          // 关联资源类型
  levels: ApprovalTemplateLevel[];
  mode: 'serial' | 'parallel';
  isDefault: boolean;            // 是否为该 resourceType 的默认模板
  createdAt: Date;
  updatedAt: Date;
}
```

### 5.3 默认模板机制

当创建模板时设置 `isDefault = true`，系统自动取消同 `resourceType` 下其他模板的默认标记：

```sql
UPDATE approval_templates SET is_default = false
WHERE tenant_id = $1 AND resource_type = $2 AND is_default = true
```

查询时默认模板排在最前：

```sql
SELECT * FROM approval_templates
WHERE tenant_id = $1
ORDER BY is_default DESC, created_at DESC
```

### 5.4 前端预置模板

前端 `ApprovalPage.tsx` 中硬编码了 4 个常用模板供快速选择：

| 模板 ID | 名称 | 审批角色 | 所需审批数 | SLA |
|---------|------|----------|-----------|-----|
| `deployment` | 生产部署审批 | tech-lead, ops-manager | 2 | 60 分钟 |
| `database` | 数据库变更审批 | dba, tech-lead | 2 | 120 分钟 |
| `security` | 安全审批 | security-lead | 1 | 30 分钟 |
| `infrastructure` | 基础设施审批 | sre-lead, ops-manager | 2 | 120 分钟 |

> **注意**: 前端模板为 UI 快捷选择，与后端 `ApprovalTemplateService` 中的持久化模板是独立的两套机制。

### 5.5 模板 API

| 方法 | 描述 |
|------|------|
| `createTemplate(tenantId, input)` | 创建审批模板 |
| `getTemplates(tenantId)` | 获取租户下所有模板（默认排序模板在前） |
| `getTemplate(templateId)` | 获取单个模板详情 |
| `getDefaultTemplate(tenantId, resourceType)` | 获取指定资源类型的默认模板 |
| `deleteTemplate(templateId, tenantId)` | 删除模板 |

---

## 六、Pipeline 审批门禁

### 6.1 设计目的

在 Pipeline 执行过程中，当到达配置的审批 Stage 时自动暂停，等待人工审批通过后才能继续执行后续 Stage。

### 6.2 架构关系

```
PipelineEngine 执行到审批 Stage
    │
    ├── StageExecutor 检测到审批配置
    ├── 调用 ApprovalGateService.requestApproval()
    │   └── 创建 ApprovalGate (status='pending')
    │
    ▼
Pipeline 暂停执行该 Stage
    │
    ├── 前端轮询 /pipeline-runs/:runId/stages/:stageId/approval
    │   └── 返回 { canProceed: false, status: 'pending', message }
    │
    ▼
审批人审批
    │
    ├── approve(runId, stageId, userId, comment) → status='approved'
    │   └── PipelineEngine 检测到 canProceed=true → 继续执行
    │
    └── reject(runId, stageId, userId, comment) → status='rejected'
        └── Pipeline 标记该 Stage 为失败
```

### 6.3 审批门禁状态机

```
pending ──approve──→ approved  (Stage 可继续执行)
   │
   ├──reject──→ rejected       (Stage 终止)
   │
   └──cancel──→ cancelled      (Pipeline 取消)
```

### 6.4 核心 API

| 方法 | 描述 |
|------|------|
| `requestApproval(input)` | Pipeline Engine 调用，创建审批门禁 |
| `createGate(tenantId, input)` | 直接创建审批门禁记录 |
| `getByRun(runId)` | 获取某次 Pipeline Run 的所有审批门禁 |
| `getStatus(runId, stageId)` | 获取特定 Stage 的审批状态（含 `canProceed` 标志） |
| `approve(runId, stageId, userId, comment)` | 审批通过 |
| `reject(runId, stageId, userId, comment)` | 审批拒绝 |
| `cancelGate(runId, stageId)` | 取消审批门禁 |
| `isApprovalRequired(runId, stageId)` | 检查 Stage 是否有待处理的审批 |
| `getPendingByApprover(approverId, tenantId)` | 获取待某审批人处理的门禁列表 |

### 6.5 数据表

`approval_gates` 表结构：

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | VARCHAR(64) PK | 门禁唯一标识 |
| `tenant_id` | VARCHAR(64) NOT NULL | 租户 ID |
| `run_id` | VARCHAR(64) NOT NULL | Pipeline Run ID |
| `stage_id` | VARCHAR(64) NOT NULL | Stage ID |
| `status` | VARCHAR(20) | pending/approved/rejected/cancelled |
| `requested_by` | VARCHAR(64) | 请求人 |
| `approver_ids` | TEXT[] | 审批人 ID 数组 |
| `reviewed_by` | VARCHAR(64) | 审批人 |
| `reviewed_at` | TIMESTAMP | 审批时间 |
| `comment` | TEXT | 审批意见 |
| `metadata` | JSONB | 附加信息 (stageName, reason 等) |
| `created_at` | TIMESTAMP | 创建时间 |
| `updated_at` | TIMESTAMP | 更新时间 |

---

## 七、API 端点参考

### 7.1 多级审批

| 方法 | 路径 | 认证 | 描述 |
|------|------|------|------|
| `POST` | `/api/v1/approvals/requests` | 需要 | 提交审批请求 |
| `GET` | `/api/v1/approvals/requests` | 需要 | 审批列表 |
| `GET` | `/api/v1/approvals/requests/:id` | 需要 | 审批详情 |
| `POST` | `/api/v1/approvals/requests/:id/review` | 需要 | 执行审批操作 |
| `GET` | `/api/v1/approvals/pending` | 需要 | 待审批列表 (按 userId 查询) |

**请求示例 — 提交多级审批**:

```json
POST /api/v1/approvals/requests
{
  "title": "生产环境部署 user-service v2.4",
  "description": "新增用户画像功能，影响 3 个下游服务",
  "requesterId": "alice",
  "resourceType": "deployment",
  "resourceId": "user-service-v2.4",
  "levels": [
    { "levelIndex": 0, "approverIds": ["tech-lead"], "requiredApprovals": 1 },
    { "levelIndex": 1, "approverIds": ["ops-manager", "sre-lead"], "requiredApprovals": 2 }
  ],
  "mode": "serial"
}
```

**请求示例 — 审批操作**:

```json
POST /api/v1/approvals/requests/approval_xxx/review
{
  "reviewerId": "tech-lead",
  "action": "approve",
  "comment": "代码审查通过，建议灰度发布"
}
```

### 7.2 紧急审批

| 方法 | 路径 | 认证 | 描述 |
|------|------|------|------|
| `POST` | `/api/v1/approvals/emergency` | 需要 | 发起紧急审批 |

**请求示例**:

```json
POST /api/v1/approvals/emergency
{
  "title": "紧急回滚 payment-service",
  "description": "支付成功率降至 60%，需立即回滚至 v1.8",
  "requesterId": "on-call-engineer",
  "resourceType": "emergency-rollback",
  "resourceId": "payment-service",
  "reason": "production_incident",
  "impactDescription": "每小时影响约 5000 笔支付交易",
  "approverIds": ["on-call-lead"]
}
```

### 7.3 审批模板

| 方法 | 路径 | 认证 | 描述 |
|------|------|------|------|
| `POST` | `/api/v1/approvals/templates` | 需要 | 创建审批模板 |
| `GET` | `/api/v1/approvals/templates` | 需要 | 获取模板列表 |

**请求示例**:

```json
POST /api/v1/approvals/templates
{
  "name": "数据库变更审批",
  "description": "数据库结构变更需 DBA 和技术负责人双重审批",
  "resourceType": "database",
  "levels": [
    { "levelIndex": 0, "approverIds": ["dba"], "requiredApprovals": 1 },
    { "levelIndex": 1, "approverIds": ["tech-lead"], "requiredApprovals": 1 }
  ],
  "mode": "serial",
  "isDefault": true
}
```

### 7.4 Pipeline 审批门禁

| 方法 | 路径 | 认证 | 描述 |
|------|------|------|------|
| `GET` | `/api/v1/pipeline-runs/:runId/approvals` | 需要 | 获取 Run 的所有审批门禁 |
| `GET` | `/api/v1/pipeline-runs/:runId/stages/:stageId/approval` | 需要 | 获取 Stage 审批状态 |
| `POST` | `/api/v1/pipeline-runs/:runId/stages/:stageId/approve` | 需要 | 审批通过 |
| `POST` | `/api/v1/pipeline-runs/:runId/stages/:stageId/reject` | 需要 | 审批拒绝 |

### 7.5 规划中的 API (规格定义，待实现)

#### 审批操作扩展

| 方法 | 路径 | 描述 |
|------|------|------|
| `POST` | `/api/v1/approvals/requests/:id/delegate` | 转交审批给他人 |
| `POST` | `/api/v1/approvals/requests/:id/batch-respond` | 批量审批多个请求 |

#### 审批 SLA API (`/api/v1/approvals/sla`)

| 方法 | 路径 | 描述 |
|------|------|------|
| `GET` | `/sla/stats` | 获取 SLA 统计（总请求数、平均响应时间、SLA 合规率） |
| `GET` | `/sla/report` | 获取 SLA 报告（按审批人/风险等级分组） |
| `GET` | `/sla/overdue` | 获取超时审批列表 |

规格定义的 `SLAStats` 结构：

```typescript
interface SLAStats {
  totalRequests: number;
  approvedCount: number;
  rejectedCount: number;
  expiredCount: number;
  averageResponseTimeMs: number;
  medianResponseTimeMs: number;
  slaComplianceRate: number;            // 在 SLA 内完成的百分比
  byApprover: Array<{
    approverId: string;
    approverName: string;
    totalReviews: number;
    avgResponseTimeMs: number;
    slaComplianceRate: number;
  }>;
  byRiskLevel: Array<{
    riskLevel: string;
    count: number;
    avgResponseTimeMs: number;
  }>;
}
```

#### 审批路由规则 API (`/api/v1/approvals/routing`)

| 方法 | 路径 | 描述 |
|------|------|------|
| `GET` | `/rules` | 获取审批路由规则 |
| `POST` | `/rules` | 创建路由规则 |
| `PUT` | `/rules/:id` | 更新路由规则 |
| `DELETE` | `/rules/:id` | 删除路由规则 |

规格定义的 `RoutingRuleInput`：

```typescript
interface RoutingRuleInput {
  name: string;
  conditions: {
    type?: string;                      // 审批类型
    riskLevel?: string;                 // 风险等级
    amount?: { min: number; max: number }; // 金额范围
    environment?: string;               // 环境
    service?: string;                   // 服务
  };
  approvalChain: Array<{
    level: number;
    role: string;
    slaMinutes: number;
  }>;
  priority: number;                     // 规则优先级（数字越小越优先）
  enabled: boolean;
}
```

#### 审批模板扩展 API

规格定义的完整 `TemplateInput` 包含动态字段配置和通知渠道：

```typescript
interface TemplateInput {
  name: string;
  description: string;
  type: string;
  riskLevels: string[];
  approvalChain: Array<{
    level: number;
    role: string;
    slaMinutes: number;
  }>;
  defaultSLAMinutes: number;
  fields: Array<{
    name: string;
    label: string;
    type: 'text' | 'number' | 'select' | 'textarea';
    required: boolean;
    options?: string[];
  }>;
  notificationChannels: string[];
}
```

---

## 八、数据模型

### 8.1 当前实现的数据模型

#### ApprovalEntity (审批主表)

```typescript
interface ApprovalEntity {
  id: string;
  tenantId: string;
  definitionId: string | null;       // 关联的审批定义 ID
  resourceType: string;              // 资源类型: deployment/database/service/...
  resourceId: string;                // 关联资源 ID
  title: string | null;
  status: string;                    // pending / approved / rejected
  requestedBy: string | null;
  currentStep: number;               // 当前步骤索引
  totalSteps: number;                // 总步骤数
  requiredApprovals: number;         // 需要通过的最少审批数
  result: Record<string, any> | null; // 审批结果 (紧急审批时含 isEmergency 等)
  completedAt: Date | null;
  createdAt: Date;
}
```

#### ApprovalStepEntity (审批步骤)

```typescript
interface ApprovalStepEntity {
  id: string;
  approvalId: string;
  stepIndex: number;
  approverId: string | null;
  status: string;                    // pending / waiting / approved / rejected
  comment: string | null;
  actedAt: Date | null;
}
```

### 8.2 规格定义的扩展模型 (待实现)

规格文档中定义了更完整的 `ApprovalRequestInput`，支持来源模块追踪、风险等级评估和 SLA 配置：

```typescript
interface ApprovalRequestInput {
  title: string;
  description: string;
  type: 'deployment' | 'change' | 'budget-exemption' | 'config-change' | 'emergency' | 'custom';
  sourceModule: string;                   // 'self-healing' | 'quality-gate' | 'budget-gate' | 'pipeline'
  sourceId: string;                       // 关联的源模块 ID
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  urgency: 'normal' | 'urgent' | 'emergency';
  metadata: Record<string, unknown>;
  approvalChainTemplate?: string;         // 审批链模板 ID
  customApprovers?: string[];             // 自定义审批人（覆盖模板）
  slaMinutes?: number;                    // 自定义 SLA
  emergencyReason?: string;               // 紧急通道原因
}
```

规格定义的完整 `ApprovalRequest` 响应结构：

```typescript
interface ApprovalRequest {
  id: string;
  title: string;
  description: string;
  type: string;
  sourceModule: string;
  sourceId: string;
  riskLevel: string;
  urgency: string;
  status: 'pending' | 'in_review' | 'approved' | 'rejected' | 'expired' | 'emergency-processed' | 'emergency-pending-review';
  requesterId: string;
  metadata: Record<string, unknown>;
  approvalChain: ApprovalLevel[];
  currentLevel: number;
  createdAt: Date;
  slaDeadline: Date;
  completedAt?: Date;
}
```

规格定义的扩展 `ApprovalLevel`（支持转交、SLA、角色）：

```typescript
interface ApprovalLevel {
  level: number;
  approverId: string;
  approverName: string;
  role: string;                          // 'tech-lead' | 'manager' | 'cto' | 'admin'
  status: 'pending' | 'approved' | 'rejected' | 'delegated' | 'skipped';
  requestedAt: Date;
  respondedAt?: Date;
  comment?: string;
  delegateTo?: string;
  slaMinutes: number;
}
```

### 8.3 规格定义的扩展数据表 (待实现)

#### approval_history (审批历史)

```sql
CREATE TABLE IF NOT EXISTS approval_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_id     UUID NOT NULL REFERENCES approval_requests(id) ON DELETE CASCADE,
  tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE,
  level           INT NOT NULL,
  approver_id     UUID REFERENCES users(id),
  action          VARCHAR(20) NOT NULL,    -- approve/reject/delegate/escalate/timeout
  comment         TEXT,
  delegate_to     UUID REFERENCES users(id),
  response_time_ms BIGINT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_approval_hist_approval ON approval_history(approval_id);
CREATE INDEX idx_approval_hist_approver ON approval_history(approver_id, created_at DESC);
```

#### approval_routing_rules (审批路由规则)

```sql
CREATE TABLE IF NOT EXISTS approval_routing_rules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name            VARCHAR(200) NOT NULL,
  conditions      JSONB NOT NULL,          -- {type, riskLevel, amount, environment, service}
  approval_chain  JSONB NOT NULL,
  priority        INT NOT NULL DEFAULT 100,
  enabled         BOOLEAN NOT NULL DEFAULT true,
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_approval_routing_tenant ON approval_routing_rules(tenant_id, priority);
```

> **说明**: 当前实现使用 `approvals` + `approval_steps` 两表结构，规格中定义的 `approval_requests` 表在功能上与 `approvals` 等价。后续迁移时可通过 alias 或迁移脚本统一。

### 8.4 数据库表总览

| 表名 | 状态 | 用途 |
|------|------|------|
| `approvals` | ✅ 已实现 | 审批主表 |
| `approval_steps` | ✅ 已实现 | 审批步骤 |
| `approval_templates` | ✅ 已实现 | 审批模板 |
| `approval_gates` | ✅ 已实现 | Pipeline 门禁 |
| `approval_history` | ❌ 待实现 | 审批历史（独立于 steps 的完整审计日志） |
| `approval_routing_rules` | ❌ 待实现 | 审批路由规则（按风险等级/类型自动匹配审批链） |

---

## 九、前端页面结构

### 9.1 页面文件

| 文件路径 | 说明 |
|----------|------|
| `orion-frontend/src/pages/approval/ApprovalPage.tsx` | 审批管理主页面 (M33) |
| `orion-frontend/src/pages/Approvals/index.tsx` | 审批列表页（基础版） |
| `orion-frontend/src/pages/approval-svc/Approvals/index.tsx` | 审批服务页面 |
| `orion-frontend/src/api/approvals.ts` | 审批 API 客户端 |

### 9.2 页面布局 (`ApprovalPage.tsx`)

```
┌──────────────────────────────────────────────────────┐
│ 审批工作流                              [刷新][创建][紧急审批] │
├──────────────────────────────────────────────────────┤
│  统计面板                                              │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐                  │
│  │ 总计  │ │待审批 │ │已通过 │ │已拒绝 │                 │
│  │  24  │ │  8   │ │  14  │ │  2   │                 │
│  └──────┘ └──────┘ └──────┘ └──────┘                  │
├──────────────────────────────────────────────────────┤
│  [搜索框 320px]         [状态筛选: 全部▼]               │
├──────────────────────────────────────────────────────┤
│  审批列表表格                                          │
│  ┌──────┬──────┬────────┬──────┬──────┬──────┬─────┐ │
│  │标题   │状态  │审批进度 │SLA   │审批人 │时间  │操作  │ │
│  ├──────┼──────┼────────┼──────┼──────┼──────┼─────┤ │
│  │...   │待审批│ 1/3    │2h    │👤👤👤│2h前  │详情通过拒绝│ │
│  └──────┴──────┴────────┴──────┴──────┴──────┴─────┘ │
└──────────────────────────────────────────────────────┘
```

### 9.3 核心功能组件

| 组件 | 说明 |
|------|------|
| `StatsPanel` | 统计面板：显示总计、待审批、已通过、已拒绝数量 |
| 审批进度条 | `Progress` 组件显示 `approvals.length / requiredApprovals` |
| SLA 标签 | 根据创建时间计算：>24h=已超时(红色)、>12h=即将超时(黄色)、否则显示经过时间 |
| 审批人头像 | `Avatar` 列表，已通过=绿色、已拒绝=红色、待审批=灰色 |
| 审批流程步骤 | Detail Drawer 中使用 `Steps` 垂直布局展示审批链 |
| 审批评论时间线 | `Timeline` 组件展示每条审批记录（审批人、动作、评论、时间） |
| 评论弹窗 | `Modal` 提供审批通过/拒绝时填写评论理由 |

### 9.4 创建审批弹窗

包含模板快速选择区和表单：
- **模板快捷按钮**: 生产部署审批、数据库变更审批、安全审批、基础设施审批
- **表单字段**: 标题、描述、申请人、审批人列表（逗号分隔）、所需通过数、资源类型

### 9.5 紧急审批弹窗

- 警告提示: "紧急审批仅需 1 人审批即可通过，请确保情况属实"
- 表单字段: 标题、紧急原因说明、申请人、资源类型（紧急部署/紧急回滚/安全修复/基础设施）、审批人

---

## 十、集成点

### 10.1 Pipeline Engine 集成

`PipelineEngine` → `StageExecutor` 在执行到配置了审批要求的 Stage 时：

1. 调用 `ApprovalGateService.requestApproval()` 创建审批门禁
2. 暂停 Stage 执行，等待审批结果
3. 轮询 `getStatus(runId, stageId)` 检查 `canProceed` 标志
4. `canProceed = true` 时继续执行后续 Stage
5. `status = 'rejected'` 时标记 Stage 失败

### 10.2 Deploy Service 集成

部署服务在以下场景调用审批模块：
- 生产环境部署前创建审批请求（使用 `deployment` 类型模板）
- 回滚操作可使用紧急审批通道
- 部署完成后更新关联审批请求的状态

### 10.3 配置管理集成

配置变更服务在高风险配置修改时：
- 自动创建审批请求并关联 `resourceType = 'config-change'`
- 使用审批模板确定审批链
- 审批通过后才执行配置变更

### 10.4 事件总线集成 (待实现)

当前审批模块缺少事件通知集成：
- 审批创建时应发布 `approval.created` 事件
- 审批完成时应发布 `approval.completed` 事件
- 紧急审批超时时应发布 `approval.emergency_timeout` 事件
- 待接入 NATS EventBus 实现邮件/Slack 通知

### 10.5 SelfHealing 审批集成

SelfHealingService 原有的自愈审批能力（`self_healing_approvals` 表）应当迁移到统一审批引擎，复用 `MultiLevelApprovalService` 的多级审批能力。

---

## 十一、SLA 与超时处理

### 11.1 SLA 机制

| 类型 | 超时行为 | 默认值 |
|------|----------|--------|
| 普通审批 | 前端显示 SLA 状态（正常/即将超时/已超时），后端暂无自动处理 | 前端阈值: 12h 预警, 24h 超时 |
| 紧急审批 | 超时后自动批准 (`autoApproveIfEmergency`) | 5 分钟 (`autoApproveTimeoutMs`) |
| Pipeline 门禁 | 无超时机制，必须人工审批 | - |

### 11.2 紧急审批自动批准流程

```
autoApproveIfEmergency(requestId)
    │
    ├── 查找审批请求 → 验证 status='pending' 且 result.isEmergency=true
    │
    ├── elapsed = Date.now() - entity.createdAt.getTime()
    │
    ├── elapsed < timeoutMs
    │   └── 返回 { status: 'pending', autoApproved: false }
    │
    └── elapsed >= timeoutMs
        ├── updateStatus(requestId, 'approved')
        ├── 记录 warn 日志 (reason: 'timeout_auto_approve')
        └── 返回 { status: 'approved', autoApproved: true, approvedBy: 'system' }
```

### 11.3 规格定义的 SLA 能力 (待实现)

规格要求实现完整的 SLA 监控体系：

| 规格项 | 要求 | 验证方式 |
|--------|------|----------|
| S1 | 追踪每个审批的响应时间 | 单元测试 |
| S2 | SLA 告警（超过 SLA 时间未审批） | 集成测试 |
| S3 | SLA 报表（平均响应时间、超时率、按审批人） | API 测试 |
| S4 | 审批超时自动升级到下一级 | 集成测试 |

具体实现需补充：

1. **普通审批超时自动升级**: 超过 SLA 时间未审批时，自动升级到上级审批人或管理员
2. **SLA 统计报表 API**: `/api/v1/approvals/sla/stats` 和 `/report`，提供平均响应时间、超时率、按审批人/风险等级分组统计
3. **可配置 SLA**: 审批模板中应支持配置 `slaMinutes` 字段，创建审批时自动计算 `slaDeadline`
4. **定时任务**: 需要定时任务扫描超时审批，触发自动升级或告警
5. **response_time_ms 记录**: 在 `approval_history` 表中记录每次审批的响应时间（毫秒级）

### 11.4 SLA 状态计算 (前端已实现)

```typescript
const getSLAStatus = (record: ApprovalRequest): { label: string; color: string; expired: boolean } => {
  if (record.status !== 'pending') return { label: '已完成', color: 'success', expired: false };
  const hours = dayjs().diff(record.createdAt, 'hours');
  if (hours > 24) return { label: '已超时', color: 'error', expired: true };
  if (hours > 12) return { label: '即将超时', color: 'warning', expired: false };
  return { label: `${hours}h`, color: 'processing', expired: false };
};
```

---

## 十二、测试覆盖

### 12.1 单元测试

| 文件 | 覆盖范围 |
|------|----------|
| `services/approval/__tests__/ApprovalService.test.ts` | 审批创建、审批操作、状态验证 |
| `services/approval/__tests__/approval-workflow-integration.test.ts` | 多级审批完整流程、串行/并行模式 |
| `services/pipeline/__tests__/ApprovalGateService.test.ts` | 门禁创建、审批通过/拒绝、状态查询 |

### 12.2 关键测试场景

| 场景 | 验证点 |
|------|--------|
| 串行多级审批 | L1 批准 → L2 激活 → L2 批准 → 整体批准 |
| 并行审批 | 所有审批人同时可审批，达到 requiredApprovals 后通过 |
| 一票否决 | 任一层级拒绝 → 整体 rejected |
| 紧急审批超时 | 超时后自动批准，approvedBy='system' |
| 权限验证 | 非审批人操作 → 抛出 'Not authorized' |
| Pipeline 门禁 | approve 后 canProceed=true，reject 后 canProceed=false |

---

## 十三、当前实现状态与待完善项

### 13.1 已实现

- [x] 多级串行/并行审批 (`MultiLevelApprovalService`)
- [x] 紧急审批通道 + 自动批准超时 (`EmergencyApprovalService`)
- [x] 审批模板 CRUD (`ApprovalTemplateService`)
- [x] Pipeline 审批门禁 (`ApprovalGateService` + `ApprovalGateRepository`)
- [x] PostgreSQL 持久化 (`ApprovalRepository`)
- [x] 前端审批管理页面 (`ApprovalPage.tsx`)
- [x] API 路由注册 + 认证中间件 (`approval-routes.ts`)

### 13.2 待完善

- [ ] NATS EventBus 集成（审批通知推送）
- [ ] SLA 自动升级（超时升级至上级/管理员）
- [ ] SLA 统计报表 API（平均响应时间、超时率）
- [ ] 审批路由规则（按风险等级/资源类型自动匹配审批链）
- [ ] SelfHealing 审批迁移到统一审批引擎
- [ ] 审批转交（delegate）功能
- [ ] 批量审批功能
- [ ] 前端审批模板管理页面（当前模板仅前端硬编码）
- [ ] 前端 Pipeline 审批门禁展示

---

## 十四、相关文件索引

### 后端

| 文件 | 说明 |
|------|------|
| `orion-platform-service/src/api/approval-routes.ts` | 路由注册 (~160 行) |
| `orion-platform-service/src/api/controllers/ApprovalController.ts` | 控制器 (~440 行) |
| `orion-platform-service/src/services/approval/MultiLevelApprovalService.ts` | 多级审批服务 (~315 行) |
| `orion-platform-service/src/services/approval/EmergencyApprovalService.ts` | 紧急审批服务 (~215 行) |
| `orion-platform-service/src/services/approval/ApprovalTemplateService.ts` | 审批模板服务 (~205 行) |
| `orion-platform-service/src/services/approval/ApprovalRepository.ts` | 审批数据访问层 (~135 行) |
| `orion-platform-service/src/services/approval/ApprovalService.ts` | 基础审批服务 |
| `orion-platform-service/src/services/approval/index.ts` | 模块导出 |
| `orion-platform-service/src/services/pipeline/ApprovalGateService.ts` | Pipeline 审批门禁 (~325 行) |
| `orion-platform-service/src/repositories/ApprovalRepository.ts` | 审批 Repository (~135 行) |
| `orion-platform-service/src/repositories/ApprovalGateRepository.ts` | 审批门禁 Repository (~240 行) |

### 前端

| 文件 | 说明 |
|------|------|
| `orion-frontend/src/pages/approval/ApprovalPage.tsx` | 审批管理主页面 (~780 行) |
| `orion-frontend/src/pages/Approvals/index.tsx` | 审批列表页 |
| `orion-frontend/src/pages/approval-svc/Approvals/index.tsx` | 审批服务页面 |
| `orion-frontend/src/api/approvals.ts` | 审批 API 客户端 |

### 相关文档

| 文件 | 说明 |
|------|------|
| `docs/services/approval/05-approval-workflow-spec.md` | 审批工作流详细规格 (Phase 2) |
| `docs/superpowers/specs/phase2/05-approval-workflow-spec.md` | 原始规格文档 |
| `docs/frontend/审批组件库.md` | 前端审批组件库设计 |
