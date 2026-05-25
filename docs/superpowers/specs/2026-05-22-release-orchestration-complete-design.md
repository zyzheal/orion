# 发布编排模块完整设计（Release Orchestration Complete Design）

> 文档日期：2026-05-22
> 状态：设计完成，待实现
> 关联 DDL：现有 `004_pipeline`、`007_deployments`、`139_deployment_strategies`、`156_pipeline_budget`
> 菜单归属：交付（`/delivery`），图标 `CloudUploadOutlined`

---

## 1. 功能设计（后端）

### 1.1 业务闭环

发布编排模块实现"计划→编排→审批→执行→复盘"五步闭环：

```
发布计划（多应用联合）
        │
        ▼ (依赖分析 + 冲突检测)
  Dependency Analysis ───────► release_dependencies
        │
        ▼ (发布窗口 + 策略配置)
  Release Window Setup ──────► release_windows
        │
        ▼ (审批流集成)
  Approval Workflow ─────────► release_approvals
        │
        ▼ (风险评估 + 门禁)
  Risk Assessment ───────────► release_risk_assessments
        │
        ▼ (联动 Pipeline 引擎执行)
  Orchestrated Execution ────► release_runs
        │
        ▼ (复盘 + 指标收集)
  Retrospective ─────────────► release_retrospectives
```

**闭环触发关系**：
- 发布计划创建 → 自动分析应用依赖关系
- 依赖分析完成 → 推荐发布窗口
- 提交审批 → 根据风险等级走不同审批流
- 审批通过 → 在发布窗口内自动触发 Pipeline 执行
- 发布完成 → 自动收集发布指标 → 生成复盘报告

### 1.2 现有表分析

| 表名 | 迁移编号 | 字段数 | 用途 |
|------|----------|--------|------|
| `pipelines` | 004 | — | Pipeline 定义（CI/CD 流程） |
| `pipeline_runs` | 004 | — | Pipeline 运行记录 |
| `pipeline_stages` | 004 | — | Pipeline 阶段定义 |
| `deployments` | 007 | — | 部署记录 |
| `deployment_strategies` | 139 | 7 | 部署策略定义（canary/blue-green/rolling） |
| `pipeline_budgets` | 156 | — | Pipeline 预算 |

**不足**：
1. 缺少多应用联合发布编排实体
2. 缺少发布依赖关系管理
3. 缺少发布窗口管理
4. 缺少发布风险评估（独立于变更智能）
5. 缺少发布审批流记录

### 1.3 需新建表

#### 迁移 198：发布编排表

```sql
-- 198: Release Orchestration
-- 多应用联合发布编排、依赖管理、发布窗口、审批流、风险评估

-- release_plans 表（发布计划）
CREATE TABLE IF NOT EXISTS release_plans (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name              VARCHAR(200) NOT NULL,
  description       TEXT,
  version           VARCHAR(50) NOT NULL,                    -- 发布版本号，如 v2.5.0
  release_type      VARCHAR(30) NOT NULL DEFAULT 'standard', -- standard, hotfix, major, minor
  status            VARCHAR(30) NOT NULL DEFAULT 'draft',    -- draft, pending_approval, approved, scheduled, executing, completed, failed, rolled_back, cancelled
  priority          VARCHAR(20) NOT NULL DEFAULT 'medium',   -- low, medium, high, critical
  target_window_id  UUID,                                    -- 关联发布窗口
  risk_level        VARCHAR(20) DEFAULT 'unknown',           -- unknown, low, medium, high, critical
  risk_score        DECIMAL(3, 2),                           -- 0.00 - 1.00
  created_by        VARCHAR(100) NOT NULL,
  updated_by        VARCHAR(100),
  approved_by       VARCHAR(100),
  approved_at       TIMESTAMPTZ,
  scheduled_at      TIMESTAMPTZ,
  started_at        TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ,
  rollback_reason   TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);
CREATE INDEX idx_release_plans_tenant ON release_plans(tenant_id);
CREATE INDEX idx_release_plans_status ON release_plans(status);
CREATE INDEX idx_release_plans_type ON release_plans(release_type);
CREATE INDEX idx_release_plans_risk ON release_plans(risk_level);
CREATE INDEX idx_release_plans_created ON release_plans(created_at DESC);
CREATE INDEX idx_release_plans_version ON release_plans(version);

-- release_plan_items 表（发布计划中的应用项）
CREATE TABLE IF NOT EXISTS release_plan_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  plan_id           UUID NOT NULL REFERENCES release_plans(id) ON DELETE CASCADE,
  application       VARCHAR(200) NOT NULL,                   -- 应用名称
  current_version   VARCHAR(50) NOT NULL,
  target_version    VARCHAR(50) NOT NULL,
  pipeline_id       UUID,                                    -- 关联的 CI/CD Pipeline
  deployment_id     UUID,                                    -- 关联的部署记录
  strategy_id       UUID REFERENCES deployment_strategies(id) ON DELETE SET NULL,
  status            VARCHAR(30) NOT NULL DEFAULT 'pending',  -- pending, ready, deploying, deployed, verified, failed, skipped
  order_index       INT NOT NULL DEFAULT 0,                  -- 执行顺序
  depends_on        UUID[],                                  -- 依赖的其他 plan_item ID
  rollback_version  VARCHAR(50),                             -- 回滚目标版本
  health_check_url  VARCHAR(500),
  verified_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_release_plan_items_plan ON release_plan_items(plan_id);
CREATE INDEX idx_release_plan_items_app ON release_plan_items(application);
CREATE INDEX idx_release_plan_items_status ON release_plan_items(status);
CREATE INDEX idx_release_plan_items_order ON release_plan_items(order_index);

-- release_windows 表（发布窗口）
CREATE TABLE IF NOT EXISTS release_windows (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name              VARCHAR(200) NOT NULL,
  description       TEXT,
  environment       VARCHAR(30) NOT NULL DEFAULT 'prod',     -- dev, staging, prod
  day_of_week       JSONB NOT NULL DEFAULT '[]',             -- [1,2,3,4,5] 周一到周五
  time_start        VARCHAR(5) NOT NULL DEFAULT '10:00',     -- HH:MM
  time_end          VARCHAR(5) NOT NULL DEFAULT '18:00',
  max_concurrent    INT NOT NULL DEFAULT 3,                  -- 最大并发发布数
  blackout_dates    JSONB NOT NULL DEFAULT '[]',             -- 禁止发布日期 ["2026-10-01"]
  auto_approve_below DECIMAL(3,2) DEFAULT 0.30,             -- 风险分低于此值自动审批
  status            VARCHAR(30) NOT NULL DEFAULT 'active',
  created_by        VARCHAR(100) NOT NULL,
  updated_by        VARCHAR(100),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);
CREATE INDEX idx_release_windows_tenant ON release_windows(tenant_id);
CREATE INDEX idx_release_windows_env ON release_windows(environment);
CREATE INDEX idx_release_windows_status ON release_windows(status);

-- release_approvals 表（发布审批记录）
CREATE TABLE IF NOT EXISTS release_approvals (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  plan_id           UUID NOT NULL REFERENCES release_plans(id) ON DELETE CASCADE,
  approver          VARCHAR(100) NOT NULL,
  approver_role     VARCHAR(50),                             -- tech_lead, product_owner, ops_manager
  action            VARCHAR(20) NOT NULL,                    -- approve, reject, request_changes
  comment           TEXT,
  requested_changes  JSONB DEFAULT '[]',                     -- [{field, reason}]
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_release_approvals_plan ON release_approvals(plan_id);
CREATE INDEX idx_release_approvals_action ON release_approvals(action);
CREATE INDEX idx_release_approvals_created ON release_approvals(created_at DESC);

-- release_risk_assessments 表（发布风险评估）
CREATE TABLE IF NOT EXISTS release_risk_assessments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  plan_id           UUID NOT NULL REFERENCES release_plans(id) ON DELETE CASCADE,
  overall_score     DECIMAL(3, 2) NOT NULL,                  -- 0.00 - 1.00
  overall_level     VARCHAR(20) NOT NULL,                    -- low, medium, high, critical
  factors           JSONB NOT NULL DEFAULT '[]',             -- [{name, score, weight, description}]
  affected_services JSONB NOT NULL DEFAULT '[]',             -- [service_name]
  affected_users_estimate INT,                               -- 预估受影响用户数
  rollback_complexity VARCHAR(30) NOT NULL DEFAULT 'low',    -- low, medium, high, complex
  rollback_time_est_min INT,                                 -- 预估回滚时间（分钟）
  recommendations   JSONB NOT NULL DEFAULT '[]',             -- [{type, description}]
  change_intelligence_report_id UUID,                        -- 关联 AI 变更智能报告
  assessed_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_release_risk_plan ON release_risk_assessments(plan_id);
CREATE INDEX idx_release_risk_level ON release_risk_assessments(overall_level);
CREATE INDEX idx_release_risk_score ON release_risk_assessments(overall_score DESC);

-- release_runs 表（发布执行记录）
CREATE TABLE IF NOT EXISTS release_runs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  plan_id           UUID NOT NULL REFERENCES release_plans(id) ON DELETE CASCADE,
  window_id         UUID REFERENCES release_windows(id) ON DELETE SET NULL,
  status            VARCHAR(30) NOT NULL DEFAULT 'preparing', -- preparing, executing, paused, completed, failed, rolled_back
  current_item_id   UUID,                                    -- 当前执行的应用项
  total_items       INT NOT NULL DEFAULT 0,
  completed_items   INT NOT NULL DEFAULT 0,
  failed_items      INT NOT NULL DEFAULT 0,
  started_at        TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ,
  failure_reason    TEXT,
  rollback_triggered BOOLEAN NOT NULL DEFAULT false,
  rollback_at       TIMESTAMPTZ,
  created_by        VARCHAR(100) NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_release_runs_tenant ON release_runs(tenant_id);
CREATE INDEX idx_release_runs_plan ON release_runs(plan_id);
CREATE INDEX idx_release_runs_status ON release_runs(status);
CREATE INDEX idx_release_runs_created ON release_runs(created_at DESC);

-- release_run_logs 表（发布执行日志）
CREATE TABLE IF NOT EXISTS release_run_logs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  run_id            UUID NOT NULL REFERENCES release_runs(id) ON DELETE CASCADE,
  item_id           UUID REFERENCES release_plan_items(id) ON DELETE SET NULL,
  level             VARCHAR(20) NOT NULL DEFAULT 'info',     -- info, warn, error
  message           TEXT NOT NULL,
  metadata          JSONB NOT NULL DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_release_run_logs_run ON release_run_logs(run_id);
CREATE INDEX idx_release_run_logs_item ON release_run_logs(item_id);
CREATE INDEX idx_release_run_logs_level ON release_run_logs(level);
CREATE INDEX idx_release_run_logs_created ON release_run_logs(created_at DESC);

-- release_retrospectives 表（发布复盘）
CREATE TABLE IF NOT EXISTS release_retrospectives (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  plan_id           UUID NOT NULL REFERENCES release_plans(id) ON DELETE CASCADE,
  total_duration_min INT,                                    -- 发布总耗时（分钟）
  success_rate      DECIMAL(5, 2),                           -- 成功应用数 / 总应用数
  issues_encountered JSONB NOT NULL DEFAULT '[]',            -- [{description, severity, resolution}]
  metrics           JSONB NOT NULL DEFAULT '{}',             -- 原始指标
  lessons_learned   TEXT,
  action_items      JSONB NOT NULL DEFAULT '[]',             -- [{description, owner, due_date}]
  created_by        VARCHAR(100) NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_release_retro_plan ON release_retrospectives(plan_id);
CREATE INDEX idx_release_retro_created ON release_retrospectives(created_at DESC);

-- updated_at 触发器
CREATE TRIGGER set_release_plans_updated_at
  BEFORE UPDATE ON release_plans FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_release_plan_items_updated_at
  BEFORE UPDATE ON release_plan_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_release_windows_updated_at
  BEFORE UPDATE ON release_windows FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_release_runs_updated_at
  BEFORE UPDATE ON release_runs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_release_retrospectives_updated_at
  BEFORE UPDATE ON release_retrospectives FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE release_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE release_plan_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE release_windows ENABLE ROW LEVEL SECURITY;
ALTER TABLE release_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE release_risk_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE release_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE release_run_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE release_retrospectives ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_release_plans ON release_plans
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));
CREATE POLICY tenant_isolation_release_plan_items ON release_plan_items
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));
CREATE POLICY tenant_isolation_release_windows ON release_windows
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));
CREATE POLICY tenant_isolation_release_approvals ON release_approvals
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));
CREATE POLICY tenant_isolation_release_risk ON release_risk_assessments
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));
CREATE POLICY tenant_isolation_release_runs ON release_runs
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));
CREATE POLICY tenant_isolation_release_run_logs ON release_run_logs
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));
CREATE POLICY tenant_isolation_release_retro ON release_retrospectives
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));
```

### 1.4 核心功能

#### 1.4.1 多应用联合发布编排

**功能**：将多个应用的发布计划联合编排，统一管理和执行。

**编排模型**：

```typescript
interface ReleasePlan {
  name: string;
  version: string;
  releaseType: 'standard' | 'hotfix' | 'major' | 'minor';
  items: ReleasePlanItem[];
}

interface ReleasePlanItem {
  application: string;
  currentVersion: string;
  targetVersion: string;
  pipelineId?: string;
  strategyId?: string;        // 部署策略（canary/blue-green/rolling）
  orderIndex: number;         // 执行顺序
  dependsOn: string[];        // 依赖的应用项 ID
  rollbackVersion?: string;
}
```

**执行策略**：
- **顺序执行**：按 `order_index` 逐个执行
- **依赖执行**：根据 `depends_on` 构建 DAG，拓扑排序后执行
- **并行执行**：无依赖关系的项并行执行（由 `max_concurrent` 限制）

**与 Pipeline 引擎的集成**：
- 每个 `release_plan_item` 关联一个 `pipeline_id`
- 执行时调用 `PipelineEngine.run(pipelineId, { version: targetVersion })`
- 实时订阅 Pipeline SSE 事件更新进度
- 执行结果回写 `release_plan_items.status`

**实现代码位置**：
- Service: `orion-platform-service/src/services/release-orchestration/ReleaseOrchestrationService.ts`
- Engine: `orion-platform-service/src/services/release-orchestration/ReleaseEngine.ts`（DAG 调度）
- Controller: `orion-platform-service/src/api/controllers/ReleaseOrchestrationController.ts`
- Routes: `orion-platform-service/src/api/release-orchestration-routes.ts`

#### 1.4.2 发布依赖关系管理

**功能**：分析和可视化应用间的发布依赖，防止错误的发布顺序。

**依赖来源**：
1. 显式依赖：用户在编排计划中手动声明 `depends_on`
2. 隐式依赖：从以下来源自动推断
   - 服务调用链路（从 Service Mesh / API Gateway 获取）
   - 数据血缘（`data_lineage` 表）
   - CI/CD 构建依赖（`pipeline_stages` 中的触发关系）
   - 共享数据库/消息队列（从 CMDB 获取）

**依赖可视化**：
- 使用 DAG 图展示依赖关系
- 高亮循环依赖（错误状态）
- 自动计算关键路径
- 推荐最优执行顺序

**冲突检测**：
- 同一服务在不同发布计划中被修改 → 冲突告警
- 数据库 schema 变更与 API 变更不同步 → 冲突告警
- 发布窗口重叠 → 提醒

#### 1.4.3 发布窗口与审批流

**发布窗口**：
- 定义可发布的时间段（每周几、几点到几点）
- 支持设置禁止发布日期（节假日/大促日）
- 生产环境默认工作日 10:00-18:00
- 不同环境可配置不同窗口

**审批流**：
- 根据发布类型和风险等级自动选择审批流
- `release_type = hotfix` → 快速审批（1 人）
- `risk_score < auto_approve_below` → 自动审批
- `risk_score >= 0.7` → 多级审批（tech_lead + ops_manager）
- 审批结果写入 `release_approvals` 表
- 审批通过后状态变为 `approved`

**审批流集成**：
- 复用现有工作流引擎（`workflow_service`）
- 审批节点配置化
- 支持加签、转审、会签

#### 1.4.4 发布风险评估

**功能**：综合多维度指标评估发布风险，辅助决策。

**风险评估因子**：

| 因子 | 权重 | 评分规则 |
|------|------|----------|
| 变更范围 | 20% | 修改文件数：1-5=0.1, 6-20=0.3, 21-50=0.5, 50+=0.8 |
| 受影响服务数 | 15% | 1=0.1, 2-3=0.3, 4-6=0.5, 7+=0.8 |
| 数据库变更 | 15% | 无=0, 有 DML=0.3, 有 DDL=0.7, 有 Breaking=0.9 |
| 历史失败率 | 10% | 该应用近 10 次发布失败率 |
| 发布时段 | 10% | 工作日白天=0.1, 工作日晚间=0.3, 周末=0.5, 节假日=0.8 |
| 回滚复杂度 | 15% | 低=0.1, 中=0.4, 高=0.7, 复杂=0.9 |
| AI 变更智能 | 15% | 关联 `change_intelligence_reports.risk_score` |

**综合风险分计算**：
```
overall_score = sum(factor_score * weight) / sum(weight)
```

**风险等级映射**：
- `0.00 - 0.25` → low（低风险，绿色）
- `0.25 - 0.50` → medium（中风险，黄色）
- `0.50 - 0.75` → high（高风险，橙色）
- `0.75 - 1.00` → critical（极高风险，红色）

**与变更智能集成**：
- 自动关联 `change_intelligence_reports`
- 复用 AI Review 的分析结果
- 合并 SHAP 因子到评估报告

### 1.5 外部依赖

| 依赖 | 用途 | 已有/需新建 | 回退策略 |
|------|------|-------------|----------|
| Pipeline Engine | 执行各应用的 CI/CD | 已有 `PipelineEngine` | 降级为记录状态 |
| 工作流引擎 | 审批流 | 已有 `WorkflowService` | 降级为简单审批记录 |
| AI 变更智能 | 风险评估因子 | 已有 `change_intelligence` | 该项评分为 0.5 中性 |
| CMDB | 服务依赖关系 | 已有 CMDB 服务 | 仅使用显式依赖 |
| SSE Bridge | 实时进度推送 | 已有 | 降级为轮询 |
| NATS EventBus | 发布事件 | 已有 | 降级为日志 |

### 1.6 权限模型

| 角色 | 查看计划 | 创建计划 | 编辑计划 | 审批 | 执行 | 回滚 | 管理窗口 |
|------|----------|----------|----------|------|------|------|----------|
| Admin | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| PlatformAdmin | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ReleaseManager | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Developer | ✅ (自己的) | ✅ | ✅ (draft) | ❌ | ❌ | ❌ | ❌ |
| QAViewer | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

**API 权限映射**：

| 路由 | 权限要求 |
|------|----------|
| GET `/release-orchestration/plans` | `release:read` |
| POST `/release-orchestration/plans` | `release:create` |
| PUT `/release-orchestration/plans/:id` | `release:update` |
| DELETE `/release-orchestration/plans/:id` | `release:admin` |
| POST `/release-orchestration/plans/:id/submit` | `release:execute` |
| POST `/release-orchestration/plans/:id/approve` | `release:approve` |
| POST `/release-orchestration/plans/:id/reject` | `release:approve` |
| POST `/release-orchestration/plans/:id/execute` | `release:execute` |
| POST `/release-orchestration/plans/:id/rollback` | `release:rollback` |
| GET `/release-orchestration/windows` | `release:read` |
| POST `/release-orchestration/windows` | `release:admin` |
| GET `/release-orchestration/risks/:plan_id` | `release:read` |
| GET `/release-orchestration/runs` | `release:read` |
| GET `/release-orchestration/runs/:id/logs` | SSE 日志流 `release:read` |

### 1.7 定时任务

| 任务 | Cron | 功能 | 超时 |
|------|------|------|------|
| WindowScheduler | `0 * * * *` | 每小时检查是否有待执行的发布计划 | 120s |
| RiskReassess | `0 6 * * 1` | 每周一重新评估待审批计划的风险 | 300s |
| StalePlanCleaner | `0 3 * * 0` | 清理草稿状态 > 30 天的计划 | 60s |
| RetrospectiveGen | `0 5 * * *` | 为已完成的发布生成复盘报告 | 300s |

---

## 2. 页面交互设计（前端）

### 2.1 页面清单与路由

| 页面 | 路由 | 优先级 | 对应后端 API |
|------|------|--------|-------------|
| 编排列表 | `/delivery/release-orchestration` | P0 | GET `/plans` |
| 编排详情 | `/delivery/release-orchestration/:id` | P0 | GET `/plans/:id` |
| 创建/编辑编排 | `/delivery/release-orchestration/new` | P0 | POST/PUT `/plans` |
| 发布窗口管理 | `/delivery/release-windows` | P1 | GET/POST/PUT/DELETE `/windows` |
| 风险面板 | `/delivery/release-orchestration/risk-dashboard` | P1 | GET `/risks` |
| 发布复盘 | `/delivery/release-retrospectives` | P2 | GET `/retrospectives` |

### 2.2 页面 1：编排列表（/delivery/release-orchestration）

**页面标题**：

```tsx
<Title level={2} style={{ marginBottom: spacing.sm }}>
  <CloudUploadOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
  发布编排
</Title>
<Typography.Text style={{ color: colors.neutral[500], fontSize: 14 }}>
  多应用联合发布编排、依赖管理与发布风险控制
</Typography.Text>
```

**布局结构**：统计摘要 + 过滤栏 + 编排列表

**统计摘要（4 个卡片）**：

| 卡片 | 数据 |
|------|------|
| 进行中发布 | `GET /plans?status=executing,scheduled` 计数 |
| 待审批 | `GET /plans?status=pending_approval` 计数 |
| 本周成功率 | 近 7 天 completed / (completed + failed) |
| 高风险待处理 | `GET /plans?risk_level=high,critical&status=draft,pending_approval` |

**过滤栏**：
```tsx
<Space style={{ marginBottom: spacing.md }}>
  <Input placeholder="搜索发布计划" prefix={<SearchOutlined />} value={keyword} onChange={setKeyword} style={{ width: 240 }} allowClear />
  <Select placeholder="状态" value={status} onChange={setStatus} style={{ width: 140 }} allowClear
    options={[
      { label: '草稿', value: 'draft' },
      { label: '待审批', value: 'pending_approval' },
      { label: '已审批', value: 'approved' },
      { label: '执行中', value: 'executing' },
      { label: '已完成', value: 'completed' },
      { label: '已失败', value: 'failed' },
      { label: '已回滚', value: 'rolled_back' },
    ]}
  />
  <Select placeholder="类型" value={type} onChange={setType} style={{ width: 140 }} allowClear
    options={[
      { label: '标准', value: 'standard' },
      { label: '热修复', value: 'hotfix' },
      { label: '大版本', value: 'major' },
      { label: '小版本', value: 'minor' },
    ]}
  />
  <Select placeholder="风险等级" value={risk} onChange={setRisk} style={{ width: 140 }} allowClear
    options={[
      { label: '低', value: 'low' },
      { label: '中', value: 'medium' },
      { label: '高', value: 'high' },
      { label: '严重', value: 'critical' },
    ]}
  />
  <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/delivery/release-orchestration/new')}>
    创建发布计划
  </Button>
</Space>
```

**表格列定义**：

| 列 | 宽度 | 内容 |
|----|------|------|
| 名称 + 版本 | 240px | 可点击查看详情 |
| 类型 | 80px | 彩色 Tag |
| 应用数 | 60px | `N 个应用` |
| 风险等级 | 100px | 彩色 Tag + 分数 |
| 状态 | 100px | 彩色状态点 |
| 发布窗口 | 160px | 时间范围 |
| 创建人 | 100px | 用户名 |
| 创建时间 | 160px | 可排序 |
| 操作 | 160px | 查看 / 编辑 / 提交 / 审批 / 执行 |

**操作按钮动态显示**：
- draft → 编辑、提交、删除
- pending_approval → 审批（如有权限）、查看
- approved → 执行
- executing → 查看（进入执行详情页）
- completed → 查看复盘
- failed → 查看、重试
- rolled_back → 查看

### 2.3 页面 2：创建/编辑编排（/delivery/release-orchestration/new）

**布局结构**：表单分步骤（Steps 组件）

**Step 1 — 基本信息**：
- 发布名称（Input，必填）
- 版本号（Input，必填，支持语义化版本校验）
- 发布类型（Select，必填）
- 描述（TextArea）
- 关联发布窗口（Select，可选）
- 下一步按钮

**Step 2 — 添加应用**：
- 应用列表 Table（可添加/删除行）
- 每行字段：应用名称（Select）、当前版本（只读/输入）、目标版本（Input）、部署策略（Select）、执行顺序（InputNumber）
- "添加应用"按钮
- 应用间依赖设置（点击行 → Drawer 设置 depends_on）
- 上一步、下一步按钮

**Step 3 — 依赖可视化**：
- DAG 图展示应用依赖关系
- 自动检测循环依赖（红色高亮）
- 推荐执行顺序展示
- 冲突检测结果展示
- 上一步、下一步按钮

**Step 4 — 风险评估**：
- 自动计算的风险评分（提交后触发）
- 各因子评分明细
- 受影响服务列表
- 预估回滚时间和复杂度
- AI 变更智能摘要（如有）
- 确认提交 / 上一步按钮

**交互要点**：
- 每步完成后方可进入下一步
- 保存草稿按钮随时可点击
- 提交时触发风险评估 API
- 高风险时显示 Warning 提示 + 确认

### 2.4 页面 3：编排详情（/delivery/release-orchestration/:id）

**布局结构**：基本信息卡片 + 应用列表 + 依赖图 + 审批记录 + 执行历史

**基本信息卡片**：
- 名称、版本、类型、状态、风险等级
- 发布窗口信息
- 操作按钮（根据状态动态显示）

**应用列表（Table）**：
| 列 | 内容 |
|----|------|
| 顺序 | 执行序号 |
| 应用名称 | 可跳转到应用详情 |
| 当前版本 → 目标版本 | 版本对比 |
| 部署策略 | canary/blue-green/rolling Tag |
| 状态 | 彩色状态 |
| 依赖 | 依赖哪些应用 |
| 验证状态 | verified/failed/skipped |
| 操作 | 查看日志、手动跳过 |

**依赖图（ECharts Graph）**：
- 节点 = 应用
- 有向边 = 依赖关系
- 颜色 = 执行状态
- 布局 = 按执行顺序分层

**审批记录（Timeline）**：
- 每个审批人一个节点
- 显示审批人、角色、动作、评论、时间

**执行历史**：
- 历次发布执行的记录
- 列：执行时间、持续时间、成功/失败/回滚、备注

**实时执行面板**（当状态为 executing 时）：
- 当前执行步骤高亮
- SSE 实时日志流
- 暂停/继续/终止按钮

### 2.5 页面 4：发布窗口管理（/delivery/release-windows）

**列表页**：
- Table 列：名称、环境、可发布日期、时间范围、最大并发、自动审批阈值、状态、操作
- 创建按钮 → Modal 表单
- 操作：编辑、启用/禁用、删除

**创建/编辑表单**：
- 窗口名称（Input，必填）
- 环境（Select，必填）
- 可发布日（Checkbox 组：周一~周日）
- 时间范围（TimePicker 起始 + 结束）
- 最大并发数（InputNumber）
- 禁止发布日期（DatePicker 多选）
- 自动审批风险阈值（Slider 0.0-1.0）
- 保存按钮

### 2.6 页面 5：风险面板（/delivery/release-orchestration/risk-dashboard）

**布局结构**：风险分布 + 高风险列表 + 趋势图

**风险分布饼图**：
- 按风险等级（low/medium/high/critical）统计

**高风险列表（Table）**：
| 列 | 内容 |
|----|------|
| 发布计划 | 名称 + 版本 |
| 风险分 | 进度条 + 数值 |
| 主要风险因子 | Top 3 因子 |
| 受影响服务数 | 数字 |
| 预估回滚时间 | X 分钟 |
| 状态 | 草稿/待审批 |
| 操作 | 查看详情 |

**风险趋势折线图**：
- 近 30 天发布平均风险分趋势
- 目标线（可接受的最大风险分）

---

## 3. API 设计

### 3.1 发布计划管理

| Method | Path | 描述 | 权限 |
|--------|------|------|------|
| GET | `/api/v1/release-orchestration/plans` | 计划列表 | `release:read` |
| GET | `/api/v1/release-orchestration/plans/:id` | 计划详情（含应用项） | `release:read` |
| POST | `/api/v1/release-orchestration/plans` | 创建计划 | `release:create` |
| PUT | `/api/v1/release-orchestration/plans/:id` | 更新计划 | `release:update` |
| DELETE | `/api/v1/release-orchestration/plans/:id` | 删除计划 | `release:admin` |
| POST | `/api/v1/release-orchestration/plans/:id/submit` | 提交审批 | `release:execute` |
| GET | `/api/v1/release-orchestration/plans/:id/items` | 应用项列表 | `release:read` |
| POST | `/api/v1/release-orchestration/plans/:id/items` | 添加应用项 | `release:update` |
| PUT | `/api/v1/release-orchestration/plans/:id/items/:itemId` | 更新应用项 | `release:update` |
| DELETE | `/api/v1/release-orchestration/plans/:id/items/:itemId` | 删除应用项 | `release:update` |

### 3.2 审批流

| Method | Path | 描述 | 权限 |
|--------|------|------|------|
| POST | `/api/v1/release-orchestration/plans/:id/approve` | 审批通过 | `release:approve` |
| POST | `/api/v1/release-orchestration/plans/:id/reject` | 审批拒绝 | `release:approve` |
| GET | `/api/v1/release-orchestration/plans/:id/approvals` | 审批记录 | `release:read` |

### 3.3 执行与回滚

| Method | Path | 描述 | 权限 |
|--------|------|------|------|
| POST | `/api/v1/release-orchestration/plans/:id/execute` | 执行发布 | `release:execute` |
| POST | `/api/v1/release-orchestration/plans/:id/rollback` | 回滚发布 | `release:rollback` |
| POST | `/api/v1/release-orchestration/plans/:id/pause` | 暂停执行 | `release:execute` |
| POST | `/api/v1/release-orchestration/plans/:id/resume` | 恢复执行 | `release:execute` |
| GET | `/api/v1/release-orchestration/runs` | 执行记录列表 | `release:read` |
| GET | `/api/v1/release-orchestration/runs/:id` | 执行详情 | `release:read` |
| GET | `/api/v1/release-orchestration/runs/:id/logs` | SSE 日志流 | `release:read` |

### 3.4 风险评估

| Method | Path | 描述 | 权限 |
|--------|------|------|------|
| GET | `/api/v1/release-orchestration/risks/:plan_id` | 风险评估详情 | `release:read` |
| POST | `/api/v1/release-orchestration/risks/:plan_id/assess` | 手动触发评估 | `release:execute` |
| GET | `/api/v1/release-orchestration/risks/dashboard` | 风险面板聚合数据 | `release:read` |
| GET | `/api/v1/release-orchestration/risks/trend` | 风险趋势（时序数据） | `release:read` |

### 3.5 发布窗口

| Method | Path | 描述 | 权限 |
|--------|------|------|------|
| GET | `/api/v1/release-orchestration/windows` | 窗口列表 | `release:read` |
| POST | `/api/v1/release-orchestration/windows` | 创建窗口 | `release:admin` |
| PUT | `/api/v1/release-orchestration/windows/:id` | 更新窗口 | `release:admin` |
| DELETE | `/api/v1/release-orchestration/windows/:id` | 删除窗口 | `release:admin` |
| GET | `/api/v1/release-orchestration/windows/:id/availability` | 检查时间可用性 | `release:read` |

### 3.6 发布复盘

| Method | Path | 描述 | 权限 |
|--------|------|------|------|
| GET | `/api/v1/release-orchestration/retrospectives` | 复盘列表 | `release:read` |
| GET | `/api/v1/release-orchestration/retrospectives/:plan_id` | 复盘详情 | `release:read` |
| POST | `/api/v1/release-orchestration/retrospectives` | 创建复盘 | `release:create` |
| PUT | `/api/v1/release-orchestration/retrospectives/:id` | 更新复盘 | `release:update` |

---

## 4. 验收标准

### 4.1 功能验收

| # | 验收项 | 验收方法 | 预期结果 |
|---|--------|----------|----------|
| 1 | 创建发布计划 | 通过 API 创建含 2 个应用的计划 | 存储到 `release_plans` + 2 条 `release_plan_items` |
| 2 | 依赖分析 | 设置 A→B 依赖 | DAG 图正确显示，推荐执行顺序为 B→A |
| 3 | 循环依赖检测 | 设置 A→B→A | 返回错误，标记冲突 |
| 4 | 风险评估 | 提交计划后查看评估 | 各因子评分 + 综合风险分计算正确 |
| 5 | 审批流 | 提交审批 → 审批通过 | 状态变为 approved，审批记录写入 |
| 6 | 审批自动通过 | 创建风险分 < auto_approve_below 的计划 | 自动跳过审批，状态变 approved |
| 7 | 发布执行 | 执行已审批计划 | 按依赖顺序触发 Pipeline，状态更新 |
| 8 | 执行暂停/恢复 | 执行中暂停 | 当前步骤完成后暂停，恢复后继续 |
| 9 | 回滚 | 执行失败后触发回滚 | 按 rollback_version 回滚应用 |
| 10 | 发布窗口调度 | 设置窗口 + 计划到期 | WindowScheduler 自动触发执行 |
| 11 | 复盘生成 | 发布完成后 | 自动生成复盘报告，含指标和耗时 |

### 4.2 前端交互验收

| # | 验收项 | 验收方法 | 预期结果 |
|---|--------|----------|----------|
| 1 | 页面标题规范 | 检查所有页面 | `level={2}` + 图标 + Design Token |
| 2 | 创建向导步骤 | 创建新计划 | Steps 组件引导，每步校验通过才可下一步 |
| 3 | 依赖图可视化 | 添加多应用后查看 | DAG 图正确渲染，节点可拖拽 |
| 4 | 空状态引导 | 无数据时 | Empty + 创建按钮 |
| 5 | 异步操作反馈 | 提交/审批/执行操作 | loading + success/error message |
| 6 | 实时日志 | 执行中查看 | SSE 连接，日志实时追加 |
| 7 | 高风险警告 | 风险分 > 0.7 | 显示 Warning 提示 + 确认 |
| 8 | Design Token 使用 | 搜索硬编码色值 | 无硬编码 |
| 9 | CRUD 完整性 | 发布窗口页面 | 创建/查看/编辑/删除齐全 |

### 4.3 后端验收

| # | 验收项 | 验收方法 | 预期结果 |
|---|--------|----------|----------|
| 1 | TypeScript 编译 | `npm run build` | 零 error |
| 2 | ESLint | `npm run lint` | 零 error |
| 3 | 单元测试 | `npm run test` | 覆盖率 >= 80% |
| 4 | RLS 策略 | 切换 tenant_id | 仅返回当前租户数据 |
| 5 | 错误码规范 | 触发错误 | `CLIENT.4xx.*` 或 `BIZ.*` 格式 |
| 6 | 权限校验 | 无权限调用 | 403 + `CLIENT.403.FORBIDDEN` |
| 7 | 迁移文件 | 执行 198 迁移 | 8 张表 + RLS + 触发器创建成功 |
| 8 | DAG 调度 | 输入复杂依赖图 | 正确拓扑排序，无循环依赖 |
| 9 | Pipeline 集成 | 执行含真实 Pipeline 的计划 | Pipeline 被正确触发，状态回写 |
