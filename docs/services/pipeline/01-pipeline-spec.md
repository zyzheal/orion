# 核心流水线详细规格 (Phase 1)

> **日期**: 2026-05-05
> **状态**: 已验证
> **能力域**: 1. 核心流水线
> **目标成熟度**: L3 → L3.3
> **关键交付**: 流水线版本控制、执行预算

## 一、功能描述

### 1.1 现状评估 (L3)

Orion 当前已实现：
- YAML 声明式流水线定义（apiVersion/kind/metadata/spec 结构）
- DAG 有向无环图编排（Stage 依赖关系驱动执行顺序）
- 可视化编辑器（PipelineEditor 前端页面）
- 嵌套流水线基础支持（Stage 内可包含 Task）
- 条件执行（`if` 表达式评估）
- 自动重试（Stage 级别 retry_count）
- 执行取消（cancelExecution）
- PostgreSQL 持久化（PipelineRepository，含 stages/runs/executions 表）

**不足**：
- 版本控制仅有 `getVersions` 查询，无版本对比/回退/标签/基线
- 无执行预算机制（时间/资源/费用上限）
- 无流水线模板库（无法从模板快速创建）
- 动态参数注入能力弱（仅支持简单的 `if` 条件评估）

### 1.2 Phase 1 目标 (L3.3)

| 功能模块 | 描述 | 验收等级 |
|----------|------|:--------:|
| 版本控制 | 版本对比、回退到指定版本、版本标签、版本基线 | L3.3 |
| 执行预算 | 时间预算、资源预算（CPU/Memory）、费用预算、预算超支策略 | L3.3 |
| 模板库 | 预置模板、用户自定义模板、模板市场、一键实例化 | L3.3 |
| 动态参数 | 运行时参数注入、环境变量传递、动态 Stage 生成 | L3.3 |

## 二、验收标准

### 2.1 版本控制

| # | 标准 | 验证方式 |
|---|------|----------|
| V1 | 每次 Pipeline 更新自动创建新版本（版本号自增） | API 测试 |
| V2 | 支持版本对比（diff），显示 YAML 差异（增/删/改高亮） | 前端 + API 测试 |
| V3 | 支持回退到任意历史版本（创建新版本，不修改历史） | API 测试 |
| V4 | 支持版本标签（tag），如 `release-1.0`、`baseline` | API 测试 |
| V5 | 支持版本基线（baseline），标记稳定版本供审计 | API 测试 |
| V6 | 版本历史记录按时间倒序，含操作人、变更摘要、时间戳 | 前端验证 |
| V7 | 单个 Pipeline 最多保留 50 个历史版本，超出自动清理最旧版本 | 单元测试 |

### 2.2 执行预算

| # | 标准 | 验证方式 |
|---|------|----------|
| B1 | 支持设置时间预算（单次 Run 最大执行时长） | API 测试 |
| B2 | 支持设置资源预算（最大 CPU 核时、最大内存 GB·时） | API 测试 |
| B3 | 支持设置费用预算（单次 Run 最大费用，基于资源用量估算） | API 测试 |
| B4 | 预算超支策略：warn（仅告警）、block（阻断执行）、rollback（回滚） | 集成测试 |
| B5 | 执行前预算预估（基于历史 Run 数据估算本次费用） | API 测试 |
| B6 | 执行中预算监控（实时追踪已消耗资源，接近预算阈值时告警） | 集成测试 |
| B7 | 预算仪表盘：按 Pipeline/Tenant/Project 维度展示预算使用情况 | 前端验证 |

### 2.3 模板库

| # | 标准 | 验证方式 |
|---|------|----------|
| T1 | 预置 5+ 模板：Node.js 构建、Go 构建、Java 构建、前端部署、Docker 构建 | 前端验证 |
| T2 | 用户可自定义模板（基于已有 Pipeline 保存为模板） | API 测试 |
| T3 | 模板分类标签（language/platform/purpose） | 前端 + API 测试 |
| T4 | 模板一键实例化（选择模板 → 填写参数 → 创建 Pipeline） | 前端 + API 测试 |
| T5 | 模板版本管理（模板自身有版本号，更新不影响已实例化的 Pipeline） | API 测试 |

### 2.4 动态参数

| # | 标准 | 验证方式 |
|---|------|----------|
| D1 | 触发 Run 时可传入运行时参数（覆盖 Pipeline 默认值） | API 测试 |
| D2 | 参数支持字符串、数字、布尔、数组类型 | 单元测试 |
| D3 | 参数在 Stage/Task 级别可通过 `${params.name}` 引用 | 集成测试 |
| D4 | 支持动态 Stage 生成（基于参数值决定是否生成某 Stage） | 集成测试 |
| D5 | 环境变量自动注入（git.sha、git.branch、trigger.type 等） | 集成测试 |

## 三、API 设计

### 3.1 版本控制 API

```
Base: /api/v1/pipelines/:pipelineId
```

| 方法 | 路径 | 描述 | 请求体 | 响应 |
|------|------|------|--------|------|
| GET | `/versions` | 获取版本列表（已有，增强） | query: page, limit, tag | `{ data: PipelineVersion[], total }` |
| GET | `/versions/:versionId` | 获取版本详情 | - | `{ id, version, yamlDefinition, spec, createdAt, createdBy, tags, isBaseline }` |
| GET | `/versions/:versionId/diff?target=:targetVersionId` | 版本对比 | - | `{ additions, deletions, modifications, summary }` |
| POST | `/versions/:versionId/rollback` | 回退到指定版本 | `{ reason?: string }` | `{ id, version, yamlDefinition, ... }` (新版本) |
| POST | `/versions/:versionId/tag` | 添加版本标签 | `{ tag: string }` | `{ success, tags: string[] }` |
| DELETE | `/versions/:versionId/tag/:tag` | 移除版本标签 | - | `{ success, tags: string[] }` |
| POST | `/versions/:versionId/baseline` | 设为/取消基线 | `{ baseline: boolean }` | `{ success, isBaseline: boolean }` |

**PipelineVersion 结构**:

```typescript
interface PipelineVersion {
  id: string;
  pipelineId: string;
  version: number;           // 自增版本号
  yamlDefinition: string;    // YAML 定义
  spec: PipelineSpec;        // 解析后的 spec
  createdAt: Date;
  createdBy: string;
  changeSummary: string;     // 变更摘要（自动生成）
  tags: string[];            // 版本标签
  isBaseline: boolean;       // 是否为基线版本
  parentVersionId: string | null; // 父版本（用于回退追踪）
  durationMs?: number;       // 该版本平均执行时长
  successRate?: number;      // 该版本成功率
}
```

### 3.2 执行预算 API

```
Base: /api/v1/pipelines/:pipelineId/budget
```

| 方法 | 路径 | 描述 | 请求体 | 响应 |
|------|------|------|--------|------|
| GET | `/budget` | 获取预算配置 | - | `{ timeBudget, resourceBudget, costBudget, overBudgetPolicy }` |
| PUT | `/budget` | 更新预算配置 | `BudgetConfig` | `{ ...BudgetConfig, updatedAt }` |
| GET | `/budget/estimate` | 执行前预算预估 | `{ triggerType, context? }` | `{ estimatedTimeMs, estimatedCpuCores, estimatedMemoryGB, estimatedCost, confidence }` |
| GET | `/runs/:runId/budget-usage` | 实时预算使用情况 | - | `{ timeUsed, timePercent, cpuUsed, cpuPercent, memoryUsed, memoryPercent, costUsed, costPercent, alerts[] }` |

**BudgetConfig 结构**:

```typescript
interface BudgetConfig {
  timeBudget?: {
    maxDurationMs: number;        // 最大执行时长
    warningPercent: number;       // 告警阈值（默认 80）
    policy: 'warn' | 'block' | 'rollback';
  };
  resourceBudget?: {
    maxCpuCoreHours: number;      // 最大 CPU 核时
    maxMemoryGBHours: number;     // 最大内存 GB·时
    warningPercent: number;
    policy: 'warn' | 'block' | 'rollback';
  };
  costBudget?: {
    maxCostCents: number;         // 最大费用（美分）
    warningPercent: number;
    policy: 'warn' | 'block' | 'rollback';
  };
  updatedAt: Date;
}
```

**BudgetUsage 结构**:

```typescript
interface BudgetUsage {
  timeUsed: number;        // 已用时长 ms
  timePercent: number;     // 占预算百分比
  cpuUsed: number;         // 已用 CPU 核时
  cpuPercent: number;
  memoryUsed: number;      // 已用内存 GB·时
  memoryPercent: number;
  costUsed: number;        // 已用费用（美分）
  costPercent: number;
  alerts: BudgetAlert[];
}

interface BudgetAlert {
  type: 'time' | 'cpu' | 'memory' | 'cost';
  level: 'warning' | 'critical';
  message: string;
  triggeredAt: Date;
}
```

### 3.3 模板库 API

```
Base: /api/v1/pipeline-templates
```

| 方法 | 路径 | 描述 | 请求体 | 响应 |
|------|------|------|--------|------|
| GET | `/` | 获取模板列表 | query: category, page, limit | `{ data: Template[], total }` |
| GET | `/:templateId` | 获取模板详情 | - | `{ ...Template, yamlDefinition, versions }` |
| POST | `/` | 创建模板（从现有 Pipeline 保存） | `{ pipelineId, name, description, category, tags }` | `{ id, name, version }` |
| PUT | `/:templateId` | 更新模板 | `{ name?, description?, tags?, yamlDefinition? }` | `{ ... }` |
| DELETE | `/:templateId` | 删除模板 | - | `{ success }` |
| POST | `/:templateId/instantiate` | 实例化模板为 Pipeline | `{ name, tenantId, projectId, params? }` | `{ pipelineId, name, version }` |
| GET | `/:templateId/versions` | 获取模板版本历史 | - | `{ data: TemplateVersion[], total }` |

**Template 结构**:

```typescript
interface Template {
  id: string;
  name: string;
  description: string;
  category: 'language' | 'platform' | 'purpose' | 'custom';
  tags: string[];                    // ['nodejs', 'build', 'test']
  yamlDefinition: string;            // 模板 YAML
  parameters: TemplateParameter[];   // 可配置参数
  version: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  usageCount: number;                // 被实例化次数
  rating?: number;                   // 用户评分
}

interface TemplateParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array';
  description: string;
  defaultValue?: string | number | boolean | string[];
  required: boolean;
}

interface TemplateVersion {
  id: string;
  templateId: string;
  version: number;
  yamlDefinition: string;
  changeSummary: string;
  createdAt: Date;
  createdBy: string;
}
```

### 3.4 动态参数 API

动态参数通过现有 Pipeline Run 触发接口扩展：

```
POST /api/v1/pipelines/:pipelineId/run
```

增强请求体:

```typescript
interface TriggerRunRequest {
  triggerType?: 'manual' | 'api' | 'event' | 'schedule' | 'retry';
  triggerBy?: string;
  params?: Record<string, string | number | boolean | string[]>;  // 新增
  branch?: string;   // 新增：指定分支
  commitSha?: string; // 新增：指定 commit
}
```

增强响应:

```typescript
interface TriggerRunResponse {
  id: string;
  pipelineId: string;
  version: number;
  status: 'pending' | 'running' | '...';
  injectedParams: Record<string, unknown>;  // 新增：最终注入的参数（含默认值合并）
  dynamicStages: string[];                  // 新增：动态生成的 Stage 列表
  estimatedBudget?: {                       // 新增：预算预估
    timeMs: number;
    costCents: number;
  };
}
```

## 四、数据库变更

### 4.1 新增表：pipeline_versions

存储 Pipeline 版本历史（当前版本信息存在 pipelines.config 中，需独立版本表）。

```sql
CREATE TABLE IF NOT EXISTS pipeline_versions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id     UUID NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
  version         INT NOT NULL,
  yaml_definition TEXT NOT NULL,
  spec            JSONB NOT NULL DEFAULT '{}',
  change_summary  TEXT,
  tags            TEXT[] DEFAULT '{}',
  is_baseline     BOOLEAN NOT NULL DEFAULT false,
  parent_version_id UUID REFERENCES pipeline_versions(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID REFERENCES users(id),

  UNIQUE(pipeline_id, version)
);
CREATE INDEX idx_pipeline_versions_pipeline ON pipeline_versions(pipeline_id, version DESC);
CREATE INDEX idx_pipeline_versions_baseline ON pipeline_versions(pipeline_id, is_baseline);
CREATE INDEX idx_pipeline_versions_tags ON pipeline_versions USING gin(tags);
```

### 4.2 新增表：pipeline_budgets

存储 Pipeline 执行预算配置。

```sql
CREATE TABLE IF NOT EXISTS pipeline_budgets (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id         UUID NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
  max_duration_ms     BIGINT,
  time_warning_pct    INT DEFAULT 80,
  time_policy         VARCHAR(20) DEFAULT 'warn',
  max_cpu_core_hours  DECIMAL(10,2),
  max_memory_gb_hours DECIMAL(10,2),
  resource_warning_pct INT DEFAULT 80,
  resource_policy     VARCHAR(20) DEFAULT 'warn',
  max_cost_cents      BIGINT,
  cost_warning_pct    INT DEFAULT 80,
  cost_policy         VARCHAR(20) DEFAULT 'warn',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(pipeline_id)
);
```

### 4.3 新增表：pipeline_budget_usage

记录每次 Run 的预算使用情况（用于预估和监控）。

```sql
CREATE TABLE IF NOT EXISTS pipeline_budget_usage (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id          UUID NOT NULL REFERENCES pipeline_runs(id) ON DELETE CASCADE,
  pipeline_id     UUID NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
  cpu_core_hours  DECIMAL(10,4) DEFAULT 0,
  memory_gb_hours DECIMAL(10,4) DEFAULT 0,
  cost_cents      BIGINT DEFAULT 0,
  alerts          JSONB DEFAULT '[]',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(run_id)
);
CREATE INDEX idx_pipeline_budget_usage_pipeline ON pipeline_budget_usage(pipeline_id, created_at DESC);
```

### 4.4 新增表：pipeline_templates

存储流水线模板。

```sql
CREATE TABLE IF NOT EXISTS pipeline_templates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name            VARCHAR(200) NOT NULL,
  description     TEXT,
  category        VARCHAR(50) NOT NULL DEFAULT 'custom',
  tags            TEXT[] DEFAULT '{}',
  yaml_definition TEXT NOT NULL,
  parameters      JSONB NOT NULL DEFAULT '[]',
  version         INT NOT NULL DEFAULT 1,
  created_by      UUID REFERENCES users(id),
  usage_count     INT DEFAULT 0,
  rating          DECIMAL(2,1),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_pipeline_templates_tenant ON pipeline_templates(tenant_id);
CREATE INDEX idx_pipeline_templates_category ON pipeline_templates(category);
CREATE INDEX idx_pipeline_templates_tags ON pipeline_templates USING gin(tags);

-- 模板版本历史
CREATE TABLE IF NOT EXISTS pipeline_template_versions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id     UUID NOT NULL REFERENCES pipeline_templates(id) ON DELETE CASCADE,
  version         INT NOT NULL,
  yaml_definition TEXT NOT NULL,
  parameters      JSONB NOT NULL DEFAULT '[]',
  change_summary  TEXT,
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(template_id, version)
);
```

### 4.5 修改表：pipeline_runs

增加运行时参数和动态 Stage 追踪字段 `runtime_params`。

```sql
ALTER TABLE pipeline_runs
  ADD COLUMN IF NOT EXISTS runtime_params JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS dynamic_stages TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS estimated_cost_cents BIGINT,
  ADD COLUMN IF NOT EXISTS budget_exceeded BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS budget_policy_action VARCHAR(20);

CREATE INDEX idx_pipeline_runs_budget_exceeded ON pipeline_runs(budget_exceeded) WHERE budget_exceeded = true;
```

### 4.6 迁移脚本

```sql
-- Migration 080: Pipeline version control, budget, templates
-- Phase 1 核心流水线增强
```

## 五、前端设计

### 5.1 版本历史页面

**路由**: `/pipelines/:id/versions`

**页面结构**:
```
┌─────────────────────────────────────────────┐
│  版本历史  Pipeline: my-app-ci              │
├─────────────────────────────────────────────┤
│  [对比] [回退] [设置基线]                    │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │ ☐ v12  [baseline]  release-1.0        │  │
│  │    2026-05-05 10:30  by admin          │  │
│  │    变更: 添加部署阶段，超时从 30→60min  │  │
│  │    [详情] [对比] [标签]                 │  │
│  ├────────────────────────────────────────┤  │
│  │ ☐ v11                                 │  │
│  │    2026-05-04 15:20  by developer      │  │
│  │    变更: 修改构建参数 NODE_ENV          │  │
│  ├────────────────────────────────────────┤  │
│  │   v10                                 │  │
│  │    2026-05-03 09:00  by admin          │  │
│  │    变更: 添加单元测试阶段              │  │
│  └────────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

**交互流程**:
1. 选择两个版本 → 点击"对比" → 跳转 diff 页面
2. 选择某个版本 → 点击"回退" → 确认弹窗 → 创建新版本
3. 点击"设置基线" → 标记/取消基线版本

### 5.2 版本 Diff 页面

**路由**: `/pipelines/:id/versions/:versionId/diff?target=:targetVersionId`

**页面结构**:
```
┌─────────────────────────────────────────────┐
│  版本对比: v12 ← v10                        │
├─────────────────────────────────────────────┤
│  统计: +3 添加  -1 删除  ~2 修改             │
├─────────────────────────────────────────────┤
│                                              │
│  Stage: Build                                │
│  ┌────────────────────────────────────────┐  │
│  │   timeout: ~~30~~ → 60          [改]   │  │
│  │   + cache:                      [增]   │  │
│  │   +   enabled: true                    │  │
│  │   +   paths: [node_modules]            │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  Stage: Deploy (removed)              [删]   │
│  ┌────────────────────────────────────────┐  │
│  │   - name: Deploy                       │  │
│  │   - uses: deploy@k8s                   │  │
│  └────────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

### 5.3 预算配置页面

**路由**: `/pipelines/:id/budget`

**页面结构**:
```
┌─────────────────────────────────────────────┐
│  执行预算  Pipeline: my-app-ci              │
├─────────────────────────────────────────────┤
│                                              │
│  时间预算                                    │
│  ┌────────────────────────────────────────┐  │
│  │ 最大时长: [60] 分钟                     │  │
│  │ 告警阈值: [80]%                        │  │
│  │ 超支策略: ○ 仅告警  ● 阻断  ○ 回滚      │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  资源预算                                    │
│  ┌────────────────────────────────────────┐  │
│  │ 最大 CPU: [10] 核时                     │  │
│  │ 最大内存: [20] GB·时                    │  │
│  │ 告警阈值: [80]%                        │  │
│  │ 超支策略: ○ 仅告警  ● 阻断  ○ 回滚      │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  费用预算                                    │
│  ┌────────────────────────────────────────┐  │
│  │ 最大费用: [500] 美分                    │  │
│  │ 告警阈值: [80]%                        │  │
│  │ 超支策略: ● 仅告警  ○ 阻断  ○ 回滚      │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  [保存配置] [重置]                           │
└─────────────────────────────────────────────┘
```

### 5.4 预算仪表盘

**路由**: `/pipelines/:id/budget/dashboard`

**页面结构**:
```
┌─────────────────────────────────────────────┐
│  预算监控  Pipeline: my-app-ci              │
├─────────────────────────────────────────────┤
│                                              │
│  最近 Run #1234                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐     │
│  │ 时间     │ │ CPU      │ │ 费用     │     │
│  │ ████░░░░ │ │ ██░░░░░░ │ │ █░░░░░░░ │     │
│  │ 45/60min │ │ 4/10核时 │ │ 50/500   │     │
│  │ 75%      │ │ 40%      │ │ 10%      │     │
│  └──────────┘ └──────────┘ └──────────┘     │
│                                              │
│  趋势（最近 30 次 Run）                       │
│  ┌────────────────────────────────────────┐  │
│  │ 📊 费用趋势折线图                       │  │
│  │ 📊 时长趋势折线图                       │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  预算超支告警                                 │
│  ┌────────────────────────────────────────┐  │
│  │ ⚠️  Run #1230 时间预算超支 (62/60min)   │  │
│  │ ⚠️  Run #1228 CPU 预算告警 (85%)        │  │
│  └────────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

### 5.5 模板库页面

**路由**: `/pipeline-templates`

**页面结构**:
```
┌─────────────────────────────────────────────┐
│  模板库                          [创建模板]  │
├─────────────────────────────────────────────┤
│  分类: [全部] [语言] [平台] [用途] [自定义]  │
│  搜索: [________________]                   │
├─────────────────────────────────────────────┤
│                                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐     │
│  │ Node.js  │ │ Go Build │ │ Java     │     │
│  │ Build    │ │          │ │ Maven    │     │
│  │ ⭐ 4.5   │ │ ⭐ 4.2   │ │ ⭐ 4.8   │     │
│  │ 1.2k 次  │ │ 856 次   │ │ 2.1k 次  │     │
│  │ [使用]   │ │ [使用]   │ │ [使用]   │     │
│  └──────────┘ └──────────┘ └──────────┘     │
│  ┌──────────┐ ┌──────────┐                  │
│  │ Frontend │ │ Docker   │                  │
│  │ Deploy   │ │ Build    │                  │
│  │ ⭐ 3.9   │ │ ⭐ 4.1   │                  │
│  │ 654 次   │ │ 980 次   │                  │
│  │ [使用]   │ │ [使用]   │                  │
│  └──────────┘ └──────────┘                  │
└─────────────────────────────────────────────┘
```

**实例化弹窗**:
```
┌─────────────────────────────────────────────┐
│  使用模板: Node.js Build                     │
├─────────────────────────────────────────────┤
│  名称: [my-app-ci________________]           │
│  所属项目: [frontend-app______▼]             │
│                                              │
│  参数配置:                                   │
│  Node 版本: [18____]                         │
│  包管理器: [npm___▼] (npm/yarn/pnpm)        │
│  测试命令: [npm test_______]                 │
│  构建命令: [npm run build__]                 │
│                                              │
│  [取消] [创建 Pipeline]                      │
└─────────────────────────────────────────────┘
```

### 5.6 前端文件变更

| 文件 | 操作 | 描述 |
|------|------|------|
| `src/pages/PipelineVersions/index.tsx` | 新建 | 版本历史页面 |
| `src/pages/PipelineDiff/index.tsx` | 新建 | 版本对比页面 |
| `src/pages/PipelineBudget/index.tsx` | 新建 | 预算配置 + 仪表盘页面 |
| `src/pages/PipelineTemplates/index.tsx` | 新建 | 模板库页面 |
| `src/pages/PipelineEditor/index.tsx` | 修改 | 添加"保存为模板"按钮 |
| `src/api/pipeline.ts` | 修改 | 新增版本/预算/模板 API 调用 |
| `src/components/DiffViewer/index.tsx` | 新建 | 通用 YAML Diff 组件 |
| `src/components/BudgetGauge/index.tsx` | 新建 | 预算进度仪表 |

## 六、测试策略

### 6.1 单元测试

| 模块 | 文件 | 测试用例 |
|------|------|----------|
| PipelineVersionService | `services/pipeline/PipelineVersionService.ts` | 版本创建/对比/回退/标签/基线（15 cases） |
| BudgetService | `services/pipeline/BudgetService.ts` | 预算配置/预估/监控/超支策略（12 cases） |
| TemplateService | `services/pipeline/TemplateService.ts` | 模板 CRUD/实例化/版本管理（10 cases） |
| DynamicParamsResolver | `services/pipeline/DynamicParamsResolver.ts` | 参数注入/动态 Stage 生成（8 cases） |
| PipelineEngine (增强) | `engine/PipelineEngine.ts` | 预算中断/动态参数传递（6 cases） |

### 6.2 集成测试

| 场景 | 描述 |
|------|------|
| 版本回退完整流程 | 创建 Pipeline → 修改 3 次 → 回退到 v2 → 验证 YAML 恢复 |
| 预算阻断执行 | 设置时间预算 5s → 触发长运行 Pipeline → 验证被阻断 |
| 模板实例化 | 选择模板 → 传入参数 → 创建 Pipeline → 验证参数正确注入 |
| 动态 Stage 生成 | 传入 `skipTests=true` → 验证 Test Stage 未生成 |

### 6.3 E2E 测试

| 场景 | 描述 |
|------|------|
| 版本管理 E2E | 前端操作：查看版本 → 对比 → 回退 → 验证新版本创建 |
| 预算配置 E2E | 前端操作：配置预算 → 触发 Run → 监控仪表盘 → 验证告警 |
| 模板使用 E2E | 前端操作：选择模板 → 填写参数 → 创建 → 触发 Run → 验证成功 |

### 6.4 性能测试

| 指标 | 目标 |
|------|------|
| 版本对比响应时间 | < 200ms（500 行 YAML diff） |
| 模板列表加载 | < 500ms（100 模板） |
| 预算预估计算 | < 100ms |

## 七、非功能性要求

### 7.1 性能

| 指标 | 目标 |
|------|------|
| API P99 延迟 | < 200ms |
| Pipeline 版本创建 | < 50ms |
| 版本 Diff 计算 | < 200ms（500 行 YAML） |
| 预算预估计算 | < 100ms |

### 7.2 可用性

| 指标 | 目标 |
|------|------|
| Pipeline 创建成功率 | > 99.9% |
| 执行中断率 | < 0.1% |

### 7.3 安全性

| 要求 | 实现 |
|------|------|
| Tenant 隔离 | 所有 API 通过 `x-tenant-id` header 过滤数据 |
| 权限控制 | 版本修改/删除需 admin 权限，查看需 member 权限 |
| 模板注入防护 | 模板 YAML 解析时验证安全边界（防 RCE） |
| 审计日志 | 版本创建/回退/基线变更写入审计日志 |

### 7.4 可维护性

| 要求 | 实现 |
|------|------|
| 代码覆盖率 | > 80% |
| API 文档 | 所有端点含 OpenAPI/Swagger schema |
| 类型安全 | TypeScript strict mode |

## 八、实施计划

### 8.1 工作量估算

| 模块 | 后端 (天) | 前端 (天) | 测试 (天) |
|------|:---------:|:---------:|:---------:|
| 版本控制 | 2 | 3 | 1 |
| 执行预算 | 2 | 2 | 1 |
| 模板库 | 2 | 2 | 1 |
| 动态参数 | 1 | 1 | 0.5 |
| **合计** | **7** | **8** | **3.5** |

### 8.2 依赖关系

```
版本控制 ──→ 版本 Diff 前端
    │
    ├──→ 回退功能（依赖版本读取）
    │
    └──→ 基线管理

执行预算 ──→ 预算预估（依赖历史 Run 数据）
    │
    └──→ 预算监控（依赖 PipelineEngine 集成）

模板库 ──→ 模板 CRUD
    │
    └──→ 实例化（依赖 Pipeline 创建）

动态参数 ──→ 参数解析器
    │
    └──→ PipelineEngine 集成
```

### 8.3 实施顺序

1. **Week 1**: 版本控制后端（Repository + Service + API）
2. **Week 1-2**: 版本控制前端（Versions 页面 + Diff 页面）
3. **Week 2**: 执行预算后端（BudgetService + Engine 集成）
4. **Week 2-3**: 执行预算前端（Budget 页面 + 仪表盘）
5. **Week 3**: 模板库后端 + 前端
6. **Week 3**: 动态参数 + 集成测试
7. **Week 3**: E2E 测试 + 性能优化

---

_文档版本: v1.0 | 创建日期: 2026-05-05 | 状态: 已验证_
