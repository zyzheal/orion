# 部署发布详细规格 (Phase 1)

> **日期**: 2026-05-05
> **状态**: 已验证
> **能力域**: 4. 部署发布
> **目标成熟度**: L3 → L3.3
> **关键交付**: 发布窗口管理、依赖协调

## 一、功能描述

### 1.1 现状评估 (L3)

Orion 当前已实现：
- SmartDeployService（风险评估驱动部署策略选择）
- DeploymentWorkflow（blue-green/canary/rolling 策略执行）
- CanaryAnalysisService（ML 金丝雀分析 + Prometheus 集成 + PostgreSQL Repository）
- RollbackService（手动/自动回滚 + 健康验证 + PostgreSQL Repository）
- DeploymentVerifier（部署后健康检查）
- DeploymentStrategyEngine（基于风险的策略推荐）
- Deployments 表 + deployment_events 审计表
- DeployController（deploy/rollback/history API）
- 临时环境部署支持

**不足**：
- 无发布窗口管理（任何时间均可部署，无维护窗口/禁发期概念）
- 无多服务部署依赖协调（服务 A 必须在服务 B 之前部署）
- 无渐进式部署进度控制（金丝雀比例手动调整，无自动推进）
- 无 Release Notes 自动生成
- 部署策略配置较简单（缺少基于环境/团队的策略差异化）

### 1.2 Phase 1 目标 (L3.3)

| 功能模块 | 描述 | 验收等级 |
|----------|------|:--------:|
| 发布窗口管理 | 维护窗口配置、禁发期、紧急发布通道 | L3.3 |
| 依赖协调 | 多服务部署顺序编排、跨服务依赖检测 | L3.3 |
| 渐进式推进 | 金丝雀比例自动推进（5%→25%→50%→100%） | L3.3 |
| Release Notes | 基于 commit/GitHub PR 自动生成发布说明 | L2.5 |

## 二、验收标准

### 2.1 发布窗口管理

| # | 标准 | 验证方式 |
|---|------|----------|
| W1 | 支持配置维护窗口（cron 表达式 + 时长） | API 测试 |
| W2 | 支持配置禁发期（如周五下午、节假日） | API 测试 |
| W3 | 非窗口期部署请求被拒绝（除非紧急通道） | API 测试 |
| W4 | 紧急发布通道（需 admin 审批 + 原因记录） | API 测试 |
| W5 | 窗口冲突预警（即将进入禁发期时提醒） | API 测试 |
| W6 | 窗口日历视图（前端展示未来 30 天窗口） | 前端验证 |

### 2.2 依赖协调

| # | 标准 | 验证方式 |
|---|------|----------|
| D1 | 支持声明服务依赖关系（A → B → C） | API 测试 |
| D2 | 部署前检测依赖拓扑，计算最优部署顺序 | API 测试 |
| D3 | 依赖服务未就绪时阻断部署 | 集成测试 |
| D4 | 循环依赖检测并告警 | 单元测试 |
| D5 | 跨服务部署进度可视化 | 前端验证 |

### 2.3 渐进式推进

| # | 标准 | 验证方式 |
|---|------|----------|
| P1 | 可配置金丝雀推进阶段（如 5→25→50→100%） | API 测试 |
| P2 | 每个阶段完成后自动触发金丝雀分析 | 集成测试 |
| P3 | 分析通过则自动推进到下一阶段 | 集成测试 |
| P4 | 分析失败则自动回滚到上一阶段 | 集成测试 |
| P5 | 支持手动跳过阶段（需确认） | API 测试 |
| P6 | 推进过程实时监控（流量/错误率/延迟） | 前端验证 |

### 2.4 Release Notes

| # | 标准 | 验证方式 |
|---|------|----------|
| R1 | 基于两次部署间的 commit 生成 Release Notes | API 测试 |
| R2 | 按类型分类（feat/fix/chore/docs） | 前端验证 |
| R3 | 关联 GitHub PR 号和标题 | API 测试 |
| R4 | 支持自定义模板（Markdown 格式） | API 测试 |

## 三、API 设计

### 3.1 发布窗口 API

```
Base: /api/v1/deploy-windows
```

| 方法 | 路径 | 描述 | 请求体 | 响应 |
|------|------|------|--------|------|
| POST | `/` | 创建发布窗口 | `WindowConfig` | `{ id, name, schedule, status }` |
| GET | `/` | 获取窗口列表 | query: tenantId, page, limit | `{ data: WindowConfig[], total }` |
| GET | `/calendar` | 获取窗口日历 | query: start, end | `{ events: [{ start, end, type, name }] }` |
| GET | `/check` | 检查当前是否可部署 | query: environment | `{ allowed: boolean, reason?, nextWindow? }` |
| PUT | `/:id` | 更新窗口配置 | `WindowConfigUpdate` | `{ ... }` |
| DELETE | `/:id` | 删除窗口 | - | `{ success }` |

**WindowConfig 结构**:

```typescript
interface WindowConfig {
  id: string;
  tenantId: string;
  name: string;
  type: 'maintenance' | 'blackout';          // 维护窗口 or 禁发期
  schedule: string;                           // cron 表达式
  durationMinutes: number;                    // 持续时间
  environments: string[];                     // 适用环境
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

**DeployCheck 响应**:

```typescript
interface DeployCheck {
  allowed: boolean;
  reason?: string;                            // 'blackout', 'no-window', 'emergency-only'
  nextWindow?: {
    name: string;
    startsAt: Date;
    endsAt: Date;
  };
  emergencyAvailable: boolean;                // 是否有紧急发布权限
}
```

### 3.2 紧急发布 API

```
Base: /api/v1/deploy-emergencies
```

| 方法 | 路径 | 描述 | 请求体 | 响应 |
|------|------|------|--------|------|
| POST | `/` | 申请紧急发布 | `{ deploymentId, reason, approvedBy }` | `{ id, status, approvedAt }` |
| GET | `/` | 获取紧急发布列表 | query: status, page, limit | `{ data: EmergencyDeploy[], total }` |
| GET | `/:id` | 获取紧急发布详情 | - | `{ id, reason, approvedBy, auditLog }` |

### 3.3 依赖协调 API

```
Base: /api/v1/deploy-dependencies
```

| 方法 | 路径 | 描述 | 请求体 | 响应 |
|------|------|------|--------|------|
| POST | `/` | 声明服务依赖 | `{ service, dependsOn[], environment }` | `{ id, service, dependsOn }` |
| GET | `/topology` | 获取部署拓扑 | query: environment | `{ nodes: [], edges: [], deployOrder: [] }` |
| GET | `/check` | 检查部署依赖 | query: service, environment | `{ satisfied: boolean, blockers: [] }` |
| GET | `/circular` | 检测循环依赖 | - | `{ cycles: string[][] }` |

**DeployTopology 结构**:

```typescript
interface DeployTopology {
  nodes: { id: string; name: string; status: 'ready' | 'deploying' | 'waiting' }[];
  edges: { from: string; to: string }[];
  deployOrder: string[];  // 拓扑排序结果
}
```

### 3.4 渐进式推进 API

```
Base: /api/v1/deployments/:deploymentId/progressive
```

| 方法 | 路径 | 描述 | 请求体 | 响应 |
|------|------|------|--------|------|
| GET | `/status` | 获取推进状态 | - | `{ currentStage, canaryPercent, stages[], metrics }` |
| POST | `/advance` | 手动推进到下一阶段 | - | `{ success, newStage, newCanaryPercent }` |
| POST | `/rollback-stage` | 回滚到上一阶段 | - | `{ success, previousStage }` |
| PUT | `/config` | 更新推进配置 | `{ stages: [{ percent, minDurationMs }] }` | `{ success }` |

**ProgressiveStatus 结构**:

```typescript
interface ProgressiveStatus {
  deploymentId: string;
  currentStage: number;
  canaryPercent: number;
  stages: ProgressiveStage[];
  metrics: CanaryMetrics;
  autoAdvance: boolean;
  lastAnalysisAt?: Date;
}

interface ProgressiveStage {
  index: number;
  canaryPercent: number;
  minDurationMs: number;
  status: 'pending' | 'running' | 'analyzing' | 'completed' | 'failed';
  startedAt?: Date;
  completedAt?: Date;
  canaryAnalysis?: { score: number; passed: boolean };
}
```

### 3.5 Release Notes API

```
Base: /api/v1/deployments/:deploymentId/release-notes
```

| 方法 | 路径 | 描述 | 请求体 | 响应 |
|------|------|------|--------|------|
| GET | `/generate` | 生成 Release Notes | query: from, to | `{ markdown, sections: { feat, fix, chore } }` |
| PUT | `/template` | 更新 Release Notes 模板 | `{ template: string }` | `{ success }` |
| GET | `/template` | 获取当前模板 | - | `{ template }` |

## 四、数据库变更

### 4.1 新增表：deploy_windows

```sql
CREATE TABLE IF NOT EXISTS deploy_windows (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name            VARCHAR(200) NOT NULL,
  type            VARCHAR(20) NOT NULL,             -- 'maintenance' | 'blackout'
  schedule        VARCHAR(100) NOT NULL,            -- cron 表达式
  duration_minutes INT NOT NULL,
  environments    TEXT[] NOT NULL DEFAULT '{}',
  description     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_deploy_windows_tenant ON deploy_windows(tenant_id);
CREATE INDEX idx_deploy_windows_type ON deploy_windows(type);
```

### 4.2 新增表：deploy_emergencies

```sql
CREATE TABLE IF NOT EXISTS deploy_emergencies (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  deployment_id   UUID NOT NULL REFERENCES deployments(id) ON DELETE CASCADE,
  reason          TEXT NOT NULL,
  requested_by    UUID REFERENCES users(id),
  approved_by     UUID REFERENCES users(id),
  status          VARCHAR(20) NOT NULL DEFAULT 'pending',
  audit_log       JSONB DEFAULT '[]',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_deploy_emergencies_tenant ON deploy_emergencies(tenant_id);
CREATE INDEX idx_deploy_emergencies_status ON deploy_emergencies(status);
```

### 4.3 新增表：deploy_service_dependencies

```sql
CREATE TABLE IF NOT EXISTS deploy_service_dependencies (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  service         VARCHAR(200) NOT NULL,
  depends_on      TEXT[] NOT NULL DEFAULT '{}',
  environment     VARCHAR(100) NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(tenant_id, service, environment)
);
CREATE INDEX idx_deploy_service_deps_tenant ON deploy_service_dependencies(tenant_id);
CREATE INDEX idx_deploy_service_deps_env ON deploy_service_dependencies(environment);
```

### 4.4 新增表：deploy_progressive_stages

```sql
CREATE TABLE IF NOT EXISTS deploy_progressive_stages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deployment_id   UUID NOT NULL REFERENCES deployments(id) ON DELETE CASCADE,
  stage_index     INT NOT NULL,
  canary_percent  INT NOT NULL,
  min_duration_ms BIGINT NOT NULL DEFAULT 300000,
  status          VARCHAR(20) NOT NULL DEFAULT 'pending',
  analysis_score  DECIMAL(5,2),
  analysis_passed BOOLEAN,
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(deployment_id, stage_index)
);
CREATE INDEX idx_deploy_progressive_deployment ON deploy_progressive_stages(deployment_id);
CREATE INDEX idx_deploy_progressive_status ON deploy_progressive_stages(status);
```

### 4.5 修改 deployments 表

```sql
ALTER TABLE deployments
  ADD COLUMN IF NOT EXISTS release_notes TEXT,
  ADD COLUMN IF NOT EXISTS window_id UUID REFERENCES deploy_windows(id),
  ADD COLUMN IF NOT EXISTS emergency_id UUID REFERENCES deploy_emergencies(id),
  ADD COLUMN IF NOT EXISTS canary_percent INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS progressive_stage INT DEFAULT 0;
```

### 4.6 迁移脚本

```sql
-- Migration 083: Deploy release windows, dependency coordination, progressive deployment
```

## 五、前端设计

### 5.1 发布窗口日历

**路由**: `/deploy-windows`

**页面结构**:
```
┌─────────────────────────────────────────────┐
│  发布窗口管理                    [新建窗口]  │
├─────────────────────────────────────────────┤
│                                              │
│  2026 年 5 月                                │
│  ┌────────────────────────────────────────┐  │
│  │ 一  二  三  四  五  六  日              │  │
│  │             1   2   3   4              │  │
│  │ 5   6   7  [黑] 9  10  11              │  │
│  │ 12 [维] 14  15  16 [黑] 18             │  │
│  │ 19  20  21  22  23  24  25             │  │
│  │ [维] 27  28  29  30                    │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  图例: [维]=维护窗口 [黑]=禁发期               │
│                                              │
│  窗口列表                                     │
│  ┌────────────────────────────────────────┐  │
│  │ 名称          │ 类型  │ 时间     │ 环境 │  │
│  │ 周二凌晨维护  │ 维护  │ 02:00-04:00│ prod│  │
│  │ 周五下午禁发  │ 禁发  │ 14:00-24:00│ all │  │
│  └────────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

### 5.2 依赖拓扑图

**路由**: `/deploy-dependencies`

**页面结构**:
```
┌─────────────────────────────────────────────┐
│  部署依赖拓扑  Environment: production       │
├─────────────────────────────────────────────┤
│                                              │
│  ┌─────────┐     ┌─────────┐     ┌────────┐  │
│  │ Gateway │ ──→ │  Auth   │ ──→ │  API   │  │
│  │  ✓ Ready│     │ ✓ Ready │     │ Deploy │  │
│  └─────────┘     └─────────┘     │  ...   │  │
│                    │             └────────┘  │
│                    │                          │
│  ┌─────────┐     ┌─▼───────┐                │
│  │  DB-Mig │ ──→ │  User   │                │
│  │ ✓ Ready │     │ Service │                │
│  └─────────┘     └─────────┘                │
│                                              │
│  部署顺序: Gateway → DB-Mig → Auth → User → API │
│                                              │
│  [添加依赖] [重新计算] [部署全部]               │
└─────────────────────────────────────────────┘
```

### 5.3 渐进式部署页面

**路由**: `/deployments/:id/progressive`

**页面结构**:
```
┌─────────────────────────────────────────────┐
│  渐进式部署  Deployment #5678                │
├─────────────────────────────────────────────┤
│                                              │
│  当前阶段: Stage 2/4  (25% 流量)              │
│  ┌────────────────────────────────────────┐  │
│  │ Stage 1: 5%   ████████████ ✓ 完成       │  │
│  │ Stage 2: 25%  ██████░░░░░ → 分析中      │  │
│  │ Stage 3: 50%  ░░░░░░░░░░░ 等待中        │  │
│  │ Stage 4: 100% ░░░░░░░░░░░ 等待中        │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  金丝雀指标                                   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐     │
│  │ 错误率   │ │ 延迟 P99 │ │ 分析得分 │     │
│  │ 0.12%    │ │ 145ms    │ │ 92.5     │     │
│  │ ✓ 正常   │ │ ✓ 正常   │ │ ✓ 通过   │     │
│  └──────────┘ └──────────┘ └──────────┘     │
│                                              │
│  [手动推进] [回退阶段] [查看详情]              │
└─────────────────────────────────────────────┘
```

### 5.4 前端文件变更

| 文件 | 操作 | 描述 |
|------|------|------|
| `src/pages/DeployWindows/index.tsx` | 新建 | 发布窗口管理 + 日历 |
| `src/pages/DeployDependencies/index.tsx` | 新建 | 依赖拓扑图 |
| `src/pages/DeployProgressive/index.tsx` | 新建 | 渐进式部署页面 |
| `src/pages/ReleaseNotes/index.tsx` | 新建 | Release Notes 生成页面 |
| `src/api/deployWindows.ts` | 新建 | 窗口 API 客户端 |
| `src/api/deployDeps.ts` | 新建 | 依赖 API 客户端 |
| `src/components/WindowCalendar/index.tsx` | 新建 | 窗口日历组件 |
| `src/components/DependencyGraph/index.tsx` | 新建 | 依赖拓扑图组件 |
| `src/components/ProgressiveStages/index.tsx` | 新建 | 渐进阶段组件 |

## 六、测试策略

### 6.1 单元测试

| 模块 | 文件 | 测试用例 |
|------|------|----------|
| DeployWindowService | `services/deploy/DeployWindowService.ts` | 窗口检查/禁发期/紧急通道（10 cases） |
| DeployDependencyService | `services/deploy/DeployDependencyService.ts` | 拓扑排序/循环依赖/就绪检查（8 cases） |
| ProgressiveDeployService | `services/deploy/ProgressiveDeployService.ts` | 阶段推进/分析/回退（10 cases） |
| ReleaseNotesGenerator | `services/deploy/ReleaseNotesGenerator.ts` | commit 解析/分类生成（6 cases） |

### 6.2 集成测试

| 场景 | 描述 |
|------|------|
| 禁发期阻断 | 配置禁发期 → 尝试部署 → 验证被拒绝 → 紧急通道部署 |
| 依赖顺序部署 | 声明 A→B→C 依赖 → 触发全量部署 → 验证按序部署 |
| 金丝雀自动推进 | 配置 3 阶段 → 部署 → 分析通过 → 自动推进到下一阶段 |

### 6.3 E2E 测试

| 场景 | 描述 |
|------|------|
| 发布窗口 E2E | 创建窗口 → 查看日历 → 尝试非窗口期部署 → 验证拦截 |
| 渐进式部署 E2E | 创建部署 → 观察阶段推进 → 验证分析得分 → 完成 |

## 七、非功能性要求

### 7.1 性能

| 指标 | 目标 |
|------|------|
| 窗口检查响应 | < 50ms |
| 拓扑排序计算 | < 100ms（50 服务） |
| 金丝雀分析触发 | < 200ms |

### 7.2 安全性

| 要求 | 实现 |
|------|------|
| 紧急发布审批 | 需 admin 权限 + 审计日志 |
| Tenant 隔离 | 所有查询按 tenant_id 过滤 |

## 八、实施计划

| 模块 | 后端 (天) | 前端 (天) | 测试 (天) |
|------|:---------:|:---------:|:---------:|
| 发布窗口管理 | 1.5 | 2 | 1 |
| 依赖协调 | 2 | 2 | 1 |
| 渐进式推进 | 2 | 2 | 1 |
| Release Notes | 1 | 1 | 0.5 |
| **合计** | **6.5** | **7** | **3.5** |

---

_文档版本: v1.0 | 创建日期: 2026-05-05 | 状态: 已验证_
