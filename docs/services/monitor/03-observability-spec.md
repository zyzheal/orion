# 全栈可观测详细规格 (Phase 2)

> **日期**: 2026-05-05
> **状态**: 已验证
> **能力域**: 全栈可观测
> **目标成熟度**: L2 → L2.5
> **关键交付**: 自定义告警规则、根因分析

## 一、功能描述

### 1.1 现状评估 (L2)

Orion 当前已实现：
- **AlertCorrelationService** (`services/alert/AlertCorrelationService.ts`)：告警关联、去重、分组、根因分析（基于标签相似度和消息模式匹配）
- **DiagnosticAgentService** (`services/diagnostic/DiagnosticAgentService.ts`)：症状关联、根因识别、知识库模式匹配、5 种内置诊断模式（CrashLoop、ImagePull、DB Connection、Test Failure、Resource Exhaustion）
- **SelfHealingService** (`services/self-healing/`）：告警接收、策略匹配、自愈执行、审批工作流、PostgreSQL 持久化
- **FinOpsService** (`services/finops/`）：成本告警（BudgetAlert）、阈值触发、PostgreSQL Repository

**不足**：
- 告警规则仅硬编码在代码中，无自定义告警规则引擎（用户无法创建/编辑/删除告警规则）
- 根因分析（RCA）仅基于简单规则匹配，无多维度关联分析（指标 + 日志 + 事件 + 变更）
- 无告警抑制和静默规则（维护窗口期间的告警噪声）
- 无自定义通知渠道（仅内部通知，无 Slack/PagerDuty/邮件/Webhook）
- AlertCorrelationService 的关联算法较简单（仅 Jaccard 相似度 + 关键词），无拓扑依赖分析

### 1.2 Phase 2 目标 (L2.5)

| 功能模块 | 描述 | 验收等级 |
|----------|------|:--------:|
| 自定义告警规则 | 用户可创建/编辑/删除告警规则，支持多条件组合 | L2.5 |
| 根因分析（RCA） | 多维度关联分析（指标/日志/事件/变更），生成根因报告 | L2.5 |
| 告警静默规则 | 维护窗口、服务级别静默，减少告警噪声 | L2.5 |
| 通知渠道扩展 | 支持 Slack、Webhook、邮件、PagerDuty | L2.5 |
| 告警仪表板 | 实时告警视图、趋势分析、关联图谱 | L2.5 |

## 二、验收标准

### 2.1 自定义告警规则

| # | 标准 | 验证方式 |
|---|------|----------|
| R1 | 支持创建告警规则（名称、条件、严重度、通知渠道） | API 测试 |
| R2 | 支持多条件组合（AND/OR），基于 PromQL/LogQL 查询 | API 测试 |
| R3 | 支持告警阈值（>、<、>=、<=、between） | API 测试 |
| R4 | 支持持续时间条件（持续 X 分钟才触发告警） | 集成测试 |
| R5 | 支持规则启用/禁用、测试预览 | API 测试 |
| R6 | 内置 10+ 预置规则模板（CPU/内存/错误率/延迟/磁盘等） | 前端验证 |

### 2.2 根因分析

| # | 标准 | 验证方式 |
|---|------|----------|
| A1 | RCA 关联指标、日志、事件、变更四类数据源 | 集成测试 |
| A2 | 支持拓扑依赖分析（服务 A → 服务 B → 数据库） | API 测试 |
| A3 | 生成根因报告（根因节点、影响范围、修复建议） | API 测试 |
| A4 | RCA 计算延迟 < 5s | 性能测试 |
| A5 | 历史 RCA 报告可查询和对比 | API 测试 |

### 2.3 告警静默规则

| # | 标准 | 验证方式 |
|---|------|----------|
| S1 | 支持创建静默规则（匹配条件、时间范围、创建者） | API 测试 |
| S2 | 静默支持一次性时间和循环时间（每天 02:00-04:00） | API 测试 |
| S3 | 静默期间告警不触发通知，但记录到审计日志 | 集成测试 |
| S4 | 静默到期自动失效 | 单元测试 |

### 2.4 通知渠道扩展

| # | 标准 | 验证方式 |
|---|------|----------|
| N1 | 支持 Slack 通知（频道/用户） | 集成测试 |
| N2 | 支持 Webhook 通知（自定义 URL + 模板） | API 测试 |
| N3 | 支持邮件通知（收件人/主题/HTML 模板） | 集成测试 |
| N4 | 支持 PagerDuty 通知（事件路由） | 集成测试 |
| N5 | 通知失败自动重试（最多 3 次，指数退避） | 单元测试 |

### 2.5 告警仪表板

| # | 标准 | 验证方式 |
|---|------|----------|
| D1 | 实时告警列表（按严重度/状态筛选） | 前端验证 |
| D2 | 告警趋势图（24h/7d/30d） | 前端验证 |
| D3 | 告警关联图谱（节点 + 边的可视化） | 前端验证 |
| D4 | 告警统计（MTTA/MTTR/告警量/去重率） | 前端验证 |

## 三、API 设计

### 3.1 自定义告警规则 API

```
Base: /api/v1/alerts/rules
```

| 方法 | 路径 | 描述 | 请求体 | 响应 |
|------|------|------|--------|------|
| POST | `/` | 创建告警规则 | `AlertRuleInput` | `{ id, name, status }` |
| GET | `/` | 获取告警规则列表 | query: enabled, severity, page, limit | `{ data: AlertRule[], total }` |
| GET | `/templates` | 获取预置规则模板 | - | `{ data: AlertRuleTemplate[] }` |
| GET | `/:id` | 获取告警规则详情 | - | `{ ...AlertRule }` |
| PUT | `/:id` | 更新告警规则 | `AlertRuleInput` | `{ id, updated }` |
| DELETE | `/:id` | 删除告警规则 | - | `{ success }` |
| POST | `/:id/toggle` | 启用/禁用规则 | `{ enabled: boolean }` | `{ id, enabled }` |
| POST | `/:id/test` | 测试规则 | `{ sampleData }` | `{ wouldFire, matchedConditions }` |

**AlertRuleInput 结构**:

```typescript
interface AlertRuleInput {
  name: string;
  description?: string;
  severity: 'critical' | 'warning' | 'info';
  enabled: boolean;
  conditions: AlertCondition[];
  durationMs: number;                  // 持续多久才触发
  notificationChannels: string[];       // 渠道 ID 列表
  labels?: Record<string, string>;
  annotations?: {
    summary: string;
    description: string;
    runbookUrl?: string;
  };
}

interface AlertCondition {
  type: 'metric' | 'log' | 'event';
  query: string;                       // PromQL / LogQL / event filter
  operator: 'gt' | 'lt' | 'gte' | 'lte' | 'between' | 'eq' | 'neq';
  threshold: number | [number, number];
  logicalOp?: 'AND' | 'OR';            // 与下一个条件的逻辑关系
}
```

### 3.2 根因分析 API

```
Base: /api/v1/alerts/rca
```

| 方法 | 路径 | 描述 | 请求体 | 响应 |
|------|------|------|--------|------|
| POST | `/analyze` | 触发根因分析 | `{ alertIds, timeRange }` | `{ id, status }` |
| GET | `/reports/:id` | 获取 RCA 报告 | - | `RootCauseReport` |
| GET | `/reports` | 获取 RCA 历史 | query: from, to, service, page | `{ data: RootCauseReport[], total }` |
| GET | `/topology` | 获取服务拓扑 | query: service | `{ nodes, edges }` |

**RootCauseReport 结构**:

```typescript
interface RootCauseReport {
  id: string;
  alertGroupId: string;
  analysisTime: Date;
  rootCause: {
    node: string;                     // 服务/组件名称
    type: 'resource' | 'dependency' | 'code' | 'config' | 'infrastructure';
    confidence: number;
    evidence: RC Evidence[];
  };
  impactScope: {
    affectedServices: string[];
    affectedUsers?: number;
    severity: 'critical' | 'high' | 'medium' | 'low';
  };
  timeline: RCEvent[];
  recommendations: string[];
  relatedChanges: {
    deployments: string[];
    configChanges: string[];
  };
}

interface RC Evidence {
  type: 'metric' | 'log' | 'event' | 'change';
  source: string;
  description: string;
  timestamp: Date;
  data: Record<string, unknown>;
}

interface RCEvent {
  timestamp: Date;
  eventType: string;
  description: string;
  service: string;
}
```

### 3.3 告警静默规则 API

```
Base: /api/v1/alerts/silences
```

| 方法 | 路径 | 描述 | 请求体 | 响应 |
|------|------|------|--------|------|
| POST | `/` | 创建静默规则 | `SilenceInput` | `{ id, matcher, expiresAt }` |
| GET | `/` | 获取静默规则列表 | query: active, page, limit | `{ data: SilenceRule[], total }` |
| GET | `/:id` | 获取静默详情 | - | `{ ...SilenceRule }` |
| DELETE | `/:id` | 删除静默规则 | - | `{ success }` |

**SilenceInput 结构**:

```typescript
interface SilenceInput {
  matchers: Array<{
    name: string;                     // 匹配的标签名
    value: string;                    // 匹配的标签值
    isRegex: boolean;
  }>;
  startsAt: Date;
  endsAt: Date;
  recurrence?: {
    pattern: 'daily' | 'weekly' | 'monthly';
    startTime: string;                // "02:00"
    endTime: string;                  // "04:00"
    daysOfWeek?: number[];            // [1,2,3,4,5] for weekdays
  };
  reason: string;
  createdBy: string;
}
```

### 3.4 通知渠道 API

```
Base: /api/v1/alerts/channels
```

| 方法 | 路径 | 描述 | 请求体 | 响应 |
|------|------|------|--------|------|
| POST | `/` | 创建通知渠道 | `ChannelInput` | `{ id, type, name }` |
| GET | `/` | 获取通知渠道列表 | query: type, page, limit | `{ data: NotificationChannel[], total }` |
| GET | `/:id` | 获取通知渠道详情 | - | `{ ...NotificationChannel }` |
| PUT | `/:id` | 更新通知渠道 | `ChannelInput` | `{ id, updated }` |
| DELETE | `/:id` | 删除通知渠道 | - | `{ success }` |
| POST | `/:id/test` | 测试通知渠道 | - | `{ success, message }` |

**ChannelInput 结构**:

```typescript
interface ChannelInput {
  name: string;
  type: 'slack' | 'webhook' | 'email' | 'pagerduty';
  config: SlackConfig | WebhookConfig | EmailConfig | PagerDutyConfig;
  enabled: boolean;
}

interface SlackConfig {
  webhookUrl: string;
  channel: string;
  mentionUsers?: string[];
}

interface WebhookConfig {
  url: string;
  method: 'POST' | 'PUT';
  headers?: Record<string, string>;
  template?: string;                   // JSON template for payload
}

interface EmailConfig {
  recipients: string[];
  subjectTemplate: string;
  htmlTemplate: string;
}

interface PagerDutyConfig {
  integrationKey: string;
  severity: 'critical' | 'error' | 'warning' | 'info';
}
```

## 四、数据库变更

### 4.1 新增表：alert_rules

```sql
CREATE TABLE IF NOT EXISTS alert_rules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name            VARCHAR(200) NOT NULL,
  description     TEXT,
  severity        VARCHAR(20) NOT NULL DEFAULT 'warning',
  enabled         BOOLEAN NOT NULL DEFAULT true,
  conditions      JSONB NOT NULL,              -- AlertCondition[]
  duration_ms     BIGINT NOT NULL DEFAULT 0,
  notification_channels TEXT[] DEFAULT '{}',
  labels          JSONB DEFAULT '{}',
  annotations     JSONB DEFAULT '{}',
  is_template     BOOLEAN NOT NULL DEFAULT false,
  created_by      UUID REFERENCES users(id),
  updated_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_alert_rules_tenant ON alert_rules(tenant_id, enabled);
```

### 4.2 新增表：alert_silences

```sql
CREATE TABLE IF NOT EXISTS alert_silences (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  matchers        JSONB NOT NULL,              -- SilenceInput.matchers[]
  starts_at       TIMESTAMPTZ NOT NULL,
  ends_at         TIMESTAMPTZ NOT NULL,
  recurrence      JSONB,                       -- recurrence config
  reason          TEXT NOT NULL,
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_alert_silences_tenant ON alert_silences(tenant_id, starts_at, ends_at);
```

### 4.3 新增表：alert_notification_channels

```sql
CREATE TABLE IF NOT EXISTS alert_notification_channels (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name            VARCHAR(200) NOT NULL,
  type            VARCHAR(20) NOT NULL,         -- slack/webhook/email/pagerduty
  config          JSONB NOT NULL,
  enabled         BOOLEAN NOT NULL DEFAULT true,
  last_test_at    TIMESTAMPTZ,
  last_test_status VARCHAR(20),
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_alert_channels_tenant ON alert_notification_channels(tenant_id, type);
```

### 4.4 新增表：alert_rca_reports

```sql
CREATE TABLE IF NOT EXISTS alert_rca_reports (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  alert_group_id  UUID,
  root_cause_node VARCHAR(200),
  root_cause_type VARCHAR(50),
  confidence      DECIMAL(3,2),
  evidence        JSONB NOT NULL,
  impact_scope    JSONB NOT NULL,
  timeline        JSONB NOT NULL,
  recommendations TEXT[],
  related_changes JSONB,
  analysis_time   TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_alert_rca_tenant ON alert_rca_reports(tenant_id, analysis_time DESC);
CREATE INDEX idx_alert_rca_node ON alert_rca_reports(root_cause_node);
```

### 4.5 新增表：alert_notification_logs

```sql
CREATE TABLE IF NOT EXISTS alert_notification_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE,
  alert_id        UUID,
  channel_id      UUID REFERENCES alert_notification_channels(id),
  channel_type    VARCHAR(20) NOT NULL,
  status          VARCHAR(20) NOT NULL,          -- sent/failed/retrying
  error           TEXT,
  attempt         INT DEFAULT 1,
  sent_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_alert_notif_logs_alert ON alert_notification_logs(alert_id);
CREATE INDEX idx_alert_notif_logs_channel ON alert_notification_logs(channel_id, sent_at DESC);
```

### 4.6 迁移脚本

```sql
-- Migration 088: 全栈可观测增强
-- 自定义告警规则、根因分析、告警静默、通知渠道扩展
```

## 五、前端设计

### 5.1 告警规则管理页面

**路由**: `/observability/alert-rules`

**页面结构**:
```
┌─────────────────────────────────────────────┐
│  告警规则管理                    [创建规则]  │
├─────────────────────────────────────────────┤
│  筛选: [全部▼] [启用▼] [Critical▼]           │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │ 🔴 High CPU Usage         [启用] [编辑] │  │
│  │ cpu_usage > 85% for 5min               │  │
│  │ Notify: Slack #ops, PagerDuty          │  │
│  ├────────────────────────────────────────┤  │
│  │ 🟡 High Error Rate        [启用] [编辑] │  │
│  │ error_rate > 5% for 10min              │  │
│  │ Notify: Slack #alerts                   │  │
│  ├────────────────────────────────────────┤  │
│  │ 🔴 Service Down            [禁用] [编辑] │  │
│  │ http_up == 0 for 2min                  │  │
│  │ Notify: PagerDuty, Email               │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  预置模板                        [从模板创建]  │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐        │
│  │ CPU 使用 │ │ 内存使用 │ │ 错误率  │        │
│  │ 磁盘空间 │ │ 响应延迟 │ │ Pod 状态│        │
│  └─────────┘ └─────────┘ └─────────┘        │
└─────────────────────────────────────────────┘
```

### 5.2 告警仪表板页面

**路由**: `/observability/alerts`

**页面结构**:
```
┌─────────────────────────────────────────────┐
│  告警仪表板                                  │
├─────────────────────────────────────────────┤
│                                              │
│  实时统计 (最近 24 小时)                      │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐        │
│  │ 活跃告警 │ │ MTTA    │ │ MTTR    │        │
│  │   23    │ │  3.2min │ │ 18.5min │        │
│  │ ↓ 5     │ │ ↓ 0.8   │ │ ↓ 2.1   │        │
│  └─────────┘ └─────────┘ └─────────┘        │
│                                              │
│  告警趋势                                     │
│  ┌────────────────────────────────────────┐  │
│  │ 📊 柱状图: 每小时告警数量               │  │
│  │    🔴 Critical  🟡 Warning  🟢 Info    │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  活跃告警列表                                 │
│  ┌────────────────────────────────────────┐  │
│  │ 🔴 api-gateway High CPU  10:32  2m ago │  │
│  │ 🟡 user-service Error Rate  10:28  6m  │  │
│  │ 🔴 payment-service Down  10:15  17m    │  │
│  │ 🟢 order-service Disk 80%  09:45  47m  │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  [全部告警] [关联分析] [静默管理]             │
└─────────────────────────────────────────────┘
```

### 5.3 根因分析报告页面

**路由**: `/observability/rca/:reportId`

**页面结构**:
```
┌─────────────────────────────────────────────┐
│  根因分析报告                                │
├─────────────────────────────────────────────┤
│                                              │
│  根因节点 (置信度: 87%)                       │
│  ┌────────────────────────────────────────┐  │
│  │ 📦 database-primary                    │  │
│  │ 类型: resource (连接池耗尽)              │  │
│  │                                          │  │
│  │ 证据:                                   │  │
│  │ • DB 连接数从 50 → 200 (10:20)         │  │
│  │ • 慢查询数量 +300% (10:18)             │  │
│  │ • user-service DB 超时错误 (10:21)     │  │
│  │ • 最近部署: user-service v2.3 (10:00)  │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  影响范围                                     │
│  ┌────────────────────────────────────────┐  │
│  │ 影响服务: user-service, order-service   │  │
│  │   api-gateway (间接影响)                │  │
│  │ 严重度: Critical                        │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  时间线                                       │
│  ┌────────────────────────────────────────┐  │
│  │ 10:00  user-service v2.3 deployed      │  │
│  │ 10:18  DB slow queries increase        │  │
│  │ 10:20  Connection pool exhausted        │  │
│  │ 10:21  user-service DB timeout          │  │
│  │ 10:28  High Error Rate alert fired      │  │
│  │ 10:32  High CPU alert fired             │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  修复建议                                     │
│  ┌────────────────────────────────────────┐  │
│  │ 1. 回滚 user-service 到 v2.2           │  │
│  │ 2. 增加 DB 连接池最大连接数             │  │
│  │ 3. 审查 v2.3 中的 DB 查询变更          │  │
│  └────────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

### 5.4 关联图谱页面

**路由**: `/observability/topology`

**页面结构**:
```
┌─────────────────────────────────────────────┐
│  服务关联图谱                                │
├─────────────────────────────────────────────┤
│                                              │
│  [api-gateway] ──────► [user-service]        │
│       │                     │                │
│       │                     ▼                │
│       │              [database-primary]       │
│       │                     │                │
│       ▼                     ▼                │
│  [order-service] ◄──── [cache-redis]         │
│       │                                      │
│       ▼                                      │
│  [database-replica]                           │
│                                              │
│  🔴 Critical  🟡 Warning  🟢 Healthy          │
│                                              │
│  [放大] [缩小] [适应窗口]                     │
└─────────────────────────────────────────────┘
```

### 5.5 前端文件变更

| 文件 | 操作 | 描述 |
|------|------|------|
| `src/pages/AlertRules/index.tsx` | 新建 | 告警规则管理页面 |
| `src/pages/AlertDashboard/index.tsx` | 新建 | 告警仪表板 |
| `src/pages/RCADetail/index.tsx` | 新建 | 根因分析报告页面 |
| `src/pages/AlertTopology/index.tsx` | 新建 | 关联图谱页面 |
| `src/pages/AlertSilences/index.tsx` | 新建 | 告警静默管理 |
| `src/pages/NotificationChannels/index.tsx` | 新建 | 通知渠道管理 |
| `src/api/alerts.ts` | 修改 | 新增告警规则/RCA/静默 API |
| `src/components/AlertRuleForm/index.tsx` | 新建 | 告警规则表单组件 |
| `src/components/RCATimeline/index.tsx` | 新建 | RCA 时间线组件 |
| `src/components/TopologyGraph/index.tsx` | 新建 | 关联图谱组件 |

## 六、测试策略

### 6.1 单元测试

| 模块 | 文件 | 测试用例 |
|------|------|----------|
| AlertRuleEngine | `services/alert/AlertRuleEngine.ts` | 条件评估/AND-OR 组合/持续时间（12 cases） |
| RootCauseAnalyzer | `services/alert/RootCauseAnalyzer.ts` | 多源关联/拓扑分析/报告生成（10 cases） |
| SilenceMatcher | `services/alert/SilenceMatcher.ts` | 匹配逻辑/时间窗口/循环规则（8 cases） |
| NotificationDispatcher | `services/alert/NotificationDispatcher.ts` | 多渠道分发/重试/模板渲染（10 cases） |

### 6.2 集成测试

| 场景 | 描述 |
|------|------|
| 自定义规则触发 | 创建规则 → 模拟指标超过阈值 → 验证告警触发 → 验证通知发送 |
| RCA 完整流程 | 多个关联告警 → 触发 RCA → 验证根因节点识别正确 |
| 静默规则生效 | 创建静默 → 触发匹配告警 → 验证通知不发送但审计日志存在 |

### 6.3 E2E 测试

| 场景 | 描述 |
|------|------|
| 告警规则管理 E2E | 创建规则 → 编辑 → 测试预览 → 禁用 → 删除 |
| RCA 报告 E2E | 查看告警 → 触发 RCA → 查看报告 → 对比历史 |

## 七、非功能性要求

### 7.1 性能

| 指标 | 目标 |
|------|------|
| 告警规则评估 | < 100ms/规则 |
| RCA 分析计算 | < 5s |
| 通知发送延迟 | < 1s（Slack/Webhook），< 5s（邮件） |
| 仪表板加载 | < 1s（最近 24h 数据） |

### 7.2 安全性

| 要求 | 实现 |
|------|------|
| 规则管理权限 | 创建/编辑/删除需 admin 权限 |
| Webhook 安全 | 支持 HMAC 签名验证 |
| 通知渠道加密 | Webhook URL 和 API Key 加密存储 |
| 数据隔离 | 所有查询按 tenant_id 过滤 |

### 7.3 可维护性

| 要求 | 实现 |
|------|------|
| 代码覆盖率 | > 80% |
| 规则模板 | 内置规则模板可更新，不破坏用户自定义规则 |

## 八、实施计划

| 模块 | 后端 (天) | 前端 (天) | 测试 (天) |
|------|:---------:|:---------:|:---------:|
| 自定义告警规则 | 2.5 | 2 | 1 |
| 根因分析 | 3 | 2 | 1 |
| 告警静默规则 | 1 | 1 | 0.5 |
| 通知渠道扩展 | 2 | 1.5 | 1 |
| 告警仪表板 | 1 | 2 | 0.5 |
| **合计** | **9.5** | **8.5** | **4** |

---

_文档版本: v1.0 | 创建日期: 2026-05-05 | 状态: 已验证_
