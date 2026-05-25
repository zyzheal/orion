# 发布编排（Release Orchestration）能力增强设计

> **日期**: 2026-05-22
> **状态**: 设计中
> **模块优先级**: P2
> **基于模块**: Pipeline + 部署系统
> **目标成熟度**: 7/10 → 8.5/10

---

## 一、业务概述与现状评估

### 1.1 背景

Orion Pipeline 引擎和部署系统功能完整，支持单应用的 CI/CD 流程。
但缺少**多应用联合发布**能力：当多个服务存在依赖关系时，需要协调发布顺序、管理发布窗口、监控联合发布风险。

### 1.2 现状评估

| 维度 | 现状 | 文件 |
|------|------|------|
| Pipeline 引擎 | ✅ 完整（DAG 执行） | `PipelineEngine.ts` |
| 部署策略 | ✅ 完整（蓝绿/金丝雀） | `DeploymentStrategyEngine.ts` |
| 跨域编排 | ⚠️ 部分 | `CrossDomainOrchestrator.ts` |
| 依赖追踪 | ⚠️ 部分 | `DependencyTracker.ts` |
| 联合发布 | ❌ 缺失 | 无发布编排概念 |
| 发布窗口 | ❌ 缺失 | 无时间窗口管理 |
| 风险面板 | ❌ 缺失 | 无联合风险聚合 |

### 1.3 增强目标

| 功能模块 | 描述 | 验收等级 |
|----------|------|:--------:|
| 编排列表 | 发布编排任务列表，状态跟踪 | 8.5 |
| 编排详情 | 多应用依赖图、执行时间线、阶段状态 | 8.5 |
| 联合发布 | 多应用按依赖顺序自动编排发布 | 8.5 |
| 风险面板 | 联合发布风险聚合、阻断/告警 | 8.5 |

---

## 二、功能设计（后端）

### 2.1 发布编排核心概念

```
ReleaseOrchestration (1)
  ├── ReleaseWindow (时间窗口)
  ├── ReleasePlan (N)  -- 应用发布计划
  │     ├── app: string
  │     ├── pipelineId: string
  │     ├── version: string
  │     ├── dependsOn: string[]     -- 依赖的应用
  │     └── status
  └── RiskAssessment (N) -- 风险评估
```

### 2.2 发布编排状态机

```
draft → planning → approved → executing → completed
   ↓         ↓                      ↓
cancelled  rejected              rollback
```

### 2.3 依赖解析与执行顺序

基于 DAG 拓扑排序：
1. 解析所有应用间的依赖关系
2. 生成执行顺序（拓扑排序）
3. 并行执行无依赖关系的应用
4. 每阶段完成后验证健康状态
5. 失败自动暂停，等待人工确认

---

## 三、数据模型设计

### 3.1 新增数据库表

```sql
-- 发布编排主表
CREATE TABLE release_orchestrations (
  id              VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       VARCHAR(36) NOT NULL,
  orchestration_number VARCHAR(20) NOT NULL,  -- REL-00001
  name            VARCHAR(200) NOT NULL,
  description     TEXT,
  status          VARCHAR(20) NOT NULL DEFAULT 'draft',
  window_start    TIMESTAMP NOT NULL,
  window_end      TIMESTAMP NOT NULL,
  created_by      VARCHAR(100) NOT NULL,
  approved_by     VARCHAR(100),
  approved_at     TIMESTAMP,
  started_at      TIMESTAMP,
  completed_at    TIMESTAMP,
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);

-- 应用发布计划
CREATE TABLE release_plans (
  id              VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  orchestration_id VARCHAR(36) NOT NULL,
  app_name        VARCHAR(100) NOT NULL,
  pipeline_id     VARCHAR(36),
  version         VARCHAR(50) NOT NULL,
  depends_on      JSONB DEFAULT '[]',          -- 依赖的应用 ID 列表
  execution_order INT NOT NULL,                -- 执行顺序（拓扑排序结果）
  status          VARCHAR(20) NOT NULL DEFAULT 'pending',
  pipeline_run_id VARCHAR(36),                  -- 实际执行的 Pipeline Run ID
  started_at      TIMESTAMP,
  completed_at    TIMESTAMP,
  rollback_version VARCHAR(50),                -- 回滚版本
  health_check_passed BOOLEAN,
  created_at      TIMESTAMP DEFAULT NOW()
);

-- 发布窗口
CREATE TABLE release_windows (
  id              VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       VARCHAR(36) NOT NULL,
  name            VARCHAR(100) NOT NULL,
  description     TEXT,
  start_time      TIME NOT NULL,
  end_time        TIME NOT NULL,
  days_of_week    JSONB NOT NULL,              -- [1,2,3,4,5]
  is_frozen       BOOLEAN DEFAULT false,       -- 是否冻结期
  created_by      VARCHAR(100) NOT NULL,
  created_at      TIMESTAMP DEFAULT NOW()
);

-- 联合风险评估
CREATE TABLE release_risk_assessments (
  id              VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  orchestration_id VARCHAR(36) NOT NULL,
  app_name        VARCHAR(100),
  risk_level      VARCHAR(10) NOT NULL,         -- low/medium/high/critical
  risk_score      DECIMAL(5,2),
  risk_factors    JSONB DEFAULT '[]',
  recommendation  TEXT,
  created_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_orchestrations_tenant ON release_orchestrations(tenant_id);
CREATE INDEX idx_orchestrations_status ON release_orchestrations(status);
CREATE INDEX idx_plans_orchestration ON release_plans(orchestration_id);
CREATE INDEX idx_windows_tenant ON release_windows(tenant_id);
CREATE INDEX idx_risks_orchestration ON release_risk_assessments(orchestration_id);
```

### 3.2 TypeScript 接口

```typescript
interface ReleaseOrchestration {
  id: string;
  tenantId: string;
  orchestrationNumber: string;  // REL-00001
  name: string;
  description: string;
  status: ReleaseOrchestrationStatus;
  windowStart: Date;
  windowEnd: Date;
  createdBy: string;
  approvedBy?: string;
  approvedAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  plans?: ReleasePlan[];
  riskAssessments?: ReleaseRiskAssessment[];
  progress?: { total: number; completed: number; failed: number };
  createdAt: Date;
  updatedAt: Date;
}

type ReleaseOrchestrationStatus =
  | 'draft' | 'planning' | 'approved' | 'executing' | 'completed' | 'cancelled' | 'rollback';

interface ReleasePlan {
  id: string;
  orchestrationId: string;
  appName: string;
  pipelineId?: string;
  version: string;
  dependsOn: string[];
  executionOrder: number;
  status: 'pending' | 'waiting' | 'running' | 'completed' | 'failed' | 'skipped';
  pipelineRunId?: string;
  startedAt?: Date;
  completedAt?: Date;
  rollbackVersion?: string;
  healthCheckPassed?: boolean;
}

interface ReleaseRiskAssessment {
  id: string;
  orchestrationId: string;
  appName?: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  riskScore: number;
  riskFactors: { factor: string; severity: string; description: string }[];
  recommendation: string;
}

interface ReleaseWindow {
  id: string;
  name: string;
  description: string;
  startTime: string;
  endTime: string;
  daysOfWeek: number[];
  isFrozen: boolean;
  createdBy: string;
  createdAt: Date;
}
```

---

## 四、API 路由设计

### 4.1 端点清单

| 方法 | 路径 | 描述 | 权限 | 请求体 | 响应 |
|------|------|------|------|--------|------|
| **发布编排** |
| POST | `/release-orchestrations` | 创建编排 | `release:write` | `ReleaseOrchestrationCreate` | `{ data: ReleaseOrchestration }` |
| GET | `/release-orchestrations` | 编排列表 | `release:read` | query | `{ data: [], total }` |
| GET | `/release-orchestrations/:id` | 编排详情 | `release:read` | - | `{ data: ReleaseOrchestration }` |
| PATCH | `/release-orchestrations/:id` | 更新编排 | `release:write` | `ReleaseOrchestrationUpdate` | `{ data: ReleaseOrchestration }` |
| POST | `/release-orchestrations/:id/submit` | 提交审批 | `release:write` | - | `{ data: { status } }` |
| POST | `/release-orchestrations/:id/approve` | 审批通过 | `release:admin` | `{ comment? }` | `{ data: { status } }` |
| POST | `/release-orchestrations/:id/reject` | 审批拒绝 | `release:admin` | `{ comment }` | `{ data: { status } }` |
| POST | `/release-orchestrations/:id/execute` | 开始执行 | `release:execute` | - | `{ data: { status } }` |
| POST | `/release-orchestrations/:id/pause` | 暂停执行 | `release:execute` | - | `{ data: { status } }` |
| POST | `/release-orchestrations/:id/resume` | 恢复执行 | `release:execute` | - | `{ data: { status } }` |
| POST | `/release-orchestrations/:id/rollback` | 回滚 | `release:admin` | `{ apps?: string[] }` | `{ data: { status } }` |
| **发布计划** |
| POST | `/release-orchestrations/:id/plans` | 添加应用计划 | `release:write` | `ReleasePlanCreate` | `{ data: ReleasePlan }` |
| GET | `/release-orchestrations/:id/plans` | 计划列表 | `release:read` | - | `{ data: ReleasePlan[] }` |
| PUT | `/release-orchestrations/:id/plans/:planId` | 更新计划 | `release:write` | `ReleasePlanUpdate` | `{ data: ReleasePlan }` |
| DELETE | `/release-orchestrations/:id/plans/:planId` | 删除计划 | `release:write` | - | `{ success: true }` |
| POST | `/release-orchestrations/:id/plans/:planId/retry` | 重试失败计划 | `release:execute` | - | `{ data: { status } }` |
| **发布窗口** |
| POST | `/release-windows` | 创建发布窗口 | `release:admin` | `ReleaseWindowCreate` | `{ data: ReleaseWindow }` |
| GET | `/release-windows` | 窗口列表 | `release:read` | query | `{ data: ReleaseWindow[], total }` |
| PUT | `/release-windows/:id` | 更新窗口 | `release:admin` | `ReleaseWindowUpdate` | `{ data: ReleaseWindow }` |
| DELETE | `/release-windows/:id` | 删除窗口 | `release:admin` | - | `{ success: true }` |
| **风险评估** |
| GET | `/release-orchestrations/:id/risks` | 风险列表 | `release:read` | - | `{ data: ReleaseRiskAssessment[], overallRisk }` |
| POST | `/release-orchestrations/:id/risks/assess` | 执行风险评估 | `release:write` | - | `{ data: ReleaseRiskAssessment[] }` |

---

## 五、页面交互设计（前端）

### 5.1 页面清单

| 页面 | 路径 | 菜单归属 | 核心功能 |
|------|------|----------|----------|
| 编排列表 | `/delivery/release-orchestrations` | 交付 | 列表/搜索/过滤/创建 |
| 编排详情 | `/delivery/release-orchestrations/:id` | 交付 | 依赖图/时间线/计划管理 |
| 联合发布 | `/delivery/release-orchestrations/:id/execute` | 交付 | 执行监控/阶段控制 |
| 风险面板 | `/delivery/release-orchestrations/:id/risks` | 交付 | 风险聚合/阻断/告警 |

### 5.2 编排列表页

**文件**: `orion-frontend/src/pages/ReleaseOrchestration/index.tsx`

```tsx
// 列表页核心交互
const statusColorMap: Record<string, string> = {
  draft: colors.neutral[500],
  planning: colors.info[500],
  approved: colors.primary[500],
  executing: colors.warning[500],
  completed: colors.success[500],
  cancelled: colors.neutral[400],
  rollback: colors.error[500],
};

// 进度展示
const renderProgress = (r: ReleaseOrchestration) => {
  if (!r.progress) return '-';
  const percent = Math.round((r.progress.completed / r.progress.total) * 100);
  return (
    <Progress
      percent={percent}
      size="small"
      status={r.progress.failed > 0 ? 'exception' : 'normal'}
      strokeColor={percent === 100 ? colors.success[500] : colors.primary[500]}
    />
  );
};
```

### 5.3 编排详情页

**文件**: `orion-frontend/src/pages/ReleaseOrchestration/Detail.tsx`

```tsx
// 依赖关系图（简化版，使用 Ant Design 列表 + Tag）
// 按执行顺序分组展示
const groupedByOrder = useMemo(() => {
  const groups: Record<number, ReleasePlan[]> = {};
  plans.forEach(p => {
    groups[p.executionOrder] = groups[p.executionOrder] || [];
    groups[p.executionOrder].push(p);
  });
  return Object.entries(groups).sort(([a], [b]) => Number(a) - Number(b));
}, [plans]);

// 分组渲染
{groupedByOrder.map(([order, groupPlans]) => (
  <Card key={order} title={`第 ${order} 批次（可并行）`} size="small" style={{ marginBottom: spacing.sm }}>
    <Table dataSource={groupPlans} rowKey="id" size="small" pagination={false}>
      <Column title="应用" dataIndex="appName" />
      <Column title="版本" dataIndex="version" />
      <Column title="依赖" dataIndex="dependsOn"
        render={(v: string[]) => v.length ? v.join(', ') : '无'} />
      <Column title="状态" dataIndex="status"
        render={(v: string) => <Tag color={planStatusColorMap[v]}>{v}</Tag>} />
      <Column title="操作" render={(_: any, r: ReleasePlan) => (
        <Button type="link" size="small"
          onClick={() => navigate(`/delivery/pipelines/runs/${r.pipelineRunId}`)}>
          查看运行
        </Button>
      )} />
    </Table>
  </Card>
))}
```

### 5.4 风险面板

**文件**: `orion-frontend/src/pages/ReleaseOrchestration/RiskPanel.tsx`

```tsx
// 风险聚合卡片
<Row gutter={spacing.md}>
  <Col span={6}>
    <Statistic title="总体风险等级" value={overallRisk}
      valueStyle={{ color: riskColorMap[overallRisk] }} />
  </Col>
  <Col span={6}>
    <Statistic title="高风险应用" value={risks.filter(r => r.riskLevel === 'high').length} />
  </Col>
  <Col span={6}>
    <Statistic title="关键风险" value={risks.filter(r => r.riskLevel === 'critical').length}
      valueStyle={{ color: colors.error[500] }} />
  </Col>
  <Col span={6}>
    <Statistic title="建议" value={risks.length ? '需要关注' : '无风险'} />
  </Col>
</Row>

// 高风险阻断发布
const hasCriticalRisk = risks.some(r => r.riskLevel === 'critical');
<Button type="primary" danger={hasCriticalRisk} disabled={hasCriticalRisk}
  onClick={handleExecute}>
  {hasCriticalRisk ? '存在关键风险，无法执行' : '开始执行'}
</Button>
```

---

## 六、权限模型

| 角色 | 查看编排 | 创建编排 | 执行编排 | 审批 | 管理窗口 |
|------|:--------:|:--------:|:--------:|:----:|:--------:|
| Viewer | ✅ | - | - | - | - |
| Member | ✅ | ✅ | - | - | - |
| Admin | ✅ | ✅ | ✅ | ✅ | ✅ |
| Platform Admin | ✅ | ✅ | ✅ | ✅ | ✅ |

权限: `requirePermission({ resource: 'release', action: 'read' | 'write' | 'execute' | 'admin' })`

---

## 七、外部依赖检查

| 依赖 | 用途 | 状态 |
|------|------|------|
| Pipeline 引擎 | 执行各应用发布 Pipeline | ✅ 已有 |
| 部署系统 | 实际部署操作 | ✅ 已有 |
| 审批流引擎 | 发布审批 | ✅ 已有 |
| 依赖追踪器 | 依赖关系解析 | ✅ 已有 `DependencyTracker.ts` |
| AI Review | 代码变更风险评估 | ✅ 已有 |

---

## 八、Design Token 使用

| 用途 | Token |
|------|-------|
| 执行中状态 | `colors.warning[500]` |
| 已完成状态 | `colors.success[500]` |
| 关键风险 | `colors.error[500]` |
| 高风险 | `colors.warning[500]` |
| 低风险 | `colors.success[500]` |
| 进度条颜色 | `colors.primary[500]` |
| 卡片圆角 | `componentRadius.card` (12px) |
| 卡片间距 | `spacing.md` (16px) |

---

## 九、验收标准

### 9.1 端到端场景

| # | 场景 | 预期结果 |
|---|------|----------|
| E1 | 创建包含 3 个应用的编排 | 依赖关系正确解析，执行顺序生成 |
| E2 | 提交审批并审批通过 | 状态流转正确，审批人收到通知 |
| E3 | 执行联合发布 | 按依赖顺序执行，无依赖应用并行 |
| E4 | 执行中暂停/恢复 | 暂停后停止新阶段，恢复后继续 |
| E5 | 某应用发布失败 | 自动暂停，提示人工确认 |
| E6 | 执行回滚 | 指定应用回滚到上一版本 |
| E7 | 高风险阻断发布 | critical 风险存在时禁止执行 |
| E8 | 发布窗口冲突 | 冻结期内禁止创建新的编排 |

### 9.2 量化指标

| 指标 | 目标值 |
|------|--------|
| 编排列表加载时间 | < 1s (p95) |
| 依赖解析时间 | < 2s (50 应用内) |
| 风险评估时间 | < 3s |
| 执行阶段切换延迟 | < 1s |
| 前端单元测试覆盖率 | > 75% |

---

_文档版本: v1.0 | 创建日期: 2026-05-22_
