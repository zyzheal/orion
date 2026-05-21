# Orion Pipeline 模块全栈升级实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 Pipeline 模块从当前 60% 前端覆盖升级到完整可用状态，包括 Canvas 可视化编辑器打通、StageModal 增强（超时/审批/质量门禁）、CRUD 完整性修复、运行监控面板、取消/重试能力补全。

**Architecture:** 渐进式 Phase 1 实施，共 6 个 Task。复用已有的 ReactFlow PipelineCanvas 实现，通过代理导入打通编辑器；增强 StageModal 新增 3 个配置 Tab；修复 PipelineRunList 操作按钮；新增 PipelineMonitor 监控页面。

**Tech Stack:** React + TypeScript + Ant Design + ReactFlow + Design Token + Dnd-kit

> **注：** 本计划覆盖 Phase 1（可视化与交互补全）。Phase 2/3 待 Phase 1 完成后另行制定计划。

**设计文档：** `docs/superpowers/specs/2026-05-21-pipeline-module-upgrade-design.md`

---

## 文件映射总览

| 文件 | 操作 | Task |
|------|------|------|
| `orion-frontend/src/pages/pipeline-svc/PipelineEditor/canvas.tsx` | 重写（代理导入） | Task 1 |
| `orion-frontend/src/pages/pipeline-svc/pipeline-editor/canvas/StageNode.tsx` | 增强（状态标识） | Task 1 |
| `orion-frontend/src/pages/pipeline-svc/PipelineEditor/StageModal.tsx` | 增强（3 个新 Tab） | Task 2 |
| `orion-frontend/src/pages/pipeline-svc/PipelineEditor/types.ts` | 新增接口定义 | Task 2 |
| `orion-frontend/src/pages/pipeline-svc/PipelineList/index.tsx` | 微调（操作列宽度） | Task 3 |
| `orion-frontend/src/pages/pipeline-svc/PipelineRunList/index.tsx` | 增强（取消/从阶段重试） | Task 4 |
| `orion-frontend/src/pages/pipeline-svc/PipelineRunList/StageSelectorModal.tsx` | 新增组件 | Task 4 |
| `orion-frontend/src/pages/pipeline-svc/PipelineMonitor/index.tsx` | 新增页面 | Task 5 |
| `orion-frontend/src/pages/pipeline-svc/PipelineMonitor/api.ts` | 新增 API 封装 | Task 5 |
| `orion-frontend/src/router/routes.tsx` | 新增路由 | Task 5 |
| `orion-frontend/src/api/pipelineRuns.ts` | 确认 API（已有 cancel） | Task 4 |

---

### Task 1: PipelineCanvas 打通

**Files:**
- Modify: `orion-frontend/src/pages/pipeline-svc/PipelineEditor/canvas.tsx` (重写为代理导入)
- Modify: `orion-frontend/src/pages/pipeline-svc/pipeline-editor/canvas/StageNode.tsx` (增强状态标识)
- Verify: `orion-frontend/src/pages/pipeline-svc/PipelineEditor/index.tsx` (已引用 `{ PipelineCanvas } from './canvas'`)

- [ ] **Step 1: 验证 Canvas stub 和真实实现**

确认 `canvas.tsx` 当前是存根（仅显示文字），真实实现在 `pipeline-editor/canvas/PipelineCanvas.tsx`。

运行: `cd orion-frontend && grep -c "ReactFlow" src/pages/pipeline-svc/PipelineEditor/canvas.tsx`
Expected: `0`（存根不含 ReactFlow）

运行: `cd orion-frontend && grep -c "ReactFlow" src/pages/pipeline-svc/pipeline-editor/canvas/PipelineCanvas.tsx`
Expected: `>0`（真实实现包含 ReactFlow）

- [ ] **Step 2: 重写 canvas.tsx 为代理导入**

```typescript
/**
 * PipelineCanvas - 代理导入
 * 指向 pipeline-editor/canvas/PipelineCanvas.tsx 的完整 ReactFlow 实现
 */
export { default as PipelineCanvas } from '../pipeline-editor/canvas/PipelineCanvas';
export type { StageNodeData } from '../pipeline-editor/canvas/PipelineCanvas';
```

- [ ] **Step 3: 验证 PipelineEditor 引用**

确认 `PipelineEditor/index.tsx` 已正确引用：
```typescript
import { PipelineCanvas } from './canvas';
```

运行: `cd orion-frontend && grep "PipelineCanvas" src/pages/pipeline-svc/PipelineEditor/index.tsx`
Expected: 找到 `import { PipelineCanvas } from './canvas'` 和使用处

- [ ] **Step 4: 增强 StageNode 状态标识**

读取 `pipeline-editor/canvas/StageNode.tsx`，在现有节点上增加 props 和视觉标识：

```typescript
// StageNode 新增 props
interface StageNodeExtraProps {
  hasApproval?: boolean;
  timeout?: number;
  hasQualityGate?: boolean;
  status?: 'success' | 'failed' | 'running' | 'pending';
}

// 在节点内部增加标识区域（节点底部）
<div className="stage-node-indicators" style={{
  display: 'flex',
  gap: 4,
  marginTop: 6,
  justifyContent: 'center',
  flexWrap: 'wrap',
}}>
  {hasApproval && (
    <span style={{
      fontSize: 10,
      padding: '1px 4px',
      borderRadius: 3,
      background: '#7C5CFC14',
      color: '#7C5CFC',
    }}>审批</span>
  )}
  {timeout && (
    <span style={{
      fontSize: 10,
      padding: '1px 4px',
      borderRadius: 3,
      background: '#faad1414',
      color: '#faad14',
    }}>{timeout}s</span>
  )}
  {hasQualityGate && (
    <span style={{
      fontSize: 10,
      padding: '1px 4px',
      borderRadius: 3,
      background: '#52c41a14',
      color: '#52c41a',
    }}>门禁</span>
  )}
</div>
```

- [ ] **Step 5: 更新 PipelineCanvas 传递新增 props 到 StageNode**

在 `PipelineCanvas.tsx` 的节点数据构建中，从 stage.config 提取超时/审批/门禁信息：

```typescript
// 在 useEffect 内 nodes 构建的 data 部分增加：
data: {
  label: stage.name,
  stageType: stage.type,
  status: stage.config?.status as string | undefined,
  config: stage.config,
  index,
  // 新增
  hasApproval: !!stage.config?.approval?.enabled,
  timeout: stage.config?.timeout?.enabled ? stage.config?.timeout?.duration : undefined,
  hasQualityGate: !!stage.config?.qualityGate?.enabled,
},
```

- [ ] **Step 6: TypeScript 编译验证**

运行: `cd orion-frontend && npx tsc --noEmit 2>&1 | grep -i "pipeline" | head -20`
Expected: 无新增 Pipeline 相关错误

- [ ] **Step 7: Commit**

```bash
git add orion-frontend/src/pages/pipeline-svc/PipelineEditor/canvas.tsx
git add orion-frontend/src/pages/pipeline-svc/pipeline-editor/canvas/StageNode.tsx
git add orion-frontend/src/pages/pipeline-svc/pipeline-editor/canvas/PipelineCanvas.tsx
git commit -m "feat(pipeline): connect PipelineCanvas to ReactFlow implementation

Replace stub canvas.tsx with proxy import to the existing ReactFlow
PipelineCanvas implementation. Enhance StageNode with approval/timeout/
quality gate indicators.

Phase 1, Task 1 of pipeline module upgrade."
```

---

### Task 2: StageModal 增强（超时/审批/质量门禁 Tab）

**Files:**
- Modify: `orion-frontend/src/pages/pipeline-svc/PipelineEditor/StageModal.tsx`
- Modify: `orion-frontend/src/pages/pipeline-svc/PipelineEditor/types.ts`（如不存在则创建）
- Test: `orion-frontend/src/pages/pipeline-svc/PipelineEditor/__tests__/StageModal.test.tsx`

- [ ] **Step 1: 定义新增配置接口**

创建或修改 `types.ts`：

```typescript
/** 超时配置 */
export interface TimeoutConfig {
  enabled: boolean;
  duration: number;           // 超时时间（秒）
  action: 'fail' | 'skip' | 'retry';  // 超时动作
  retryCount?: number;        // action='retry' 时的重试次数
}

/** 审批卡点配置 */
export interface ApprovalConfig {
  enabled: boolean;
  approvers: string[];        // 审批人列表（用户 ID 或角色名）
  mode: 'unanimous' | 'any';  // 会签 / 或签
  timeout: number;            // 审批超时（秒），0 表示不超时
  timeoutAction: 'approve' | 'reject';  // 超时自动处理
}

/** 质量门禁规则 */
export interface QualityGateRule {
  id: string;
  metric: 'test_pass_rate' | 'coverage' | 'vulnerability_count' | 'custom';
  operator: '>' | '<' | '>=' | '<=' | '==';
  threshold: number;
}

/** 质量门禁配置 */
export interface QualityGateConfig {
  enabled: boolean;
  rules: QualityGateRule[];
  failureAction: 'block' | 'warn' | 'continue';
}
```

更新 `StageConfig` 接口（在 `types.ts` 或 `index.tsx` 中）：

```typescript
export interface StageConfig {
  // ... 已有字段
  timeoutConfig?: TimeoutConfig;
  approvalConfig?: ApprovalConfig;
  qualityGateConfig?: QualityGateConfig;
}
```

- [ ] **Step 2: 编写 StageModal 新 Tab 测试**

```typescript
// orion-frontend/src/pages/pipeline-svc/PipelineEditor/__tests__/StageModal.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import StageModal from '../StageModal';
import type { StageConfig } from '../types';

const defaultProps = {
  visible: true,
  stage: null as StageConfig | null,
  availableDependencies: [],
  onSave: jest.fn(),
  onCancel: jest.fn(),
};

describe('StageModal - New Tabs', () => {
  it('renders timeout config tab', () => {
    render(<StageModal {...defaultProps} />);
    // 点击"超时配置" Tab
    const tab = screen.getByText(/超时配置/);
    expect(tab).toBeInTheDocument();
    fireEvent.click(tab);
    // 验证开关存在
    expect(screen.getByText(/启用阶段超时/)).toBeInTheDocument();
  });

  it('renders approval config tab', () => {
    render(<StageModal {...defaultProps} />);
    const tab = screen.getByText(/审批卡点/);
    expect(tab).toBeInTheDocument();
  });

  it('renders quality gate config tab', () => {
    render(<StageModal {...defaultProps} />);
    const tab = screen.getByText(/质量门禁/);
    expect(tab).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: 运行测试确认失败**

运行: `cd orion-frontend && npx vitest run src/pages/pipeline-svc/PipelineEditor/__tests__/StageModal.test.tsx`
Expected: FAIL（Tab 尚不存在）

- [ ] **Step 4: 在 StageModal 中新增 3 个 Tab**

读取现有 StageModal 的 Tabs 结构，在现有 Tabs 后新增 3 个：

```typescript
// StageModal Tabs 部分（示意结构，保留已有 Tab）
<Tabs
  items={[
    // ... 已有 Tab（基础配置、依赖配置、重试策略、缓存配置、制品配置、高级配置）
    {
      key: 'timeout',
      label: (
        <span>
          <ThunderboltOutlined />
          超时配置
        </span>
      ),
      children: renderTimeoutConfig(),
    },
    {
      key: 'approval',
      label: (
        <span>
          <UserOutlined />
          审批卡点
        </span>
      ),
      children: renderApprovalConfig(),
    },
    {
      key: 'qualityGate',
      label: (
        <span>
          <SafetyOutlined />
          质量门禁
        </span>
      ),
      children: renderQualityGateConfig(),
    },
  ]}
/>
```

需要新增 import：
```typescript
import { UserOutlined, SafetyOutlined } from '@ant-design/icons';
```

- [ ] **Step 5: 实现超时配置 Tab 渲染**

```typescript
const renderTimeoutConfig = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.md }}>
    <Form.Item label="启用阶段超时" name={['timeoutConfig', 'enabled']} valuePropName="checked">
      <Switch />
    </Form.Item>

    <Form.Item label="超时时间（秒）" name={['timeoutConfig', 'duration']}>
      <InputNumber min={1} max={86400} style={{ width: '100%' }} placeholder="300" />
    </Form.Item>

    <Form.Item label="超时动作" name={['timeoutConfig', 'action']}>
      <Select>
        <Select.Option value="fail">标记为失败</Select.Option>
        <Select.Option value="skip">跳过并继续</Select.Option>
        <Select.Option value="retry">自动重试</Select.Option>
      </Select>
    </Form.Item>

    <Form.Item noStyle shouldUpdate={(prev, curr) => prev.timeoutConfig?.action !== curr.timeoutConfig?.action}>
      {({ getFieldValue }) =>
        getFieldValue(['timeoutConfig', 'action']) === 'retry' && (
          <Form.Item label="重试次数" name={['timeoutConfig', 'retryCount']}>
            <InputNumber min={1} max={10} style={{ width: '100%' }} placeholder="3" />
          </Form.Item>
        )
      }
    </Form.Item>
  </div>
);
```

- [ ] **Step 6: 实现审批卡点 Tab 渲染**

```typescript
const renderApprovalConfig = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.md }}>
    <Form.Item label="启用审批卡点" name={['approvalConfig', 'enabled']} valuePropName="checked">
      <Switch />
    </Form.Item>

    <Form.Item label="审批人" name={['approvalConfig', 'approvers']}>
      <Select mode="multiple" placeholder="选择审批人（用户或角色）" allowClear>
        {/* 实际项目中应从用户 API 动态加载 */}
        <Select.Option value="admin">Admin</Select.Option>
        <Select.Option value="tech-lead">Tech Lead</Select.Option>
        <Select.Option value="team-lead">Team Lead</Select.Option>
      </Select>
    </Form.Item>

    <Form.Item label="审批模式" name={['approvalConfig', 'mode']}>
      <Select>
        <Select.Option value="unanimous">会签（全部通过）</Select.Option>
        <Select.Option value="any">或签（任一通过）</Select.Option>
      </Select>
    </Form.Item>

    <Form.Item label="审批超时（秒）" name={['approvalConfig', 'timeout']}>
      <InputNumber min={0} max={604800} style={{ width: '100%' }} placeholder="0 表示不超时" />
    </Form.Item>

    <Form.Item label="超时自动处理" name={['approvalConfig', 'timeoutAction']}>
      <Select>
        <Select.Option value="approve">自动通过</Select.Option>
        <Select.Option value="reject">自动拒绝</Select.Option>
      </Select>
    </Form.Item>
  </div>
);
```

- [ ] **Step 7: 实现质量门禁 Tab 渲染**

```typescript
const renderQualityGateConfig = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.md }}>
    <Form.Item label="启用质量门禁" name={['qualityGateConfig', 'enabled']} valuePropName="checked">
      <Switch />
    </Form.Item>

    <Form.Item label="不通过时" name={['qualityGateConfig', 'failureAction']}>
      <Select>
        <Select.Option value="block">阻止部署</Select.Option>
        <Select.Option value="warn">仅告警，继续执行</Select.Option>
        <Select.Option value="continue">忽略</Select.Option>
      </Select>
    </Form.Item>

    <div>
      <div style={{ marginBottom: spacing.sm, fontWeight: 500 }}>门禁规则</div>
      <Form.List name={['qualityGateConfig', 'rules']}>
        {(fields, { add, remove }) => (
          <>
            {fields.map(({ key, name, ...restField }) => (
              <Space key={key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                <Form.Item {...restField} name={[name, 'metric']} style={{ width: 160 }}>
                  <Select placeholder="指标">
                    <Select.Option value="test_pass_rate">测试通过率</Select.Option>
                    <Select.Option value="coverage">代码覆盖率</Select.Option>
                    <Select.Option value="vulnerability_count">漏洞数量</Select.Option>
                    <Select.Option value="custom">自定义</Select.Option>
                  </Select>
                </Form.Item>
                <Form.Item {...restField} name={[name, 'operator']} style={{ width: 80 }}>
                  <Select>
                    <Select.Option value=">=">≥</Select.Option>
                    <Select.Option value="<=">≤</Select.Option>
                    <Select.Option value=">">&gt;</Select.Option>
                    <Select.Option value="<">&lt;</Select.Option>
                    <Select.Option value="==">==</Select.Option>
                  </Select>
                </Form.Item>
                <Form.Item {...restField} name={[name, 'threshold']} style={{ width: 100 }}>
                  <InputNumber placeholder="阈值" />
                </Form.Item>
                <DeleteOutlined onClick={() => remove(name)} style={{ color: colors.error[500], cursor: 'pointer' }} />
              </Space>
            ))}
            <Button type="dashed" onClick={() => add({ id: `rule-${Date.now()}`, metric: 'test_pass_rate', operator: '>=', threshold: 95 })} block icon={<PlusOutlined />}>
              添加规则
            </Button>
          </>
        )}
      </Form.List>
    </div>
  </div>
);
```

- [ ] **Step 8: 更新 form  initialValues 和 onSave 回调**

在 `useEffect` 中（当 stage 变化时填充 form），新增 3 个字段的默认值：

```typescript
form.setFieldsValue({
  // ... 已有字段
  timeoutConfig: stage?.timeoutConfig || { enabled: false, duration: 300, action: 'fail' as const },
  approvalConfig: stage?.approvalConfig || { enabled: false, approvers: [], mode: 'unanimous' as const, timeout: 0, timeoutAction: 'reject' as const },
  qualityGateConfig: stage?.qualityGateConfig || { enabled: false, rules: [], failureAction: 'block' as const },
});
```

在 `onSave` 的 `form.validateFields()` 后，确保新字段被包含在返回的 StageConfig 中（Form.List 会自动收集）。

- [ ] **Step 9: 运行测试确认通过**

运行: `cd orion-frontend && npx vitest run src/pages/pipeline-svc/PipelineEditor/__tests__/StageModal.test.tsx`
Expected: PASS（3 个 Tab 均可渲染）

- [ ] **Step 10: TypeScript 编译验证**

运行: `cd orion-frontend && npx tsc --noEmit 2>&1 | grep -i "StageModal\|StageModal\|types" | head -10`
Expected: 无新增错误

- [ ] **Step 11: Commit**

```bash
git add orion-frontend/src/pages/pipeline-svc/PipelineEditor/types.ts
git add orion-frontend/src/pages/pipeline-svc/PipelineEditor/StageModal.tsx
git add orion-frontend/src/pages/pipeline-svc/PipelineEditor/__tests__/StageModal.test.tsx
git commit -m "feat(pipeline): add timeout, approval, quality gate tabs to StageModal

Add 3 new configuration tabs to the Stage configuration modal:
- Timeout Config: enable/disable, duration, action (fail/skip/retry)
- Approval Gate: approvers, mode (unanimous/any), timeout handling
- Quality Gate: rules with metric/operator/threshold, failure action

Phase 1, Task 2 of pipeline module upgrade."
```

---

### Task 3: PipelineList 操作列验证与微调

**Files:**
- Verify: `orion-frontend/src/pages/pipeline-svc/PipelineList/index.tsx`

- [ ] **Step 1: 验证 PipelineList 已有编辑入口**

读取 `PipelineList/index.tsx` 操作列部分。

运行: `cd orion-frontend && grep -A 30 "key: 'actions'" src/pages/pipeline-svc/PipelineList/index.tsx`

确认操作列包含以下按钮：
- 查看 → `navigate(/pipelines/${record.id})`
- 编辑 → `navigate(/pipelines/${record.id}/edit)`
- 运行 → `handleRun(record)`
- 运行记录 → `navigate(/pipelines/${record.id}/runs)`
- 删除 → Popconfirm + handleDelete

- [ ] **Step 2: 确认操作列宽度足够**

检查 `width` 是否 ≥ 280（5 个 link 按钮需要足够空间）。如果 width < 280，修改为 280。

```typescript
// 如果 width 不是 280+
{
  key: 'actions',
  title: '操作',
  width: 280,  // 确保至少 280
  render: ...
}
```

- [ ] **Step 3: 确认路由对应关系**

验证 `/pipelines/:id/edit` 路由在 `router/routes.tsx` 中存在并指向 PipelineEditor。

运行: `cd orion-frontend && grep -i "pipeline.*edit\|PipelineEditor" src/router/routes.tsx | head -5`
Expected: 找到 PipelineEditor 路由

- [ ] **Step 4: Commit（如有修改）**

```bash
git add orion-frontend/src/pages/pipeline-svc/PipelineList/index.tsx
git commit -m "fix(pipeline): ensure PipelineList actions column has sufficient width

Phase 1, Task 3 of pipeline module upgrade."
```

如无修改（已满足要求），跳过 commit。

---

### Task 4: PipelineRunList 取消/重试能力补全

**Files:**
- Modify: `orion-frontend/src/pages/pipeline-svc/PipelineRunList/index.tsx`
- Create: `orion-frontend/src/pages/pipeline-svc/PipelineRunList/StageSelectorModal.tsx`
- Verify: `orion-frontend/src/api/pipelineRuns.ts`（已有 cancelPipelineRun, retryFromStage）

- [ ] **Step 1: 确认 API 能力**

`pipelineRuns.ts` 已有：
- `cancelPipelineRun(runId: string)` → POST /v1/pipeline-runs/:id/cancel
- `retryPipelineRun(runId: string)` → POST /v1/pipeline-runs/:id/retry
- `retryFromStage(runId: string, stageId: string)` → POST /v1/pipeline-runs/:id/retry?fromStage=stageId

无需新增 API。

- [ ] **Step 2: 增强操作列**

当前操作列仅对 failed 状态显示"重跑"按钮。需要：
1. 对 running 状态增加"取消"按钮
2. 对 failed/cancelled 状态的"重跑"改为下拉菜单（完整重试/从阶段重试）

修改 actions 列 render：

```typescript
// 新增 import
import { Popconfirm, Dropdown } from 'antd';
import { CancelOutlined } from '@ant-design/icons';
import { cancelPipelineRun } from '@/api/pipelineRuns';

// 组件内新增 state
const [cancellingIds, setCancellingIds] = useState<Set<string>>(new Set());
const [stageRetryModal, setStageRetryModal] = useState<{ visible: boolean; runId: string }>({
  visible: false,
  runId: '',
});

// actions 列 render 改为：
render: (_: unknown, record) => (
  <Space size="small">
    <Button
      type="link"
      size="small"
      onClick={() => navigate(`/pipelines/runs/${record.id}`)}
    >
      查看日志
    </Button>
    {record.status === 'running' && (
      <Popconfirm
        title="确认取消该运行？"
        onConfirm={async () => {
          setCancellingIds((prev) => new Set(prev).add(record.id));
          try {
            await cancelPipelineRun(record.id);
            message.success('运行已取消');
            await loadRuns();
          } catch (error: unknown) {
            if (error instanceof Error) {
              message.error(`取消失败：${error.message}`);
            }
          } finally {
            setCancellingIds((prev) => {
              const next = new Set(prev);
              next.delete(record.id);
              return next;
            });
          }
        }}
      >
        <Button type="link" size="small" danger loading={cancellingIds.has(record.id)}>
          取消
        </Button>
      </Popconfirm>
    )}
    {(record.status === 'failed' || record.status === 'cancelled') && (
      <Dropdown
        menu={{
          items: [
            {
              key: 'full',
              label: '完整重试',
              onClick: () => handleRetry(record.id),
            },
            {
              key: 'from-stage',
              label: '从阶段重试',
              onClick: () => setStageRetryModal({ visible: true, runId: record.id }),
            },
          ],
        }}
      >
        <Button type="link" size="small" danger>
          重试 ▾
        </Button>
      </Dropdown>
    )}
  </Space>
),
```

- [ ] **Step 3: 创建 StageSelectorModal 组件**

```typescript
/**
 * StageSelectorModal - 选择从哪个阶段开始重试
 */
import React, { useState } from 'react';
import { Modal, List, Radio, Button, message } from 'antd';
import { retryFromStage } from '@/api/pipelineRuns';

interface StageSelectorModalProps {
  visible: boolean;
  runId: string;
  stages: Array<{ id: string; name: string; status: string }>;
  onRetry: () => void;
  onCancel: () => void;
}

const StageSelectorModal: React.FC<StageSelectorModalProps> = ({
  visible,
  runId,
  stages,
  onRetry,
  onCancel,
}) => {
  const [selectedStage, setSelectedStage] = useState<string>('');
  const [onlyFailed, setOnlyFailed] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleRetry = async () => {
    if (!selectedStage) {
      message.warning('请选择一个阶段');
      return;
    }
    setLoading(true);
    try {
      await retryFromStage(runId, selectedStage);
      message.success('已从选中阶段开始重试');
      onRetry();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`重试失败：${error.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const failedStages = stages.filter((s) => s.status === 'failed' || s.status === 'running');

  return (
    <Modal
      title="从阶段重试"
      open={visible}
      onCancel={onCancel}
      footer={
        <>
          <Button onClick={onCancel}>取消</Button>
          <Button type="primary" loading={loading} disabled={!selectedStage} onClick={handleRetry}>
            开始重试
          </Button>
        </>
      }
    >
      <div style={{ marginBottom: 12 }}>
        <Radio.Group value={onlyFailed} onChange={(e) => setOnlyFailed(e.target.value)}>
          <Radio value={false}>全部阶段</Radio>
          <Radio value={true}>仅失败阶段 ({failedStages.length})</Radio>
        </Radio.Group>
      </div>
      <List
        size="small"
        dataSource={onlyFailed ? failedStages : stages}
        renderItem={(stage) => (
          <List.Item
            style={{
              cursor: 'pointer',
              background: selectedStage === stage.id ? '#EBF0FB' : 'transparent',
            }}
            onClick={() => setSelectedStage(stage.id)}
          >
            <Radio checked={selectedStage === stage.id} onChange={() => setSelectedStage(stage.id)} />
            <span style={{ marginLeft: 8 }}>{stage.name}</span>
            <span style={{ marginLeft: 'auto', fontSize: 12, color: '#999' }}>{stage.status}</span>
          </List.Item>
        )}
      />
    </Modal>
  );
};

export default StageSelectorModal;
```

- [ ] **Step 4: 在 PipelineRunList 中引用 StageSelectorModal**

```typescript
import StageSelectorModal from './StageSelectorModal';

// 在 JSX return 底部，现有内容之后：
<StageSelectorModal
  visible={stageRetryModal.visible}
  runId={stageRetryModal.runId}
  stages={[]}  // TODO: 从运行详情 API 获取阶段列表
  onRetry={() => {
    setStageRetryModal({ visible: false, runId: '' });
    loadRuns();
  }}
  onCancel={() => setStageRetryModal({ visible: false, runId: '' })}
/>
```

注意：stages 数据需要从运行详情 API 获取。如果当前没有该 API，可暂时传空数组并在 Modal 中展示提示"正在加载阶段列表..."，后续对接。

- [ ] **Step 5: TypeScript 编译验证**

运行: `cd orion-frontend && npx tsc --noEmit 2>&1 | grep -i "PipelineRunList\|StageSelector" | head -10`
Expected: 无新增错误

- [ ] **Step 6: Commit**

```bash
git add orion-frontend/src/pages/pipeline-svc/PipelineRunList/index.tsx
git add orion-frontend/src/pages/pipeline-svc/PipelineRunList/StageSelectorModal.tsx
git commit -m "feat(pipeline): add cancel and retry-from-stage to PipelineRunList

- Add cancel button for running pipeline runs with confirmation
- Change retry button to dropdown: full retry or retry from specific stage
- Add StageSelectorModal component for selecting retry start stage
- Uses existing cancelPipelineRun and retryFromStage APIs

Phase 1, Task 4 of pipeline module upgrade."
```

---

### Task 5: PipelineMonitor 运行监控面板

**Files:**
- Create: `orion-frontend/src/pages/pipeline-svc/PipelineMonitor/index.tsx`
- Create: `orion-frontend/src/pages/pipeline-svc/PipelineMonitor/api.ts`
- Modify: `orion-frontend/src/router/routes.tsx`（新增路由）

- [ ] **Step 1: 创建 API 封装**

```typescript
/**
 * PipelineMonitor API
 */
import api from '@/api/client';

export interface RunStats {
  totalRuns: number;
  successRate: number;
  avgDuration: number;
  failedCount: number;
}

export interface FailureMode {
  mode: string;
  count: number;
  percentage: number;
}

export interface StageFailureRank {
  stageName: string;
  failureCount: number;
}

export interface StagePerformance {
  stageName: string;
  avgDuration: number; // 秒
}

/**
 * 获取运行统计数据
 */
export function getRunStats(params?: { days?: number }): Promise<{ data: { data: RunStats } }> {
  return api.get('/v1/pipeline-runs/stats', { params });
}

/**
 * 获取 Pipeline 指标数据（SSE metrics 端点，首次请求返回快照）
 */
export function getPipelineMetrics(): Promise<{ data: { data: any[] } }> {
  return api.get('/v1/pipelines/sse/metrics');
}
```

- [ ] **Step 2: 创建 PipelineMonitor 页面**

```typescript
/**
 * PipelineMonitor - 运行监控面板
 * 展示 Pipeline 运行统计、失败分析、趋势图表、性能指标
 */
import React, { useState, useEffect } from 'react';
import { Card, Space, Select, Button, Empty, message, Statistic, Row, Col } from 'antd';
import { colors, spacing, componentSpacing } from '@/tokens';
import { ReloadOutlined, DashboardOutlined } from '@ant-design/icons';
import CardPanel from '@/components/CardPanel';
import { getRunStats, type RunStats } from './api';
import { getAllPipelineRuns } from '@/api/pipelineRuns';
import dayjs from 'dayjs';

const PipelineMonitor: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<RunStats | null>(null);
  const [days, setDays] = useState(7);
  const [failedRuns, setFailedRuns] = useState<any[]>([]);

  const loadData = async () => {
    setLoading(true);
    try {
      // 尝试从 API 获取统计数据
      try {
        const res = await getRunStats({ days });
        setStats(res.data.data);
      } catch {
        // 如果统计 API 不可用，从运行列表聚合
        const runsRes = await getAllPipelineRuns();
        const runs = runsRes.data.data?.items || runsRes.data.data || [];
        const recentRuns = runs.filter(
          (r: any) => dayjs().diff(dayjs(r.createdAt), 'day') <= days
        );
        const totalRuns = recentRuns.length;
        const successRuns = recentRuns.filter((r: any) => r.status === 'success').length;
        const failed = recentRuns.filter((r: any) => r.status === 'failed');
        setStats({
          totalRuns,
          successRate: totalRuns > 0 ? Math.round((successRuns / totalRuns) * 1000) / 10 : 0,
          avgDuration: 0, // TODO: 从 metrics 计算
          failedCount: failed.length,
        });
        setFailedRuns(failed);
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`加载监控数据失败：${error.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [days]);

  // 失败模式分析（前端聚合）
  const failureModes = React.useMemo(() => {
    const modes: Record<string, number> = {};
    failedRuns.forEach((run) => {
      const reason = run.failureReason || run.errorType || 'unknown';
      modes[reason] = (modes[reason] || 0) + 1;
    });
    const total = failedRuns.length || 1;
    return Object.entries(modes)
      .map(([mode, count]) => ({ mode, count, percentage: Math.round((count / total) * 100) }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [failedRuns]);

  // 失败阶段 Top 5（前端聚合）
  const failedStages = React.useMemo(() => {
    const stages: Record<string, number> = {};
    failedRuns.forEach((run) => {
      const stageName = run.failedStage || 'unknown';
      stages[stageName] = (stages[stageName] || 0) + 1;
    });
    return Object.entries(stages)
      .map(([stageName, failureCount]) => ({ stageName, failureCount }))
      .sort((a, b) => b.failureCount - a.failureCount)
      .slice(0, 5);
  }, [failedRuns]);

  return (
    <div style={{ padding: 0 }}>
      {/* Page header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: spacing.md }}>
        <div>
          <h2 style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
            <DashboardOutlined style={{ marginRight: 8, color: colors.primary[500] }} />
            运行监控
          </h2>
        </div>
        <Space>
          <Select
            value={days}
            onChange={setDays}
            style={{ width: 120 }}
            options={[
              { label: '近 7 天', value: 7 },
              { label: '近 30 天', value: 30 },
              { label: '近 90 天', value: 90 },
            ]}
          />
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
            刷新
          </Button>
        </Space>
      </div>

      {/* Stats cards */}
      <Row gutter={spacing.md} style={{ marginBottom: spacing.md }}>
        <Col span={6}>
          <CardPanel>
            <Statistic title="今日运行" value={stats?.totalRuns ?? 0} suffix="次" loading={loading} />
          </CardPanel>
        </Col>
        <Col span={6}>
          <CardPanel>
            <Statistic
              title="成功率"
              value={stats?.successRate ?? 0}
              suffix="%"
              valueStyle={{ color: (stats?.successRate ?? 0) >= 95 ? colors.success[500] : colors.warning[500] }}
              loading={loading}
            />
          </CardPanel>
        </Col>
        <Col span={6}>
          <CardPanel>
            <Statistic title="失败数" value={stats?.failedCount ?? 0} loading={loading} />
          </CardPanel>
        </Col>
        <Col span={6}>
          <CardPanel>
            <Statistic title="平均耗时" value={stats?.avgDuration ?? 0} suffix="s" loading={loading} />
          </CardPanel>
        </Col>
      </Row>

      {/* Failure analysis */}
      <Row gutter={spacing.md} style={{ marginBottom: spacing.md }}>
        <Col span={12}>
          <CardPanel title="失败模式分布">
            {failureModes.length === 0 ? (
              <Empty description="暂无失败数据" />
            ) : (
              <div>
                {failureModes.map((mode) => (
                  <div key={mode.mode} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span>{mode.mode}</span>
                    <span>
                      {mode.count} 次 ({mode.percentage}%)
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardPanel>
        </Col>
        <Col span={12}>
          <CardPanel title="失败阶段 Top 5">
            {failedStages.length === 0 ? (
              <Empty description="暂无失败数据" />
            ) : (
              <div>
                {failedStages.map((stage) => (
                  <div key={stage.stageName} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span>{stage.stageName}</span>
                    <span style={{ color: colors.error[500], fontWeight: 500 }}>{stage.failureCount}</span>
                  </div>
                ))}
              </div>
            )}
          </CardPanel>
        </Col>
      </Row>

      {/* Recent runs table */}
      <CardPanel title="最近运行">
        {failedRuns.length === 0 && (!stats || stats.totalRuns === 0) ? (
          <Empty description="暂无运行数据" />
        ) : (
          <div style={{ fontSize: spacing[3], color: colors.neutral[600] }}>
            共 {stats?.totalRuns ?? 0} 次运行，成功率 {(stats?.successRate ?? 0).toFixed(1)}%
          </div>
        )}
      </CardPanel>
    </div>
  );
};

export default PipelineMonitor;
```

- [ ] **Step 3: 新增路由**

在 `orion-frontend/src/router/routes.tsx` 中找到 Pipeline 相关路由组，新增：

```typescript
{
  path: '/pipelines/monitor',
  element: <PipelineMonitor />,
  meta: { title: '运行监控', icon: 'DashboardOutlined' },
},
```

并在文件顶部 import：
```typescript
import PipelineMonitor from '@/pages/pipeline-svc/PipelineMonitor';
```

- [ ] **Step 4: TypeScript 编译验证**

运行: `cd orion-frontend && npx tsc --noEmit 2>&1 | grep -i "PipelineMonitor" | head -10`
Expected: 无新增错误

- [ ] **Step 5: Commit**

```bash
git add orion-frontend/src/pages/pipeline-svc/PipelineMonitor/index.tsx
git add orion-frontend/src/pages/pipeline-svc/PipelineMonitor/api.ts
git add orion-frontend/src/router/routes.tsx
git commit -m "feat(pipeline): add PipelineMonitor dashboard for run analytics

New monitoring page showing:
- Stats cards: total runs, success rate, failure count, avg duration
- Failure mode distribution analysis
- Top 5 failing stages
- Recent runs summary
- Time range selector (7/30/90 days) with refresh

Phase 1, Task 5 of pipeline module upgrade."
```

---

### Task 6: Phase 1 整合验证

**Files:**
- All modified files from Tasks 1-5

- [ ] **Step 1: 全局 TypeScript 编译**

运行: `cd orion-frontend && npx tsc --noEmit 2>&1 | head -30`
Expected: 无 Pipeline 相关新增错误

- [ ] **Step 2: 运行已有 Pipeline 测试**

运行: `cd orion-frontend && npx vitest run --grep "pipeline\|Pipeline" 2>&1 | tail -20`
Expected: 已有测试通过，新增 StageModal 测试通过

- [ ] **Step 3: 开发服务器验证**

运行: `cd orion-frontend && npm run dev`
Expected: 启动成功，无编译错误

验证页面可访问：
- `/pipelines` - 列表页，操作列有编辑按钮
- `/pipelines/new` - 新建 Pipeline，Canvas 模式可切换为 ReactFlow 画布
- `/pipelines/edit/:id` - 编辑 Pipeline，StageModal 有超时/审批/门禁 Tab
- `/pipelines/runs` - 运行列表，running 状态有取消按钮，failed 有重试下拉菜单
- `/pipelines/monitor` - 运行监控面板

- [ ] **Step 4: Commit（如有额外修改）**

如有编译错误或问题修复，在此步骤修复后提交。

```bash
git add -A
git commit -m "fix(pipeline): phase 1 integration fixes

Phase 1, Task 6 of pipeline module upgrade."
```

---

## Phase 1 完成标准检查清单

完成以上 6 个 Task 后，逐项核对：

- [ ] PipelineCanvas 可作为编辑器主画布使用（ReactFlow 拖拽编辑）
- [ ] StageNode 显示审批/超时/门禁标识（当配置启用时）
- [ ] StageModal 新增 3 个 Tab（超时、审批、质量门禁）并正常工作
- [ ] PipelineList 有编辑入口，操作列按钮可点击
- [ ] PipelineRunList 有取消按钮（running 状态）和重试下拉菜单（failed/cancelled 状态）
- [ ] StageSelectorModal 可选择从哪个阶段开始重试
- [ ] PipelineMonitor 页面可展示统计数据
- [ ] TypeScript 编译无新增错误
- [ ] 新增测试覆盖率 ≥ 80%（StageModal 新 Tab 测试）
