# 问题管理（Problem Management）能力增强设计

> **日期**: 2026-05-22
> **状态**: 设计中
> **模块优先级**: P1
> **基于模块**: 工单系统 (`/workbench`)
> **目标成熟度**: 7/10 → 8.5/10

---

## 一、业务概述与现状评估

### 1.1 背景

Orion 工单系统（`services/ticketing/`）功能完整，支持 ticket 创建、分配、流转、SLA 跟踪。
但工单的 `category` 字段仅区分基础设施/应用/数据库等来源，**没有独立的问题管理子类型**，
无法追踪重复性问题、根因分析、问题关闭率等 DevOps 核心指标。

### 1.2 现状评估

| 维度 | 现状 | 文件 |
|------|------|------|
| 工单核心 | ✅ 完整（创建/分配/流转/SLA） | `services/ticketing/TicketService.ts` 620 行 |
| 工单关联分析 | ✅ 已有 | `services/ticketing/TicketRelationAnalyzer.ts` |
| 工单报告 | ✅ 已有 | `services/ticketing/TicketReportService.ts` |
| 问题子类型 | ❌ 缺失 | `types.ts` 仅 `TicketCategory`，无 `ProblemType` |
| 问题生命周期 | ❌ 缺失 | 无独立状态机 |
| 根因关联 | ❌ 缺失 | 无 RCA（Root Cause Analysis）关联表 |
| 问题统计面板 | ⚠️ 部分 | 工单报告不含问题维度 |

### 1.3 增强目标

| 功能模块 | 描述 | 验收等级 |
|----------|------|:--------:|
| 问题类型枚举 | 10+ 种标准问题类型，支持自定义扩展 | 8.5 |
| 问题生命周期 | 独立于工单的状态机（识别→分析→修复→验证→关闭） | 8.5 |
| 根因关联 | 问题 ↔ 工单 ↔ 变更 ↔ 服务 多维关联 | 8.5 |
| 问题统计面板 | 问题 MTTR、重复率、根因分布、趋势 | 8.5 |

---

## 二、功能设计（后端）

### 2.1 问题类型枚举

**内置问题类型**（10 种）：

```typescript
type ProblemType =
  | 'performance-degradation'   // 性能下降
  | 'service-outage'            // 服务中断
  | 'data-corruption'           // 数据损坏
  | 'security-vulnerability'    // 安全漏洞
  | 'configuration-drift'       // 配置漂移
  | 'resource-exhaustion'       // 资源耗尽
  | 'dependency-failure'        // 依赖故障
  | 'deployment-failure'        // 发布失败
  | 'monitoring-gap'            // 监控盲区
  | 'process-inefficiency';     // 流程低效
```

**自定义扩展**：租户可通过 `POST /api/v1/problems/types` 创建自定义类型。

### 2.2 问题生命周期

独立状态机，与工单状态解耦：

```
identified → analyzing → fix-in-progress → verifying → closed → post-mortem
    ↓              ↓           ↓               ↓
  rejected     escalated   rollback      reopened
```

| 状态 | 含义 | 允许转换 |
|------|------|----------|
| `identified` | 问题已识别，待分析 | → analyzing, → rejected |
| `analyzing` | 根因分析中 | → fix-in-progress, → escalated, → closed |
| `fix-in-progress` | 修复进行中 | → verifying, → rollback |
| `verifying` | 修复验证中 | → closed, → reopened |
| `closed` | 问题已关闭 | → post-mortem, → reopened |
| `post-mortem` | 复盘完成 | → closed |

### 2.3 问题-工单关联模型

```
Problem (1) ←→ (N) Ticket (关联的工单)
Problem (1) ←→ (N) ChangeIntelligenceReport (关联的变更)
Problem (1) ←→ (N) Service (影响的服务)
Problem (1) ←→ (1) RootCauseAnalysis (根因分析)
```

### 2.4 根因分析（RCA）

```typescript
interface RootCauseAnalysis {
  id: string;
  problemId: string;
  rootCause: string;              // 根因描述
  causeCategory: 'code' | 'config' | 'infra' | 'process' | 'external';
  contributingFactors: string[];  //  contributing 因素列表
  evidenceLinks: string[];        // 证据链接（日志/监控/变更）
  discoveredBy: 'ai' | 'manual' | 'alert';
  confidenceScore: number;        // AI 置信度 0-1
  discoveredAt: Date;
  createdBy: string;
}
```

---

## 三、数据模型设计

### 3.1 新增数据库表

```sql
-- 问题主表
CREATE TABLE problems (
  id              VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       VARCHAR(36) NOT NULL,
  problem_number  VARCHAR(20) NOT NULL,          -- PRB-00001, 自动递增
  title           VARCHAR(255) NOT NULL,
  description     TEXT,
  problem_type    VARCHAR(50) NOT NULL,
  status          VARCHAR(30) NOT NULL DEFAULT 'identified',
  priority        VARCHAR(10) NOT NULL DEFAULT 'medium',
  severity        INT NOT NULL DEFAULT 3,         -- 1-5, 1=最高
  reporter        VARCHAR(100) NOT NULL,
  assignee        VARCHAR(100),
  rca_id          VARCHAR(36),                    -- FK to root_cause_analyses
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW(),
  identified_at   TIMESTAMP,
  closed_at       TIMESTAMP,
  mttr_minutes    INT,                            -- Mean Time To Resolve
  recurrence_count INT DEFAULT 0,                 -- 重复出现次数
  tags            JSONB DEFAULT '[]',
  metadata        JSONB DEFAULT '{}'
);

-- 根因分析表
CREATE TABLE root_cause_analyses (
  id                VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  problem_id        VARCHAR(36) NOT NULL,
  root_cause        TEXT NOT NULL,
  cause_category    VARCHAR(20) NOT NULL,
  contributing_factors JSONB DEFAULT '[]',
  evidence_links    JSONB DEFAULT '[]',
  discovered_by     VARCHAR(10) NOT NULL,
  confidence_score  DECIMAL(3,2) DEFAULT 0.00,
  discovered_at     TIMESTAMP DEFAULT NOW(),
  created_by        VARCHAR(100) NOT NULL
);

-- 问题-工单关联表
CREATE TABLE problem_ticket_relations (
  id          VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  problem_id  VARCHAR(36) NOT NULL,
  ticket_id   VARCHAR(36) NOT NULL,
  relation_type VARCHAR(20) DEFAULT 'related',   -- related/caused_by/symptom
  created_at  TIMESTAMP DEFAULT NOW()
);

-- 问题-服务影响表
CREATE TABLE problem_service_impacts (
  id          VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  problem_id  VARCHAR(36) NOT NULL,
  service_name VARCHAR(100) NOT NULL,
  impact_level VARCHAR(10) NOT NULL,              -- critical/high/medium/low
  affected_since TIMESTAMP DEFAULT NOW()
);

-- 问题自定义类型表
CREATE TABLE custom_problem_types (
  id          VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   VARCHAR(36) NOT NULL,
  type_code   VARCHAR(50) NOT NULL,
  type_name   VARCHAR(100) NOT NULL,
  description TEXT,
  icon        VARCHAR(50),
  created_by  VARCHAR(100) NOT NULL,
  created_at  TIMESTAMP DEFAULT NOW(),
  UNIQUE(tenant_id, type_code)
);

CREATE INDEX idx_problems_tenant ON problems(tenant_id);
CREATE INDEX idx_problems_type ON problems(problem_type);
CREATE INDEX idx_problems_status ON problems(status);
CREATE INDEX idx_problems_number ON problems(problem_number);
CREATE INDEX idx_rca_problem ON root_cause_analyses(problem_id);
CREATE INDEX idx_ptr_problem ON problem_ticket_relations(problem_id);
CREATE INDEX idx_ptr_ticket ON problem_ticket_relations(ticket_id);
```

### 3.2 TypeScript 接口

```typescript
interface Problem {
  id: string;
  tenantId: string;
  problemNumber: string;       // PRB-00001
  title: string;
  description: string;
  problemType: ProblemType | string;
  status: ProblemStatus;
  priority: TicketPriority;
  severity: number;            // 1-5
  reporter: string;
  assignee?: string;
  rcaId?: string;
  rca?: RootCauseAnalysis;
  createdAt: Date;
  updatedAt: Date;
  identifiedAt?: Date;
  closedAt?: Date;
  mttrMinutes?: number;
  recurrenceCount: number;
  tags: string[];
  metadata: Record<string, any>;
  ticketCount?: number;
  affectedServices?: ProblemServiceImpact[];
}

type ProblemStatus =
  | 'identified'
  | 'analyzing'
  | 'fix-in-progress'
  | 'verifying'
  | 'closed'
  | 'post-mortem'
  | 'rejected'
  | 'escalated'
  | 'reopened';

interface ProblemStatistics {
  totalProblems: number;
  byStatus: Record<ProblemStatus, number>;
  byType: Record<string, number>;
  avgMTTR: number;
  avgRecurrence: number;
  topRootCauses: { category: string; count: number }[];
  trend: { period: string; count: number }[];
}
```

---

## 四、API 路由设计

### 4.1 路由注册

```typescript
// orion-platform-service/src/api/problem-routes.ts
// 挂载路径: /api/v1
// 注册: routes.ts 中添加 problemRoutes
```

### 4.2 端点清单

| 方法 | 路径 | 描述 | 权限 | 请求体 | 响应 |
|------|------|------|------|--------|------|
| **问题管理** |
| POST | `/problems` | 创建问题 | `problem:write` | `ProblemCreateInput` | `{ data: Problem }` |
| GET | `/problems` | 问题列表（分页/过滤） | `problem:read` | query | `{ data: Problem[], total, page }` |
| GET | `/problems/:id` | 问题详情 | `problem:read` | - | `{ data: Problem }` |
| PATCH | `/problems/:id` | 更新问题 | `problem:write` | `ProblemUpdateInput` | `{ data: Problem }` |
| POST | `/problems/:id/status` | 转换状态 | `problem:write` | `{ status, comment? }` | `{ data: Problem }` |
| DELETE | `/problems/:id` | 删除问题 | `problem:admin` | - | `{ success: true }` |
| **根因分析** |
| POST | `/problems/:id/rca` | 创建/更新 RCA | `problem:write` | `RCAInput` | `{ data: RootCauseAnalysis }` |
| GET | `/problems/:id/rca` | 获取 RCA | `problem:read` | - | `{ data: RootCauseAnalysis }` |
| POST | `/problems/:id/rca/ai-analyze` | AI 根因分析 | `problem:write` | `{ context?: {} }` | `{ data: RCAInput, confidence }` |
| **关联管理** |
| POST | `/problems/:id/tickets` | 关联工单 | `problem:write` | `{ ticketId, relationType }` | `{ data: ProblemTicketRelation }` |
| GET | `/problems/:id/tickets` | 问题关联的工单列表 | `problem:read` | query | `{ data: Ticket[], total }` |
| DELETE | `/problems/:id/tickets/:ticketId` | 解除关联 | `problem:write` | - | `{ success: true }` |
| POST | `/problems/:id/services` | 添加影响服务 | `problem:write` | `{ serviceName, impactLevel }` | `{ data: ProblemServiceImpact }` |
| GET | `/problems/:id/services` | 影响服务列表 | `problem:read` | - | `{ data: ProblemServiceImpact[] }` |
| **统计与分析** |
| GET | `/problems/statistics` | 问题统计面板 | `problem:read` | query: period | `{ data: ProblemStatistics }` |
| GET | `/problems/trend` | 问题趋势（按时间） | `problem:read` | query: days | `{ data: { period, count, mttr }[] }` |
| GET | `/problems/types` | 获取问题类型列表 | `problem:read` | - | `{ data: ProblemTypeConfig[] }` |
| POST | `/problems/types` | 创建自定义类型 | `problem:admin` | `{ typeCode, typeName, ... }` | `{ data: ProblemTypeConfig }` |

### 4.3 请求/响应 TypeScript 接口

```typescript
interface ProblemCreateInput {
  title: string;
  description: string;
  problemType: ProblemType | string;
  priority?: TicketPriority;
  severity?: number;
  assignee?: string;
  tags?: string[];
  relatedTicketIds?: string[];
  affectedServices?: { serviceName: string; impactLevel: string }[];
}

interface ProblemUpdateInput {
  title?: string;
  description?: string;
  priority?: TicketPriority;
  severity?: number;
  assignee?: string;
  tags?: string[];
  metadata?: Record<string, any>;
}

interface RCAInput {
  rootCause: string;
  causeCategory: 'code' | 'config' | 'infra' | 'process' | 'external';
  contributingFactors?: string[];
  evidenceLinks?: string[];
  discoveredBy?: 'ai' | 'manual' | 'alert';
  confidenceScore?: number;
}

interface ProblemTypeConfig {
  code: string;
  name: string;
  description?: string;
  icon?: string;
  isBuiltIn: boolean;
}
```

---

## 五、页面交互设计（前端）

### 5.1 页面清单

| 页面 | 路径 | 菜单归属 | 核心功能 |
|------|------|----------|----------|
| 问题列表 | `/workbench/problems` | 工作台 | 列表、搜索、过滤、创建、批量操作 |
| 问题详情 | `/workbench/problems/:id` | 工作台 | 详情、RCA、关联工单、状态流转 |
| 根因分析 | `/workbench/problems/:id/rca` | 工作台 | RCA 编辑、AI 分析、证据链 |
| 问题统计 | `/workbench/problem-stats` | 工作台 | MTTR、趋势图、类型分布、TOP 根因 |

### 5.2 问题列表页

**文件**: `orion-frontend/src/pages/ProblemList/index.tsx`

```tsx
import { useState, useEffect } from 'react';
import { Card, Table, Button, Input, Select, Space, Tag, Empty, message, Popconfirm } from 'antd';
import { PlusOutlined, SearchOutlined, ExportOutlined } from '@ant-design/icons';
import { colors } from '@/tokens/colors';
import { componentRadius } from '@/tokens/radius';
import { spacing } from '@/tokens/spacing';
import { useNavigate } from 'react-router-dom';
import { fetchProblems, deleteProblem, batchUpdateProblemStatus } from '@/api/problem';
import type { Problem, ProblemStatus, ProblemType } from '@/types/problem';

const statusColorMap: Record<ProblemStatus, string> = {
  identified: colors.warning[500],
  analyzing: colors.info[500],
  'fix-in-progress': colors.primary[500],
  verifying: colors.purple[500],
  closed: colors.success[500],
  'post-mortem': colors.neutral[500],
  rejected: colors.neutral[400],
  escalated: colors.error[500],
  reopened: colors.error[500],
};

export default function ProblemListPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProblemStatus | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<ProblemType | 'all'>('all');

  const loadProblems = async () => {
    setLoading(true);
    try {
      const res = await fetchProblems({
        page,
        pageSize,
        search: searchText,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        type: typeFilter !== 'all' ? typeFilter : undefined,
      });
      setProblems(res.data);
      setTotal(res.total);
    } catch (err) {
      message.error('加载问题列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadProblems(); }, [page, pageSize, statusFilter, typeFilter]);

  const handleDelete = async (id: string) => {
    try {
      await deleteProblem(id);
      message.success('问题已删除');
      loadProblems();
    } catch {
      message.error('删除失败');
    }
  };

  const columns = [
    { title: '编号', dataIndex: 'problemNumber', width: 120,
      render: (v: string, r: Problem) => (
        <a onClick={() => navigate(`/workbench/problems/${r.id}`)}>{v}</a>
      )},
    { title: '标题', dataIndex: 'title', ellipsis: true },
    { title: '类型', dataIndex: 'problemType', width: 140,
      render: (v: string) => <Tag color={colors.primary[500]}>{v}</Tag> },
    { title: '状态', dataIndex: 'status', width: 120,
      render: (v: ProblemStatus) => <Tag color={statusColorMap[v]}>{v}</Tag> },
    { title: '优先级', dataIndex: 'priority', width: 90,
      render: (v: string) => <Tag color={v === 'critical' ? colors.error[500] : v === 'high' ? colors.warning[500] : colors.neutral[500]}>{v}</Tag> },
    { title: '严重度', dataIndex: 'severity', width: 80, align: 'center' as const },
    { title: '关联工单', dataIndex: 'ticketCount', width: 90, align: 'center' as const },
    { title: '重复次数', dataIndex: 'recurrenceCount', width: 90, align: 'center' as const },
    { title: 'MTTR', dataIndex: 'mttrMinutes', width: 90,
      render: (v: number) => v ? `${Math.floor(v / 60)}h${v % 60}m` : '-' },
    { title: '负责人', dataIndex: 'assignee', width: 100 },
    { title: '创建时间', dataIndex: 'createdAt', width: 160,
      render: (v: Date) => new Date(v).toLocaleString() },
    { title: '操作', width: 120, fixed: 'right' as const,
      render: (_: any, r: Problem) => (
        <Space>
          <Button type="link" size="small" onClick={() => navigate(`/workbench/problems/${r.id}/rca`)}>RCA</Button>
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
        {/* 搜索过滤区 */}
        <Space style={{ marginBottom: spacing.md }} wrap>
          <Input
            placeholder="搜索问题标题/编号"
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            onPressEnter={() => { setPage(1); loadProblems(); }}
            style={{ width: 280 }}
          />
          <Select value={statusFilter} onChange={v => { setStatusFilter(v); setPage(1); }}
            style={{ width: 140 }}
            options={[{ value: 'all', label: '全部状态' },
              { value: 'identified', label: '已识别' }, { value: 'analyzing', label: '分析中' },
              { value: 'fix-in-progress', label: '修复中' }, { value: 'verifying', label: '验证中' },
              { value: 'closed', label: '已关闭' }, { value: 'reopened', label: '已重新打开' }]} />
          <Button type="primary" icon={<PlusOutlined />}
            onClick={() => navigate('/workbench/problems/new')}>
            创建问题
          </Button>
          <Button icon={<ExportOutlined />}>导出</Button>
        </Space>

        {/* 数据表格 */}
        <Table
          columns={columns}
          dataSource={problems}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1400 }}
          pagination={{
            current: page, pageSize, total,
            showSizeChanger: true, showTotal: t => `共 ${t} 条`,
            onChange: p => setPage(p), onShowSizeChange: (_, s) => { setPageSize(s); setPage(1); },
          }}
          locale={{ emptyText: <Empty description="暂无问题数据" image={Empty.PRESENTED_IMAGE_SIMPLE}>
            <Button type="primary" onClick={() => navigate('/workbench/problems/new')}>创建第一个问题</Button>
          </Empty> }}
        />
      </Card>
    </div>
  );
}
```

### 5.3 问题详情页

**文件**: `orion-frontend/src/pages/ProblemDetail/index.tsx`

核心交互要点：
- 顶部展示问题编号、标题、状态 Tag、优先级 Tag
- 状态转换按钮组（根据当前状态动态显示允许的转换）
- Tab 切换：基本信息 / 关联工单 / 影响服务 / 活动日志
- 右侧悬浮 RCA 快捷入口
- 编辑模式：切换后 Descriptions 转为 Form.Item + Input
- 保存按钮底部固定，提交前校验

```tsx
// 状态转换按钮（示例片段）
const allowedTransitions: Record<ProblemStatus, ProblemStatus[]> = {
  identified: ['analyzing', 'rejected'],
  analyzing: ['fix-in-progress', 'escalated', 'closed'],
  'fix-in-progress': ['verifying', 'rollback'],
  verifying: ['closed', 'reopened'],
  closed: ['post-mortem', 'reopened'],
  'post-mortem': ['closed'],
  rejected: ['identified'],
  escalated: ['analyzing'],
  reopened: ['analyzing'],
};

// 状态转换操作
const handleStatusChange = async (newStatus: ProblemStatus) => {
  setTransitioning(true);
  try {
    await updateProblemStatus(problem.id, { status: newStatus, comment: transitionComment });
    message.success(`状态已更新为 ${newStatus}`);
    loadProblem();
  } catch {
    message.error('状态转换失败');
  } finally {
    setTransitioning(false);
  }
};
```

### 5.4 根因分析页

**文件**: `orion-frontend/src/pages/ProblemDetail/RcaPanel.tsx`

```tsx
// AI 根因分析交互
const handleAIAnalyze = async () => {
  setAnalyzing(true);
  try {
    const res = await aiAnalyzeProblem(problem.id, {
      context: { relatedTickets: true, recentChanges: true, metrics: true },
    });
    setRcaForm(res.data);
    message.success(`AI 分析完成，置信度 ${(res.confidence * 100).toFixed(0)}%`);
  } catch {
    message.error('AI 分析失败');
  } finally {
    setAnalyzing(false);
  }
};

// 保存 RCA
const handleSaveRCA = async () => {
  setSaving(true);
  try {
    await saveRCA(problem.id, rcaForm);
    message.success('根因分析已保存');
    loadProblem();
  } catch {
    message.error('保存失败');
  } finally {
    setSaving(false);
  }
};
```

### 5.5 问题统计页

**文件**: `orion-frontend/src/pages/ProblemStats/index.tsx`

```tsx
// 页面结构（卡片布局）
// 第一行: 总问题数 | 平均 MTTR | 关闭率 | 重复率
// 第二行: 问题趋势折线图 | 问题类型饼图
// 第三行: TOP 根因分布 | 状态分布
// 第四行: 按服务/团队维度统计

// 时间范围选择器
<Select value={period} onChange={setPeriod} style={{ width: 120 }}>
  <Option value="7d">近 7 天</Option>
  <Option value="30d">近 30 天</Option>
  <Option value="90d">近 90 天</Option>
</Select>

// 关键指标卡片
<Row gutter={spacing.md}>
  <Col span={6}>
    <Statistic title="总问题数" value={stats.totalProblems} suffix="个" />
  </Col>
  <Col span={6}>
    <Statistic title="平均 MTTR" value={stats.avgMTTR} suffix="分钟" />
  </Col>
  <Col span={6}>
    <Statistic title="问题关闭率" value={(stats.byStatus.closed / stats.totalProblems * 100).toFixed(1)} suffix="%" />
  </Col>
  <Col span={6}>
    <Statistic title="平均重复率" value={stats.avgRecurrence.toFixed(1)} suffix="次" />
  </Col>
</Row>
```

---

## 六、权限模型

| 角色 | 读问题 | 创建问题 | 编辑问题 | 删除问题 | 状态转换 | 管理类型 |
|------|:------:|:--------:|:--------:|:--------:|:--------:|:--------:|
| Viewer | ✅ | - | - | - | - | - |
| Member | ✅ | ✅ | ✅ (自己创建的) | - | ✅ (assigned) | - |
| Admin | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Platform Admin | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

权限检查：`requirePermission({ resource: 'problem', action: 'read' | 'write' | 'admin' })`

---

## 七、外部依赖检查

| 依赖 | 用途 | 状态 |
|------|------|------|
| 工单系统 `TicketService` | 关联工单查询 | ✅ 已有 |
| AI Review `AIReviewService` | AI 根因分析 | ✅ 已有 |
| 变更智能 `ChangeIntelligenceService` | 关联变更影响 | ✅ 已有 |
| CMDB `CmdbService` | 服务拓扑查询 | ✅ 已有 |

---

## 八、Design Token 使用

| 用途 | Token |
|------|-------|
| 状态 Tag 颜色 | `colors.warning[500]` (identified), `colors.info[500]` (analyzing), `colors.primary[500]` (fix-in-progress), `colors.purple[500]` (verifying), `colors.success[500]` (closed), `colors.error[500]` (escalated/reopened) |
| 卡片圆角 | `componentRadius.card` (12px) |
| 卡片间距 | `spacing.md` (16px) |
| 按钮间距 | `spacing.sm` (8px) |
| 表格悬停行 | `colors.primary[50]` |

---

## 九、验收标准

### 9.1 端到端场景

| # | 场景 | 预期结果 |
|---|------|----------|
| E1 | 创建问题并关联 2 个工单 | 问题创建成功，关联列表显示 2 个工单 |
| E2 | 问题状态从 identified → analyzing → fix-in-progress → verifying → closed | 每次转换有确认弹窗，转换后状态正确更新 |
| E3 | AI 根因分析 | 返回根因描述、置信度，可编辑后保存 |
| E4 | 问题列表按类型/状态过滤 | 过滤后列表正确缩小，总数更新 |
| E5 | 问题统计面板 | 显示正确的 MTTR、趋势、类型分布 |
| E6 | 自定义问题类型 | 创建后可在问题创建下拉框中选择 |
| E7 | 删除问题 | 二次确认后删除，关联关系同步清除 |
| E8 | 问题重复检测 | 相同类型+相似标题的问题自动标记 recurrenceCount |

### 9.2 量化指标

| 指标 | 目标值 |
|------|--------|
| 问题列表加载时间 | < 1s (p95) |
| 状态转换响应时间 | < 500ms |
| AI 根因分析响应时间 | < 5s |
| 统计面板数据加载 | < 2s |
| 单元测试覆盖率 | > 80% |

---

_文档版本: v1.0 | 创建日期: 2026-05-22_
