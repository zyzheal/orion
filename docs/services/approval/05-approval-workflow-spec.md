# 审批工作流详细规格 (Phase 2)

> **日期**: 2026-05-05
> **状态**: 已验证
> **能力域**: 审批工作流
> **目标成熟度**: L1 → L1.5
> **关键交付**: 多级审批、紧急通道

## 一、功能描述

### 1.1 现状评估 (L1)

Orion 当前已实现：
- **SelfHealingService 审批** (`services/self-healing/SelfHealingService.ts`)：自愈审批请求（ApprovalRequest），含风险级别评估、审批超时（5 分钟）、审批响应（批准/拒绝）、PostgreSQL Repository 持久化（`self_healing_approvals` 表）
- **质量门禁豁免**（Phase 1 规格中设计）：豁免申请、审批链、有效期、自动过期
- **风险等级评估**：基于环境（production=high, staging=medium, other=low）
- **SelfHealingGuardian**：双重审批配置（`DualApprovalConfig`）、风暴抑制规则

**不足**：
- 审批能力分散在各个模块（SelfHealing、QualityGate），无统一审批工作流引擎
- 审批仅单级（一个审批人），无多级审批链（申请人 → 主管 → 技术负责人 → CTO）
- 无紧急通道（紧急情况下跳过正常审批流程，事后审计）
- 审批模板缺失（每次创建审批需手写详情，无预置模板）
- 审批通知仅内部系统通知，无外部渠道（Slack/邮件）
- 无审批 SLA 监控（审批超时仅 SelfHealing 有 5 分钟超时，无 SLA 追踪）

### 1.2 Phase 2 目标 (L1.5)

| 功能模块 | 描述 | 验收等级 |
|----------|------|:--------:|
| 统一审批引擎 | 集中管理所有审批请求，支持多级审批链 | L1.5 |
| 多级审批 | 按风险等级/金额/变更类型自动路由到不同审批链 | L1.5 |
| 紧急通道 | 紧急情况可跳过审批，事后补审批并审计 | L1.5 |
| 审批模板 | 预置审批模板（部署/变更/预算豁免/配置变更） | L1.5 |
| 审批 SLA | 审批时效监控、超时告警、SLA 报表 | L1.5 |

## 二、验收标准

### 2.1 统一审批引擎

| # | 标准 | 验证方式 |
|---|------|----------|
| E1 | 统一 API 接收所有模块的审批请求 | API 测试 |
| E2 | 审批请求关联源模块（self-healing/deployment/budget/config） | API 测试 |
| E3 | 审批状态机：pending → in_review → approved/rejected/expired | 单元测试 |
| E4 | 审批历史可查询（含审批链完整记录） | API 测试 |
| E5 | 支持批量审批 | API 测试 |

### 2.2 多级审批

| # | 标准 | 验证方式 |
|---|------|----------|
| M1 | 按风险等级自动路由到不同审批链 | 集成测试 |
| M2 | 低风险（1 级审批）：技术负责人 | 集成测试 |
| M3 | 中风险（2 级审批）：技术负责人 → 部门主管 | 集成测试 |
| M4 | 高风险（3 级审批）：技术负责人 → 部门主管 → CTO | 集成测试 |
| M5 | 每级审批可配置超时时间 | API 测试 |
| M6 | 任一级拒绝则整体拒绝 | 单元测试 |
| M7 | 审批人可转交（delegate）给他人 | API 测试 |

### 2.3 紧急通道

| # | 标准 | 验证方式 |
|---|------|----------|
| U1 | 紧急通道请求需声明紧急原因 | API 测试 |
| U2 | 紧急操作立即执行，无需等待审批 | 集成测试 |
| U3 | 紧急操作后自动创建事后审批（24h 内补审批） | 集成测试 |
| U4 | 事后审批过期未处理时自动升级告警 | 集成测试 |
| U5 | 紧急通道使用记录可审计（谁、何时、为什么） | API 测试 |

### 2.4 审批模板

| # | 标准 | 验证方式 |
|---|------|----------|
| T1 | 预置 5+ 模板（部署审批/变更审批/预算豁免/配置变更/紧急通道） | 前端验证 |
| T2 | 模板含预填字段、默认审批链、SLA 配置 | API 测试 |
| T3 | 用户可自定义模板 | API 测试 |

### 2.5 审批 SLA

| # | 标准 | 验证方式 |
|---|------|----------|
| S1 | 追踪每个审批的响应时间 | 单元测试 |
| S2 | SLA 告警（超过 SLA 时间未审批） | 集成测试 |
| S3 | SLA 报表（平均响应时间、超时率、按审批人） | API 测试 |
| S4 | 审批超时自动升级到下一级 | 集成测试 |

## 三、API 设计

### 3.1 统一审批引擎 API

```
Base: /api/v1/approvals
```

| 方法 | 路径 | 描述 | 请求体 | 响应 |
|------|------|------|--------|------|
| POST | `/` | 创建审批请求 | `ApprovalRequestInput` | `{ id, status, approvalChain }` |
| GET | `/` | 获取审批列表 | query: status, type, requester, page, limit | `{ data: ApprovalRequest[], total }` |
| GET | `/:id` | 获取审批详情 | - | `{ ...ApprovalRequest, history }` |
| POST | `/:id/respond` | 响应审批 | `{ action, comment, level }` | `{ id, status, nextLevel }` |
| POST | `/:id/delegate` | 转交审批 | `{ delegateTo, reason }` | `{ id, delegatedTo }` |
| POST | `/:id/batch-respond` | 批量审批 | `{ ids, action, comment }` | `{ results: [{ id, status }] }` |

**ApprovalRequestInput 结构**:

```typescript
interface ApprovalRequestInput {
  title: string;
  description: string;
  type: 'deployment' | 'change' | 'budget-exemption' | 'config-change' | 'emergency' | 'custom';
  sourceModule: string;                   // 'self-healing' | 'quality-gate' | 'budget-gate' | 'pipeline'
  sourceId: string;                       // 关联的源模块 ID
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  urgency: 'normal' | 'urgent' | 'emergency';
  metadata: Record<string, unknown>;      // 模块特定的附加信息
  approvalChainTemplate?: string;         // 审批链模板 ID
  customApprovers?: string[];             // 自定义审批人（覆盖模板）
  slaMinutes?: number;                    // 自定义 SLA
  emergencyReason?: string;               // 紧急通道原因
}

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

interface ApprovalLevel {
  level: number;
  approverId: string;
  approverName: string;
  role: string;
  status: 'pending' | 'approved' | 'rejected' | 'delegated' | 'skipped';
  requestedAt: Date;
  respondedAt?: Date;
  comment?: string;
  delegateTo?: string;
  slaMinutes: number;
}
```

### 3.2 审批模板 API

```
Base: /api/v1/approvals/templates
```

| 方法 | 路径 | 描述 | 请求体 | 响应 |
|------|------|------|--------|------|
| POST | `/` | 创建审批模板 | `TemplateInput` | `{ id, name }` |
| GET | `/` | 获取模板列表 | query: type | `{ data: ApprovalTemplate[] }` |
| GET | `/:id` | 获取模板详情 | - | `{ ...ApprovalTemplate }` |
| PUT | `/:id` | 更新模板 | `TemplateInput` | `{ id, updated }` |
| DELETE | `/:id` | 删除模板 | - | `{ success }` |

**TemplateInput 结构**:

```typescript
interface TemplateInput {
  name: string;
  description: string;
  type: string;
  riskLevels: string[];                  // 适用的风险等级
  approvalChain: Array<{
    level: number;
    role: string;                        // 'tech-lead' | 'manager' | 'cto' | 'admin'
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

### 3.3 审批 SLA API

```
Base: /api/v1/approvals/sla
```

| 方法 | 路径 | 描述 | 请求体 | 响应 |
|------|------|------|--------|------|
| GET | `/stats` | 获取 SLA 统计 | query: from, to, approver | `SLAStats` |
| GET | `/report` | 获取 SLA 报告 | query: from, to, groupBy | `SLAReport` |
| GET | `/overdue` | 获取超时审批 | query: approver | `{ data: ApprovalRequest[] }` |

**SLAStats 结构**:

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

### 3.4 审批路由配置 API

```
Base: /api/v1/approvals/routing
```

| 方法 | 路径 | 描述 | 请求体 | 响应 |
|------|------|------|--------|------|
| GET | `/rules` | 获取审批路由规则 | - | `{ data: RoutingRule[] }` |
| POST | `/rules` | 创建路由规则 | `RoutingRuleInput` | `{ id, name }` |
| PUT | `/rules/:id` | 更新路由规则 | `RoutingRuleInput` | `{ id, updated }` |
| DELETE | `/rules/:id` | 删除路由规则 | - | `{ success }` |

**RoutingRuleInput 结构**:

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

## 四、数据库变更

### 4.1 新增表：approval_requests

```sql
CREATE TABLE IF NOT EXISTS approval_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title           VARCHAR(500) NOT NULL,
  description     TEXT,
  type            VARCHAR(50) NOT NULL,
  source_module   VARCHAR(50) NOT NULL,
  source_id       VARCHAR(100) NOT NULL,
  risk_level      VARCHAR(20) NOT NULL,
  urgency         VARCHAR(20) NOT NULL DEFAULT 'normal',
  status          VARCHAR(30) NOT NULL DEFAULT 'pending',
  requester_id    UUID REFERENCES users(id),
  metadata        JSONB DEFAULT '{}',
  approval_chain  JSONB NOT NULL,          -- ApprovalLevel[]
  current_level   INT NOT NULL DEFAULT 0,
  sla_minutes     INT,
  sla_deadline    TIMESTAMPTZ,
  emergency_reason TEXT,
  emergency_processed BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ
);
CREATE INDEX idx_approval_tenant ON approval_requests(tenant_id, status);
CREATE INDEX idx_approval_type ON approval_requests(type, created_at DESC);
CREATE INDEX idx_approval_source ON approval_requests(source_module, source_id);
CREATE INDEX idx_approval_requester ON approval_requests(requester_id);
CREATE INDEX idx_approval_sla ON approval_requests(sla_deadline) WHERE status IN ('pending', 'in_review');
```

### 4.2 新增表：approval_history

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

### 4.3 新增表：approval_templates

```sql
CREATE TABLE IF NOT EXISTS approval_templates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name            VARCHAR(200) NOT NULL,
  description     TEXT,
  type            VARCHAR(50) NOT NULL,
  risk_levels     TEXT[] DEFAULT '{}',
  approval_chain  JSONB NOT NULL,
  default_sla_minutes INT,
  fields          JSONB DEFAULT '[]',
  notification_channels TEXT[] DEFAULT '{}',
  is_system       BOOLEAN DEFAULT false,     -- 系统预置模板
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_approval_templates_tenant ON approval_templates(tenant_id, type);
```

### 4.4 新增表：approval_routing_rules

```sql
CREATE TABLE IF NOT EXISTS approval_routing_rules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name            VARCHAR(200) NOT NULL,
  conditions      JSONB NOT NULL,
  approval_chain  JSONB NOT NULL,
  priority        INT NOT NULL DEFAULT 100,
  enabled         BOOLEAN NOT NULL DEFAULT true,
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_approval_routing_tenant ON approval_routing_rules(tenant_id, priority);
```

### 4.5 迁移脚本

```sql
-- Migration 090: 审批工作流
-- 统一审批引擎、多级审批、紧急通道、审批模板、SLA 监控
```

## 五、前端设计

### 5.1 审批列表页面

**路由**: `/approvals`

**页面结构**:
```
┌─────────────────────────────────────────────┐
│  我的审批                          [发起审批] │
├─────────────────────────────────────────────┤
│  筛选: [全部▼] [待我审批▼] [紧急▼]            │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │ 🔴 生产部署审批 - user-service v2.4     │  │
│  │ 类型: Deployment  风险: High  紧急       │  │
│  │ 申请人: alice  申请时间: 10:30          │  │
│  │ 当前级别: 1/3 (技术负责人审批中)         │  │
│  │ [审批] [转交] [详情]                    │  │
│  ├────────────────────────────────────────┤  │
│  │ 🟡 预算豁免申请 - staging 环境          │  │
│  │ 类型: Budget  风险: Medium  普通         │  │
│  │ 申请人: bob  申请时间: 09:15            │  │
│  │ 当前级别: 1/2 (技术负责人审批中)         │  │
│  │ [审批] [转交] [详情]                    │  │
│  ├────────────────────────────────────────┤  │
│  │ 🟢 配置变更 - redis 超时调整            │  │
│  │ 类型: Config  风险: Low  普通            │  │
│  │ 申请人: charlie  审批状态: ✅ 已批准     │  │
│  │ [详情]                                  │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  统计: 待审批 5  已批准 12  已拒绝 2  超时 1  │
└─────────────────────────────────────────────┘
```

### 5.2 审批详情与审批操作页面

**路由**: `/approvals/:id`

**页面结构**:
```
┌─────────────────────────────────────────────┐
│  审批详情: 生产部署审批                      │
├─────────────────────────────────────────────┤
│                                              │
│  基本信息                                     │
│  类型: Deployment    风险: 🔴 High           │
│  紧急度: 🔥 紧急                              │
│  申请人: alice  申请时间: 2026-05-05 10:30   │
│  SLA 截止: 2026-05-05 11:00 (还剩 15 分钟)   │
│                                              │
│  审批内容                                     │
│  ┌────────────────────────────────────────┐  │
│  │ 服务: user-service                     │  │
│  │ 版本: v2.3 → v2.4                      │  │
│  │ 环境: production                        │  │
│  │ 变更摘要: 新增用户画像功能              │  │
│  │ 风险评估: 中等 (影响 3 个下游服务)      │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  审批链                                       │
│  ┌────────────────────────────────────────┐  │
│  │ 1. 技术负责人 (dave)  ✅ 已批准 10:35   │  │
│  │    "代码审查通过，建议灰度发布"          │  │
│  ├────────────────────────────────────────┤  │
│  │ 2. 部门主管 (eve)  → 审批中 (当前)      │  │
│  │    ⏱ 剩余 10 分钟                      │  │
│  ├────────────────────────────────────────┤  │
│  │ 3. CTO (frank)  ⏸ 待处理               │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  审批操作                                     │
│  ┌────────────────────────────────────────┐  │
│  │ 审批意见:                               │  │
│  │ [____________________________________] │  │
│  │ [✅ 批准] [❌ 拒绝] [➡️ 转交]            │  │
│  └────────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

### 5.3 紧急通道页面

**路由**: `/approvals/emergency`

**页面结构**:
```
┌─────────────────────────────────────────────┐
│  紧急通道                        [发起紧急操作]│
├─────────────────────────────────────────────┤
│                                              │
│  ⚠️  紧急通道说明                             │
│  紧急操作将立即执行，但必须在 24 小时内       │
│  完成事后审批。超时未审批将自动升级。         │
│                                              │
│  最近紧急操作                                 │
│  ┌────────────────────────────────────────┐  │
│  │ 🔴 紧急回滚 - payment-service           │  │
│  │ 操作人: alice  时间: 10:45              │  │
│  │ 原因: 支付成功率降至 60%                 │  │
│  │ 事后审批: ⏳ 待审批 (剩余 22h)           │  │
│  └────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────┐  │
│  │ 🔴 紧急扩缩容 - api-gateway             │  │
│  │ 操作人: bob  时间: 昨天 16:30           │  │
│  │ 原因: 流量突增 300%                     │  │
│  │ 事后审批: ✅ 已批准                     │  │
│  └────────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

### 5.4 SLA 报表页面

**路由**: `/approvals/sla-report`

**页面结构**:
```
┌─────────────────────────────────────────────┐
│  审批 SLA 报表                               │
├─────────────────────────────────────────────┤
│  时间范围: [最近 30 天▼]                     │
│                                              │
│  总览                                         │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐        │
│  │ 总请求  │ │ 平均响应 │ │ SLA 合规 │        │
│  │   156   │ │  8.3min │ │  94.2%  │        │
│  └─────────┘ └─────────┘ └─────────┘        │
│                                              │
│  按审批人                                     │
│  ┌────────────────────────────────────────┐  │
│  │ 审批人  │ 审批数 │ 平均响应 │ SLA 合规  │  │
│  │ dave    │   45   │   5.2min │  98%     │  │
│  │ eve     │   38   │  12.1min │  89%     │  │
│  │ frank   │   12   │  15.3min │  92%     │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  SLA 趋势                                     │
│  ┌────────────────────────────────────────┐  │
│  │ 📈 折线图: SLA 合规率趋势               │  │
│  └────────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

### 5.5 前端文件变更

| 文件 | 操作 | 描述 |
|------|------|------|
| `src/pages/ApprovalList/index.tsx` | 新建 | 审批列表页面 |
| `src/pages/ApprovalDetail/index.tsx` | 新建 | 审批详情与操作 |
| `src/pages/ApprovalNew/index.tsx` | 新建 | 发起审批页面 |
| `src/pages/EmergencyChannel/index.tsx` | 新建 | 紧急通道页面 |
| `src/pages/ApprovalSLAReport/index.tsx` | 新建 | SLA 报表页面 |
| `src/pages/ApprovalTemplates/index.tsx` | 新建 | 审批模板管理 |
| `src/pages/ApprovalRoutingRules/index.tsx` | 新建 | 审批路由规则配置 |
| `src/api/approvals.ts` | 新建 | 审批 API 客户端 |
| `src/components/ApprovalChain/index.tsx` | 新建 | 审批链可视化组件 |
| `src/components/SLAGauge/index.tsx` | 新建 | SLA 进度条组件 |
| `src/components/ApprovalForm/index.tsx` | 新建 | 通用审批表单组件 |

## 六、测试策略

### 6.1 单元测试

| 模块 | 文件 | 测试用例 |
|------|------|----------|
| ApprovalEngine | `services/approvals/ApprovalEngine.ts` | 状态机/多级审批/拒绝处理（15 cases） |
| ApprovalRouter | `services/approvals/ApprovalRouter.ts` | 路由规则匹配/优先级/默认链（10 cases） |
| EmergencyHandler | `services/approvals/EmergencyHandler.ts` | 紧急操作/事后审批/超时升级（8 cases） |
| SLAMonitor | `services/approvals/SLAMonitor.ts` | 超时检测/升级/统计（8 cases） |

### 6.2 集成测试

| 场景 | 描述 |
|------|------|
| 多级审批完整流程 | 创建高风险审批 → L1 批准 → L2 批准 → L3 批准 → 整体批准 |
| 审批拒绝 | 创建审批 → L1 批准 → L2 拒绝 → 验证整体拒绝 |
| 紧急通道 | 发起紧急操作 → 立即执行 → 创建事后审批 → 审批通过 |
| SLA 超时升级 | 创建审批 → 超时 → 自动升级到下一级 → 通知 |

### 6.3 E2E 测试

| 场景 | 描述 |
|------|------|
| 审批工作流 E2E | 发起审批 → 查看列表 → 审批操作 → 验证状态 |
| 紧急通道 E2E | 发起紧急操作 → 验证执行 → 补审批 → 验证状态 |

## 七、非功能性要求

### 7.1 性能

| 指标 | 目标 |
|------|------|
| 审批创建响应 | < 100ms |
| 审批路由计算 | < 50ms |
| 审批列表查询 | < 200ms |
| SLA 超时检测（定时任务） | < 2s（全量扫描） |

### 7.2 安全性

| 要求 | 实现 |
|------|------|
| 审批操作权限 | 仅审批人/转交人可审批 |
| 紧急通道权限 | 需特定角色（admin/sre-lead） |
| 审计日志 | 所有审批操作写入 `approval_history` 表 |
| 数据隔离 | 所有查询按 tenant_id 过滤 |

### 7.3 可维护性

| 要求 | 实现 |
|------|------|
| 代码覆盖率 | > 80% |
| 模块迁移 | 现有 SelfHealing approval 迁移到统一审批引擎 |

## 八、实施计划

| 模块 | 后端 (天) | 前端 (天) | 测试 (天) |
|------|:---------:|:---------:|:---------:|
| 统一审批引擎 | 2.5 | 1 | 1 |
| 多级审批 | 2 | 2 | 1 |
| 紧急通道 | 1 | 1.5 | 0.5 |
| 审批模板 | 1 | 1.5 | 0.5 |
| SLA 监控 | 1 | 1 | 1 |
| SelfHealing 迁移 | 0.5 | 0.5 | 0.5 |
| **合计** | **8** | **7.5** | **4.5** |

---

_文档版本: v1.0 | 创建日期: 2026-05-05 | 状态: 已验证_
