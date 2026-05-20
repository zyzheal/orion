# Pipeline 页面风格统一实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 统一 Pipeline 模块 6 个子页面的展示样式,重写版本历史页面为中文+Design Token,并微调其余页面的样式一致性。

**Architecture:** 复用现有 CardPanel、SearchFilterBar、Table、StatusBadge 等通用组件,基于 Design Token 体系(colors, spacing, radius, shadows)统一所有页面的间距、色彩、圆角、阴影。

**Tech Stack:** React + TypeScript + Ant Design + Design Tokens

---

### Task 1: 重写 PipelineVersionHistory 为中文 + Design Token 风格

**Files:**
- 修改: `orion-frontend/src/pages/pipeline-svc/PipelineVersionHistory/index.tsx` (完整重写)
- 测试: `orion-frontend/src/pages/pipeline-svc/PipelineVersionHistory/__tests__/index.test.tsx`

- [ ] **Step 1: 重写 PipelineVersionHistory 页面主体**

将现有页面从英文界面改为中文,使用 Design Token,CardPanel 包裹,统一 `padding: 0`。替换以下不一致的地方:
- `padding: 24` → `padding: 0`
- 英文标题 → 中文 "版本历史"
- 直接 Card 包裹 → CardPanel 包裹
- 硬编码色值 → `colors`, `spacing` token
- 英文界面文案 → 中文

```tsx
/**
 * Pipeline Version History Page
 * 版本历史记录与对比,支持版本回滚、基线标记、版本对比。
 *
 * 样式已统一为 Design Token 规范。
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Typography, Button, Space, Tag, Modal, message, Select } from 'antd';
import { colors, spacing } from '@/tokens';
import { ReloadOutlined, RollbackOutlined, CheckCircleOutlined, SwapOutlined } from '@ant-design/icons';
import Table, { type TableColumn } from '@/components/Table';
import StatusBadge from '@/components/StatusBadge';
import CardPanel from '@/components/CardPanel';
import { pipelineVersionsApi, PipelineVersion } from '@/api/pipeline-versions';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const PipelineVersionHistory: React.FC = () => {
  const navigate = useNavigate();
  const { pipelineId } = useParams<{ pipelineId: string }>();
  const [versions, setVersions] = useState<PipelineVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  // Load versions
  const loadVersions = useCallback(async () => {
    if (!pipelineId) return;
    setLoading(true);
    try {
      const response = await pipelineVersionsApi.list(pipelineId);
      setVersions(response.data || []);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '加载版本历史失败';
      message.error(msg);
    } finally {
      setLoading(false);
    }
  }, [pipelineId]);

  useEffect(() => {
    loadVersions();
  }, [loadVersions]);

  // Handle rollback
  const handleRollback = (version: PipelineVersion) => {
    Modal.confirm({
      title: '版本回滚',
      content: `确认回滚到版本 v${version.version}？此操作将修改当前 Pipeline 配置。`,
      okText: '确认回滚',
      cancelText: '取消',
      onOk: async () => {
        try {
          await pipelineVersionsApi.rollback(pipelineId!, version.id);
          message.success('回滚成功');
          loadVersions();
        } catch (error: unknown) {
          const msg = error instanceof Error ? error.message : '回滚失败';
          message.error(msg);
        }
      },
    });
  };

  // Handle set baseline
  const handleSetBaseline = async (version: PipelineVersion) => {
    try {
      await pipelineVersionsApi.setBaseline(pipelineId!, version.id, !version.is_baseline);
      message.success(version.is_baseline ? '已取消基线' : '已设为基线');
      loadVersions();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '操作失败';
      message.error(msg);
    }
  };

  // Handle version diff
  const handleDiff = async () => {
    if (selectedRowKeys.length !== 2) {
      message.warning('请选择两个版本进行对比');
      return;
    }
    try {
      const diff = await pipelineVersionsApi.diff(
        pipelineId!,
        selectedRowKeys[0] as string,
        selectedRowKeys[1] as string
      );
      // Navigate to diff view (or open modal)
      message.info(`版本对比: ${diff.summary}`);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '版本对比失败';
      message.error(msg);
    }
  };

  const columns: TableColumn<PipelineVersion>[] = [
    {
      key: 'version',
      title: '版本',
      dataIndex: 'version',
      width: 100,
      render: (v: number) => (
        <Tag color="blue" style={{ fontFamily: 'monospace' }}>
          v{v}
        </Tag>
      ),
    },
    {
      key: 'change_summary',
      title: '变更摘要',
      dataIndex: 'change_summary',
      ellipsis: true,
      render: (summary: string | null) => summary || <Text type="secondary">无</Text>,
    },
    {
      key: 'tags',
      title: '标签',
      dataIndex: 'tags',
      width: 180,
      render: (tags: string[]) => (
        <Space wrap>
          {tags.map((t) => (
            <Tag key={t} color="default">
              {t}
            </Tag>
          ))}
        </Space>
      ),
    },
    {
      key: 'is_baseline',
      title: '基线',
      dataIndex: 'is_baseline',
      width: 80,
      render: (isBaseline: boolean) =>
        isBaseline ? <StatusBadge status="success" size="small" label="基线" /> : '-',
    },
    {
      key: 'created_at',
      title: '创建时间',
      dataIndex: 'created_at',
      width: 180,
      sortable: true,
      render: (date: string) => (
        <Text type="secondary" style={{ fontSize: spacing[3] }}>
          {dayjs(date).fromNow()}
        </Text>
      ),
    },
    {
      key: 'created_by',
      title: '创建人',
      dataIndex: 'created_by',
      width: 120,
      render: (by: string | null) => <Text code>{by || '-'}</Text>,
    },
    {
      key: 'actions',
      title: '操作',
      width: 200,
      render: (_, record) => (
        <Space size="small">
          <Button type="link" size="small" onClick={() => handleRollback(record)}>
            回滚
          </Button>
          <Button type="link" size="small" onClick={() => handleSetBaseline(record)}>
            {record.is_baseline ? '取消基线' : '设为基线'}
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 0 }}>
      {/* Page header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: spacing.lg,
        }}
      >
        <div>
          <Title level={3} style={{ margin: 0 }}>
            版本历史
          </Title>
          <Text type="secondary">
            共 {versions.length} 个版本
            {selectedRowKeys.length === 2 && ' (已选 2 个版本)'}
          </Text>
        </div>
        <Space>
          <Button icon={<SwapOutlined />} onClick={handleDiff} disabled={selectedRowKeys.length !== 2}>
            版本对比
          </Button>
          <Button icon={<ReloadOutlined />} onClick={loadVersions} loading={loading}>
            刷新
          </Button>
        </Space>
      </div>

      {/* Version table */}
      <CardPanel>
        <Table
          columns={columns}
          dataSource={versions}
          loading={loading}
          rowKey="id"
          size="middle"
          striped
          rowSelection={{
            type: 'checkbox',
            maxSelectedRows: 2,
            selectedRowKeys,
            onChange: (keys) => setSelectedRowKeys(keys),
          }}
        />
      </CardPanel>
    </div>
  );
};

export default PipelineVersionHistory;
```

- [ ] **Step 2: 验证编译**

运行:
```bash
cd orion-frontend && npx tsc --noEmit --pretty 2>&1 | head -20
```
预期: 无错误。如有类型错误,修复后重试。

- [ ] **Step 3: 编写测试**

```tsx
// orion-frontend/src/pages/pipeline-svc/PipelineVersionHistory/__tests__/index.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import PipelineVersionHistory from '../index';
import { pipelineVersionsApi } from '@/api/pipeline-versions';

jest.mock('@/api/pipeline-versions', () => ({
  pipelineVersionsApi: {
    list: jest.fn(),
    rollback: jest.fn(),
    setBaseline: jest.fn(),
    diff: jest.fn(),
  },
}));

const mockVersions = [
  {
    id: 'v1',
    pipeline_id: 'p1',
    version: 1,
    yaml_definition: '...',
    spec: {},
    change_summary: 'Initial version',
    tags: ['release'],
    is_baseline: true,
    parent_version_id: null,
    created_by: 'admin',
    created_at: '2026-05-20T10:00:00Z',
  },
];

const renderWithRouter = (pipelineId: string) =>
  render(
    <MemoryRouter initialEntries={[`/pipelines/${pipelineId}/versions`]}>
      <Routes>
        <Route path="/pipelines/:pipelineId/versions" element={<PipelineVersionHistory />} />
      </Routes>
    </MemoryRouter>
  );

describe('PipelineVersionHistory', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders page title in Chinese', async () => {
    (pipelineVersionsApi.list as jest.Mock).mockResolvedValue({ data: mockVersions });
    renderWithRouter('p1');
    await waitFor(() => {
      expect(screen.getByText('版本历史')).toBeInTheDocument();
    });
  });

  it('displays version tags correctly', async () => {
    (pipelineVersionsApi.list as jest.Mock).mockResolvedValue({ data: mockVersions });
    renderWithRouter('p1');
    await waitFor(() => {
      expect(screen.getByText('v1')).toBeInTheDocument();
      expect(screen.getByText('release')).toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 4: 运行测试验证**

```bash
cd orion-frontend && npx vitest run src/pages/pipeline-svc/PipelineVersionHistory/__tests__/index.test.tsx
```
预期: 全部 PASS

- [ ] **Step 5: Commit**

```bash
git add orion-frontend/src/pages/pipeline-svc/PipelineVersionHistory/
git commit -m "style(pipeline): unify VersionHistory page with Design Tokens and Chinese UI"
```

---

### Task 2: 微调 PipelineList 样式一致性

**Files:**
- 修改: `orion-frontend/src/pages/pipeline-svc/PipelineList/index.tsx`

- [ ] **Step 1: 添加 Empty 空状态**

PipelineList 当过滤后无数据时应显示 Empty 组件。在 Table 下方添加空状态处理,替换默认的空白展示:

```tsx
// 在 Table 渲染后添加 Empty 状态(如果 Table 本身不支持 emptyText 自定义)
// 确认 Table 组件是否已支持 emptyText prop,若不支持则添加:
{filteredPipelines.length === 0 && !loading && (
  <div style={{ textAlign: 'center', padding: spacing.xxl }}>
    <Empty
      description="暂无匹配的 Pipeline"
      image={Empty.PRESENTED_IMAGE_SIMPLE}
    >
      <Button type="primary" onClick={() => navigate('/pipelines/new')}>
        创建 Pipeline
      </Button>
    </Empty>
  </div>
)}
```

- [ ] **Step 2: 统一操作列宽度**

确保操作列使用固定宽度 `200` (与其他页面一致),而非百分比:

```tsx
// 修改操作列定义
{
  key: 'actions',
  title: '操作',
  width: 200,  // 从 '16%' 改为 200
  render: (_: unknown, record) => (
    ...
```

- [ ] **Step 3: Commit**

```bash
git add orion-frontend/src/pages/pipeline-svc/PipelineList/index.tsx
git commit -m "style(pipeline): add empty state and unify action column width in PipelineList"
```

---

### Task 3: 微调 PipelineDetail 样式

**Files:**
- 修改: `orion-frontend/src/pages/pipeline-svc/PipelineDetail/index.tsx`

- [ ] **Step 1: 修复 TaskOutputsTable mock 数据提示**

移除页面上的 "当前为演示数据" 提示文字,替换为正式的空状态或 TODO 标记:

```tsx
// 修改 outputs tab 内容
<CardPanel title="任务输出与变量传播">
  <Empty
    description="任务输出变量传播功能即将上线"
    image={Empty.PRESENTED_IMAGE_SIMPLE}
  />
</CardPanel>
```

- [ ] **Step 2: 统一 Descriptions 样式**

确保 Descriptions 的 border 和 label 样式与其他页面一致:

```tsx
// 确认 Descriptions 使用统一样式
<Descriptions column={4} size="small" bordered labelStyle={{ width: 120 }}>
```
保持不变,已符合规范。

- [ ] **Step 3: Commit**

```bash
git add orion-frontend/src/pages/pipeline-svc/PipelineDetail/index.tsx
git commit -m "style(pipeline): replace mock data notice with empty state in PipelineDetail"
```

---

### Task 4: 微调 PipelineEditor 样式

**Files:**
- 修改: `orion-frontend/src/pages/pipeline-svc/PipelineEditor/index.tsx`

- [ ] **Step 1: 统一基本信息表单布局**

确保基本信息 Card 使用统一内边距和布局:

```tsx
// 修改 Card 样式,确保与其他页面一致
<Card style={{ marginBottom: spacing.md }} title="基本信息">
```

- [ ] **Step 2: 移除 maxWidth 限制**

Editor 页面当前有 `maxWidth: 1200, margin: '0 auto'`,这与其他页面不一致。移除这些限制,使用全宽:

```tsx
// 修改容器 style
<div style={{ padding: 0 }}>  // 移除 maxWidth: 1200, margin: '0 auto'
```

- [ ] **Step 3: Commit**

```bash
git add orion-frontend/src/pages/pipeline-svc/PipelineEditor/index.tsx
git commit -m "style(pipeline): remove maxWidth constraint and unify spacing in PipelineEditor"
```

---

### Task 5: 微调 PipelineRunList 样式

**Files:**
- 修改: `orion-frontend/src/pages/pipeline-svc/PipelineRunList/index.tsx`

- [ ] **Step 1: 确保与 PipelineList 一致的操作列**

PipelineRunList 的操作列应保持与 PipelineList 相同的宽度:

```tsx
// 操作列定义
{
  key: 'actions',
  title: '操作',
  width: 200,  // 从 120 改为 200,与列表页一致
  ...
}
```

- [ ] **Step 2: Commit**

```bash
git add orion-frontend/src/pages/pipeline-svc/PipelineRunList/index.tsx
git commit -m "style(pipeline): unify action column width in PipelineRunList"
```

---

### Task 6: 验证所有页面编译通过

**Files:** 无修改

- [ ] **Step 1: TypeScript 类型检查**

```bash
cd orion-frontend && npx tsc --noEmit --pretty
```
预期: 无新增错误。如有类型错误,逐个修复。

- [ ] **Step 2: 运行所有 Pipeline 相关测试**

```bash
cd orion-frontend && npx vitest run src/pages/pipeline-svc/
```
预期: 全部 PASS。

- [ ] **Step 3: 最终 Commit (如果有遗漏)**

```bash
git status
# 如果有未提交的文件,补充提交
```
