# 混沌工程（Chaos Engineering）前端对接设计

> **日期**: 2026-05-22
> **状态**: 设计中
> **模块优先级**: P0
> **基于模块**: 混沌工程后端（`services/chaos-engineering/`）
> **目标成熟度**: 6.5/10 → 8.5/10

---

## 一、业务概述与现状评估

### 1.1 背景

混沌工程后端已完整实现（`ChaosExperimentService`、`ChaosExecutor`、`ResilienceScoringService` 等 8 个服务文件），
API 路由 10 个端点已注册（`chaos-enhanced-routes.ts` 167 行），但**前端完全缺失**，用户无法通过 UI 操作。

### 1.2 现状评估

| 维度 | 现状 | 文件 |
|------|------|------|
| 实验管理 | ✅ 后端完整（CRUD + 状态机） | `ChaosExperimentService.ts` |
| 故障注入 | ✅ 后端完整（simulated） | `ChaosExecutor.ts` |
| 弹性评分 | ✅ 后端完整 | `ResilienceScoringService.ts` |
| 故障库 | ✅ 后端完整 | `FaultInjector` |
| API 路由 | ✅ 10 个端点 | `chaos-enhanced-routes.ts` |
| **前端页面** | ❌ 全部缺失 | - |
| **前端 API Client** | ❌ 缺失 | - |

### 1.3 增强目标

| 功能模块 | 描述 | 验收等级 |
|----------|------|:--------:|
| 实验列表页 | 实验搜索/过滤/状态展示/批量操作 | 8.5 |
| 实验创建页 | 选择模板/配置故障/设置范围/审批流 | 8.5 |
| 实验执行页 | 实时状态监控/故障注入/暂停/恢复 | 8.5 |
| 实验报告页 | 弹性评分/影响分析/改进建议 | 8.5 |
| 实验模板页 | 模板库/一键创建/自定义模板 | 8.5 |

---

## 二、功能设计（后端增强）

### 2.1 后端已有的功能

- 实验 CRUD（创建/列表/详情/删除）
- 实验执行（start/stop/status/recovery）
- 故障注入（inject + 模板）
- 弹性评分

### 2.2 需要新增的后端端点

| 方法 | 路径 | 描述 | 说明 |
|------|------|------|------|
| GET | `/chaos-templates` | 获取实验模板列表 | 前端模板页需要 |
| POST | `/chaos-templates` | 创建实验模板 | 前端模板页需要 |
| GET | `/chaos-templates/:id` | 获取模板详情 | 前端模板详情需要 |
| PUT | `/chaos-templates/:id` | 更新实验模板 | 前端模板编辑需要 |
| DELETE | `/chaos-templates/:id` | 删除实验模板 | 前端模板删除需要 |
| POST | `/chaos-experiments/:id/pause` | 暂停实验 | 前端执行页需要 |
| POST | `/chaos-experiments/:id/resume` | 恢复实验 | 前端执行页需要 |
| GET | `/chaos-experiments/:id/report` | 获取实验报告 | 前端报告页需要 |
| GET | `/chaos-experiments/:id/metrics` | 获取实验指标 | 前端实时图表需要 |
| GET | `/chaos-resilience-scores` | 获取弹性评分列表 | 前端评分面板需要 |

---

## 三、数据模型设计

### 3.1 新增数据库表

```sql
-- 实验模板表
CREATE TABLE chaos_templates (
  id              VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       VARCHAR(36) NOT NULL,
  name            VARCHAR(100) NOT NULL,
  description     TEXT,
  fault_type      VARCHAR(50) NOT NULL,
  fault_config    JSONB NOT NULL,
  scope_config    JSONB NOT NULL,           -- 影响范围配置
  duration_seconds INT NOT NULL,
  category        VARCHAR(30) NOT NULL,     -- cpu/memory/network/disk/service
  tags            JSONB DEFAULT '[]',
  is_builtin      BOOLEAN DEFAULT false,
  created_by      VARCHAR(100) NOT NULL,
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);

-- 实验报告表
CREATE TABLE chaos_reports (
  id              VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id   VARCHAR(36) NOT NULL,
  resilience_score DECIMAL(5,2),            -- 0-100
  faults_injected INT DEFAULT 0,
  faults_recovered INT DEFAULT 0,
  recovery_time_ms INT,
  mttr_minutes     INT,
  impact_summary    JSONB,
  recommendations   JSONB DEFAULT '[]',
  generated_at      TIMESTAMP DEFAULT NOW(),
  created_by        VARCHAR(100)
);

CREATE INDEX idx_templates_tenant ON chaos_templates(tenant_id);
CREATE INDEX idx_templates_category ON chaos_templates(category);
CREATE INDEX idx_reports_experiment ON chaos_reports(experiment_id);
```

### 3.2 TypeScript 接口

```typescript
interface ChaosExperiment {
  id: string;
  name: string;
  description: string;
  templateId?: string;
  status: 'draft' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  faultType: string;
  faultConfig: Record<string, any>;
  scopeConfig: {
    targets: string[];    // 目标服务/实例
    environment: string;
    percent?: number;     // 影响百分比
  };
  durationSeconds: number;
  elapsedSeconds?: number;
  faultsInjected: number;
  faultsRecovered: number;
  resilienceScore?: number;
  createdBy: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  tags: string[];
}

interface ChaosTemplate {
  id: string;
  name: string;
  description: string;
  faultType: string;
  faultConfig: Record<string, any>;
  scopeConfig: Record<string, any>;
  durationSeconds: number;
  category: 'cpu' | 'memory' | 'network' | 'disk' | 'service';
  tags: string[];
  isBuiltin: boolean;
  createdBy: string;
  createdAt: Date;
  usageCount?: number;
}

interface ChaosReport {
  id: string;
  experimentId: string;
  resilienceScore: number;     // 0-100
  faultsInjected: number;
  faultsRecovered: number;
  recoveryTimeMs?: number;
  mttrMinutes?: number;
  impactSummary: {
    availabilityBefore: number;
    availabilityAfter: number;
    affectedServices: string[];
    errorRate: number;
  };
  recommendations: {
    priority: 'high' | 'medium' | 'low';
    description: string;
    category: 'redundancy' | 'timeout' | 'circuit-breaker' | 'fallback';
  }[];
  generatedAt: Date;
}

interface ResilienceScore {
  serviceId: string;
  serviceName: string;
  overallScore: number;         // 0-100
  categoryScores: {
    availability: number;
    recoverability: number;
    faultTolerance: number;
    observability: number;
  };
  lastExperimentAt?: Date;
  experimentCount: number;
  trend: 'improving' | 'degrading' | 'stable';
}
```

---

## 四、API 路由设计

### 4.1 完整端点清单

| 方法 | 路径 | 描述 | 权限 | 请求体 | 响应 |
|------|------|------|------|--------|------|
| **实验管理** |
| POST | `/chaos-experiments` | 创建实验 | `chaos:write` | `ChaosExperimentCreate` | `{ data: ChaosExperiment }` |
| GET | `/chaos-experiments` | 实验列表 | `chaos:read` | query | `{ data: [], total, page }` |
| GET | `/chaos-experiments/:id` | 实验详情 | `chaos:read` | - | `{ data: ChaosExperiment }` |
| PATCH | `/chaos-experiments/:id` | 更新实验 | `chaos:write` | `ChaosExperimentUpdate` | `{ data: ChaosExperiment }` |
| DELETE | `/chaos-experiments/:id` | 删除实验 | `chaos:admin` | - | `{ success: true }` |
| **实验执行** |
| POST | `/chaos-experiments/:id/start` | 启动实验 | `chaos:execute` | - | `{ data: { status, startedAt } }` |
| POST | `/chaos-experiments/:id/pause` | 暂停实验 | `chaos:execute` | - | `{ data: { status } }` |
| POST | `/chaos-experiments/:id/resume` | 恢复实验 | `chaos:execute` | - | `{ data: { status } }` |
| POST | `/chaos-experiments/:id/stop` | 停止实验 | `chaos:execute` | - | `{ data: { status } }` |
| GET | `/chaos-experiments/:id/status` | 实验状态 | `chaos:read` | - | `{ data: { status, elapsed, progress } }` |
| GET | `/chaos-experiments/:id/metrics` | 实时指标 | `chaos:read` | - | `{ data: { cpu, memory, latency, errorRate }[] }` |
| POST | `/chaos-experiments/:id/inject` | 注入故障 | `chaos:execute` | `FaultInjectInput` | `{ data: { faultId, status } }` |
| **实验报告** |
| GET | `/chaos-experiments/:id/report` | 实验报告 | `chaos:read` | - | `{ data: ChaosReport }` |
| **故障库** |
| GET | `/chaos-faults` | 故障类型列表 | `chaos:read` | - | `{ data: FaultType[] }` |
| POST | `/chaos-faults/:type/config-template` | 故障配置模板 | `chaos:read` | - | `{ data: { params, defaults } }` |
| **模板管理** |
| GET | `/chaos-templates` | 模板列表 | `chaos:read` | query | `{ data: ChaosTemplate[], total }` |
| POST | `/chaos-templates` | 创建模板 | `chaos:write` | `ChaosTemplateCreate` | `{ data: ChaosTemplate }` |
| GET | `/chaos-templates/:id` | 模板详情 | `chaos:read` | - | `{ data: ChaosTemplate }` |
| PUT | `/chaos-templates/:id` | 更新模板 | `chaos:write` | `ChaosTemplateUpdate` | `{ data: ChaosTemplate }` |
| DELETE | `/chaos-templates/:id` | 删除模板 | `chaos:admin` | - | `{ success: true }` |
| **弹性评分** |
| GET | `/chaos-resilience-scores` | 评分列表 | `chaos:read` | query | `{ data: ResilienceScore[], total }` |
| GET | `/chaos-resilience-scores/:serviceId` | 服务评分详情 | `chaos:read` | - | `{ data: ResilienceScore }` |

---

## 五、页面交互设计（前端）

### 5.1 页面清单

| 页面 | 路径 | 菜单归属 | 核心功能 |
|------|------|----------|----------|
| 实验列表 | `/ops/chaos` | 可观测性 | 列表、搜索、状态过滤、创建、删除 |
| 实验创建 | `/ops/chaos/new` | 可观测性 | 选择模板/配置故障/设置范围/审批 |
| 实验执行 | `/ops/chaos/:id/execute` | 可观测性 | 实时监控、注入控制、暂停/恢复 |
| 实验报告 | `/ops/chaos/:id/report` | 可观测性 | 弹性评分、影响分析、改进建议 |
| 实验模板 | `/ops/chaos/templates` | 可观测性 | 模板库、创建、编辑、删除 |

### 5.2 实验列表页

**文件**: `orion-frontend/src/pages/ChaosExperiment/index.tsx`

```tsx
import { useState, useEffect } from 'react';
import { Card, Table, Button, Input, Select, Space, Tag, Empty, message, Popconfirm } from 'antd';
import { PlusOutlined, SearchOutlined, PlayCircleOutlined, FileTextOutlined } from '@ant-design/icons';
import { colors } from '@/tokens/colors';
import { componentRadius } from '@/tokens/radius';
import { spacing } from '@/tokens/spacing';
import { useNavigate } from 'react-router-dom';
import { fetchChaosExperiments, deleteChaosExperiment } from '@/api/chaos';
import type { ChaosExperiment } from '@/types/chaos';

const statusColorMap: Record<string, string> = {
  draft: colors.neutral[500],
  running: colors.primary[500],
  paused: colors.warning[500],
  completed: colors.success[500],
  failed: colors.error[500],
  cancelled: colors.neutral[400],
};

export default function ChaosExperimentListPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [experiments, setExperiments] = useState<ChaosExperiment[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchText, setSearchText] = useState('');

  const loadExperiments = async () => {
    setLoading(true);
    try {
      const res = await fetchChaosExperiments({
        page, pageSize: 20,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        search: searchText,
      });
      setExperiments(res.data);
      setTotal(res.total);
    } catch {
      message.error('加载实验列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadExperiments(); }, [page, statusFilter]);

  const handleDelete = async (id: string) => {
    try {
      await deleteChaosExperiment(id);
      message.success('实验已删除');
      loadExperiments();
    } catch {
      message.error('删除失败');
    }
  };

  const columns = [
    { title: '实验名称', dataIndex: 'name', ellipsis: true,
      render: (v: string, r: ChaosExperiment) => (
        <a onClick={() => navigate(`/ops/chaos/${r.id}/report`)}>{v}</a>
      )},
    { title: '状态', dataIndex: 'status', width: 100,
      render: (v: string) => <Tag color={statusColorMap[v]}>{v}</Tag> },
    { title: '故障类型', dataIndex: 'faultType', width: 120 },
    { title: '影响范围', dataIndex: ['scopeConfig', 'targets'], width: 160,
      render: (v: string[]) => (v || []).slice(0, 3).join(', ') },
    { title: '进度', width: 120,
      render: (_: any, r: ChaosExperiment) =>
        r.durationSeconds ? `${Math.round(((r.elapsedSeconds || 0) / r.durationSeconds) * 100)}%` : '-' },
    { title: '弹性评分', dataIndex: 'resilienceScore', width: 100,
      render: (v: number) => v !== undefined ? `${v}分` : '-' },
    { title: '创建人', dataIndex: 'createdBy', width: 100 },
    { title: '创建时间', dataIndex: 'createdAt', width: 160,
      render: (v: Date) => new Date(v).toLocaleString() },
    { title: '操作', width: 200, fixed: 'right' as const,
      render: (_: any, r: ChaosExperiment) => (
        <Space>
          {r.status === 'draft' && (
            <Button type="link" size="small" icon={<PlayCircleOutlined />}
              onClick={() => navigate(`/ops/chaos/${r.id}/execute`)}>执行</Button>
          )}
          <Button type="link" size="small" icon={<FileTextOutlined />}
            onClick={() => navigate(`/ops/chaos/${r.id}/report`)}>报告</Button>
          <Popconfirm title="确认删除？" onConfirm={() => handleDelete(r.id)}>
            <Button type="link" size="small" danger>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: spacing.md }}>
      <Card style={{ borderRadius: componentRadius.card }}>
        <Space style={{ marginBottom: spacing.md }} wrap>
          <Input placeholder="搜索实验名称" prefix={<SearchOutlined />}
            value={searchText} onChange={e => setSearchText(e.target.value)}
            onPressEnter={() => { setPage(1); loadExperiments(); }} style={{ width: 280 }} />
          <Select value={statusFilter} onChange={v => { setStatusFilter(v); setPage(1); }}
            style={{ width: 120 }}
            options={[{ value: 'all', label: '全部状态' },
              { value: 'draft', label: '草稿' }, { value: 'running', label: '运行中' },
              { value: 'paused', label: '已暂停' }, { value: 'completed', label: '已完成' },
              { value: 'failed', label: '已失败' }]} />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/ops/chaos/new')}>
            创建实验
          </Button>
          <Button onClick={() => navigate('/ops/chaos/templates')}>实验模板</Button>
        </Space>
        <Table columns={columns} dataSource={experiments} rowKey="id" loading={loading}
          scroll={{ x: 1200 }}
          pagination={{ current: page, pageSize: 20, total, showTotal: t => `共 ${t} 条`,
            onChange: p => setPage(p) }}
          locale={{ emptyText: <Empty description="暂无混沌实验">
            <Button type="primary" onClick={() => navigate('/ops/chaos/new')}>创建第一个实验</Button>
          </Empty> }} />
      </Card>
    </div>
  );
}
```

### 5.3 实验创建页

**文件**: `orion-frontend/src/pages/ChaosExperiment/Create.tsx`

```tsx
// 创建表单分步流程
// Step 1: 选择模板（可选）→ 从模板列表选择或空白创建
// Step 2: 配置故障 → 选择故障类型、填写参数
// Step 3: 设置范围 → 选择目标服务、环境、影响百分比
// Step 4: 确认提交 → 预览配置、提交

const handleCreate = async () => {
  setSubmitting(true);
  try {
    const res = await createChaosExperiment(form);
    message.success('实验创建成功');
    navigate(`/ops/chaos/${res.data.id}/execute`);
  } catch {
    message.error('创建失败');
  } finally {
    setSubmitting(false);
  }
};
```

### 5.4 实验执行页

**文件**: `orion-frontend/src/pages/ChaosExperiment/Execute.tsx`

```tsx
// 实时状态轮询（每 3 秒刷新一次）
useEffect(() => {
  if (experiment.status === 'running') {
    const timer = setInterval(async () => {
      const res = await getExperimentStatus(experiment.id);
      setExperiment(prev => ({ ...prev, ...res.data }));
      // 更新指标数据
      const metricsRes = await getExperimentMetrics(experiment.id);
      setMetrics(metricsRes.data);
    }, 3000);
    return () => clearInterval(timer);
  }
}, [experiment.status, experiment.id]);

// 控制按钮
const handlePause = async () => {
  setActionLoading(true);
  try {
    await pauseExperiment(experiment.id);
    message.success('实验已暂停');
    refreshStatus();
  } catch { message.error('暂停失败'); }
  finally { setActionLoading(false); }
};
```

### 5.5 实验报告页

**文件**: `orion-frontend/src/pages/ChaosExperiment/Report.tsx`

```tsx
// 弹性评分展示
<Statistic title="弹性评分" value={report.resilienceScore} suffix="/ 100"
  valueStyle={{ color: report.resilienceScore >= 80 ? colors.success[500] : report.resilienceScore >= 60 ? colors.warning[500] : colors.error[500] }} />

// 改进建议列表
<Table dataSource={report.recommendations} rowKey={(r, i) => `${i}-${r.description}`}>
  <Column title="优先级" dataIndex="priority"
    render={(v: string) => <Tag color={v === 'high' ? colors.error[500] : v === 'medium' ? colors.warning[500] : colors.neutral[500]}>{v}</Tag>} />
  <Column title="建议" dataIndex="description" />
  <Column title="类别" dataIndex="category" />
</Table>
```

---

## 六、权限模型

| 角色 | 查看实验 | 创建实验 | 执行实验 | 删除实验 | 管理模板 |
|------|:--------:|:--------:|:--------:|:--------:|:--------:|
| Viewer | ✅ | - | - | - | - |
| Member | ✅ | ✅ | ✅ | - | - |
| Admin | ✅ | ✅ | ✅ | ✅ | ✅ |
| Platform Admin | ✅ | ✅ | ✅ | ✅ | ✅ |

权限: `requirePermission({ resource: 'chaos', action: 'read' | 'write' | 'execute' | 'admin' })`

---

## 七、外部依赖检查

| 依赖 | 用途 | 状态 |
|------|------|------|
| Prometheus/Grafana | 实验指标采集 | ✅ 已有集成 |
| K8s API | 目标服务查询 | ✅ 已有 |
| 审批流 `ApprovalFlowEngine` | 高危实验审批 | ✅ 已有 |
| 告警系统 | 实验异常告警 | ✅ 已有 |

---

## 八、Design Token 使用

| 用途 | Token |
|------|-------|
| 运行中状态 | `colors.primary[500]` |
| 已暂停状态 | `colors.warning[500]` |
| 已完成状态 | `colors.success[500]` |
| 已失败状态 | `colors.error[500]` |
| 卡片圆角 | `componentRadius.card` (12px) |
| 卡片间距 | `spacing.md` (16px) |
| 按钮间距 | `spacing.sm` (8px) |

---

## 九、验收标准

### 9.1 端到端场景

| # | 场景 | 预期结果 |
|---|------|----------|
| E1 | 从模板创建实验 | 选择模板后自动填充故障配置，可编辑后提交 |
| E2 | 启动实验并实时监控 | 实验状态变为 running，进度条实时更新 |
| E3 | 运行中暂停/恢复 | 状态正确切换，指标暂停/恢复采集 |
| E4 | 实验完成后查看报告 | 显示弹性评分、故障注入/恢复统计、改进建议 |
| E5 | 创建自定义模板 | 保存后可在模板列表查看，支持一键使用 |
| E6 | 实验列表按状态过滤 | 过滤后列表正确缩小 |
| E7 | 删除草稿实验 | 二次确认后删除 |
| E8 | 高危实验需审批 | 提交后状态变为 pending-approval，审批通过后才可执行 |

### 9.2 量化指标

| 指标 | 目标值 |
|------|--------|
| 实验列表加载时间 | < 1s (p95) |
| 实验启动响应时间 | < 2s |
| 实时监控刷新延迟 | < 3s |
| 报告生成时间 | < 5s |
| 前端单元测试覆盖率 | > 75% |

---

_文档版本: v1.0 | 创建日期: 2026-05-22_
