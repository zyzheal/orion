# 工作流节点交互设计改进方案

> **状态**: Draft
> **日期**: 2026-05-21
> **作者**: AI Agent
> **涉及文件**: `orion-frontend/src/pages/WorkflowDesigner/WorkflowCanvas.tsx`

---

## 1. 问题分析

### 1.1 当前画布节点展示

画布上的节点卡片仅展示两项信息：

```
┌──────────────────┐
│ 审批节点          │  ← node.name，无省略号处理
│ [审批节点]        │  ← 类型 Tag，无配置预览
└──────────────────┘
   固定宽度 180px
```

**代码位置**：`WorkflowCanvas.tsx:255-279`

```tsx
{workflow.nodes?.map((node) => (
  <div
    key={node.id}
    onClick={() => handleNodeClick(node)}  // 唯一交互：点击打开 Drawer
    style={{
      position: 'absolute',
      left: node.position.x,
      top: node.position.y,
      width: 180,                          // 固定宽度
      minHeight: 80,
      background: selectedNode?.id === node.id ? colors.primary[50] : '#fff',
      borderRadius: 12,
      padding: '12px 16px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
      borderLeft: `3px solid ${nodeTypeColors[node.type] || colors.neutral[400]}`,
      cursor: 'pointer',
      transition: 'background 0.2s',
    }}
  >
    <div style={{ fontWeight: 500, marginBottom: 4, fontSize: 13 }}>{node.name}</div>
    <Tag color={nodeTypeColors[node.type]} style={{ fontSize: 10 }}>
      {nodeTypeLabels[node.type] || node.type}
    </Tag>
  </div>
))}
```

### 1.2 当前节点详情 Drawer

Drawer 展示字段：

| 字段 | 来源 | 交互状态 |
|------|------|---------|
| 节点 ID | `selectedNode.id` | 只读，技术信息，用户不需要 |
| 节点名称 | `selectedNode.name` | 只读文本，不可编辑 |
| 节点类型 | `selectedNode.type` | 只读 Tag |
| 位置 | `selectedNode.position` | 只读，技术信息 |
| config | `Object.entries(node.config)` | JSON 平铺展示，不可编辑 |
| 上游节点 | 通过 edges 查找 | 只读 |
| 下游节点 | 通过 edges 查找 | 只读 |

**代码位置**：`WorkflowCanvas.tsx:289-354`

**Drawer 底部无任何操作按钮**（无编辑、无保存、无关闭确认）。

### 1.3 核心问题清单

| 编号 | 问题 | 严重程度 | 说明 |
|------|------|---------|------|
| P1 | **名称溢出截断** | 高 | 固定 180px 宽度，名称过长无省略号处理，用户无法识别节点 |
| P2 | **无配置预览** | 高 | 审批节点看不到审批人、通知节点看不到渠道、条件节点看不到表达式 |
| P3 | **无编辑入口** | 高 | 节点点击只能打开只读 Drawer，没有任何编辑操作入口 |
| P4 | **节点名称不可改** | 高 | Drawer 中名称只读，无法修改 |
| P5 | **config 只读展示** | 高 | config 是核心配置，当前用 JSON.stringify 平铺，不可编辑 |
| P6 | **无类型化表单** | 高 | 所有节点共用同一 Drawer，未根据节点类型渲染对应表单 |
| P7 | **无关联配置入口** | 中 | 审批节点无法选人/角色、Webhook 无法填 URL、通知无法选渠道 |
| P8 | **无状态标识** | 中 | 节点卡片无"已配置/未配置"状态标识 |
| P9 | **无保存按钮** | 中 | Drawer 底部无任何操作按钮 |
| P10 | **无关闭按钮** | 低 | Drawer 依赖外部 onClose 关闭，无内部确认关闭机制 |

---

## 2. 节点类型配置需求

### 2.1 各节点类型需支持的配置参数

| 节点类型 | 配置参数 | 表单组件 | 必填 |
|---------|---------|---------|------|
| **start** | 触发方式（手动/事件/定时） | Select | 是 |
| | 初始变量定义 | KeyValue 输入 | 否 |
| **approval** | 审批人类型（用户/角色） | Radio | 是 |
| | 审批人列表 | UserSelect / RoleSelect | 是 |
| | 审批模式（会签/或签） | Select | 是 |
| | 超时策略（跳过/升级/自动通过） | Select + 时长输入 | 否 |
| | 审批表单 Schema | JSON 编辑器 | 否 |
| **condition** | 条件表达式 | 表达式编辑器 | 是 |
| | 分支变量引用 | 变量选择器 | 否 |
| **notification** | 通知渠道（钉钉/企微/飞书/邮件/SMS） | Select | 是 |
| | 收件人列表 | UserSelect / 组选择 | 是 |
| | 消息模板 | TextArea + 变量插入 | 是 |
| | 发送时机（立即/延迟） | Select + 时长 | 否 |
| **webhook** | URL | Input.URL | 是 |
| | HTTP Method | Select | 是 |
| | Headers | KeyValue 输入 | 否 |
| | Request Body | JSON 编辑器 + 变量插入 | 否 |
| | 重试策略 | 次数 + 间隔输入 | 否 |
| | 超时时间 | 数字输入 | 否 |
| **task** | 任务标题 | Input | 是 |
| | 任务描述 | TextArea | 否 |
| | 处理人 | UserSelect / RoleSelect | 是 |
| | 表单 Schema | JSON 编辑器 | 否 |
| | 截止时间 | DatePicker | 否 |
| | 优先级（低/普通/高/紧急） | Select | 否 |
| **sub-workflow** | 子流程 ID | WorkflowSelect | 是 |
| | 变量映射 | 映射编辑器（源变量 → 目标变量） | 否 |
| **delay** | 延迟时长 | 数字输入 + 单位选择 | 是 |
| **timer** | 定时表达式（cron） | Cron 表达式编辑器 | 是 |
| **end** | 输出变量定义 | KeyValue 输入 | 否 |

### 2.2 关联配置需求

| 关联类型 | 配置项 | 说明 |
|---------|--------|------|
| **上游节点** | 连接源节点 | 通过边关联，可在画布拖拽连线 |
| **下游节点** | 连接目标节点 | 条件节点支持多分支（True/False） |
| **错误处理** | 失败后行为 | 重试/跳过/终止/转人工 |
| **变量输入** | 接收上游变量 | 自动继承上游 output |
| **变量输出** | 输出下游变量 | 供后续节点引用 |

---

## 3. 改进方案设计

### 3.1 画布节点卡片改进

#### 改进前

```
┌──────────────────┐
│ 审批节点          │
│ [审批节点]        │
└──────────────────┘
```

#### 改进后

```
┌─────────────────────────────────┐
│ ● 审批节点                        │  ← 左侧色条 + 状态圆点
│                                 │
│ 审批人：张三、李四               │  ← 配置预览行
│ 模式：或签                       │  ← 配置预览行
│                                 │
│ ─────────────────────────────── │  ← 分隔线
│ [编辑] [复制]              [×]  │  ← 操作按钮行
└─────────────────────────────────┘
```

#### 设计规范

| 元素 | 样式 | Token |
|------|------|-------|
| 卡片宽度 | `min-width: 200px, max-width: 280px` | - |
| 卡片圆角 | `12px` | `componentRadius.card` |
| 卡片阴影 | `0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)` | `shadows.card` |
| 左侧装饰线 | `3px solid {nodeTypeColor}` | `colors.*[500]` |
| 节点名称 | `font-weight: 600, font-size: 13px, text-overflow: ellipsis` | - |
| 配置预览行 | `font-size: 12px, color: colors.neutral[500], max-height: 40px, overflow: hidden` | - |
| 状态圆点 | 已配置：`colors.success[500]`，未配置：`colors.warning[500]` | - |
| 选中态 | 背景 `colors.primary[50]`，边框 `2px solid colors.primary[500]` | - |
| Hover 态 | 背景 `colors.neutral[10]`，阴影增强 | `shadows.dropdown` |
| 操作按钮 | 默认隐藏，Hover 时显示 | - |

### 3.2 节点详情 Drawer 改造

#### 结构设计

```
┌──────────────────────────────────────────┐
│ [节点图标] 节点名称  [编辑] [删除]        │  ← Header
├──────────────────────────────────────────┤
│                                          │
│  ┌─ 基本信息 ─────────────────────────┐  │
│  │ 节点名称：[输入框]                  │  │  ← 可编辑
│  │ 节点类型：[Tag] 只读               │  │
│  │ 节点状态：[已配置/未配置]          │  │
│  └────────────────────────────────────┘  │
│                                          │
│  ┌─ 节点配置 ─────────────────────────┐  │
│  │ [根据类型动态渲染对应表单]          │  │
│  │                                    │  │
│  │ 审批节点示例：                      │  │
│  │ 审批人：[UserSelect 多选]          │  │
│  │ 审批模式：[Select: 会签/或签]      │  │
│  │ 超时策略：[Select] [时长输入]      │  │
│  └────────────────────────────────────┘  │
│                                          │
│  ┌─ 变量配置 ─────────────────────────┐  │
│  │ 输入变量：[上游自动继承]           │  │
│  │ 输出变量：[自定义输出映射]         │  │
│  └────────────────────────────────────┘  │
│                                          │
│  ┌─ 关联信息 ─────────────────────────┐  │
│  │ 上游：审批节点A →                  │  │
│  │ 下游：→ 通知节点B, → 结束节点      │  │
│  └────────────────────────────────────┘  │
│                                          │
├──────────────────────────────────────────┤
│ [取消] [保存]                    [删除]  │  ← Footer 操作区
└──────────────────────────────────────────┘
```

#### 两种模式切换

| 模式 | 触发方式 | 表单状态 | Footer 按钮 |
|------|---------|---------|-------------|
| **查看模式** | 点击节点 | 表单只读 | 仅「编辑」按钮 |
| **编辑模式** | 点击「编辑」按钮 | 表单可编辑 | 「取消」+「保存」按钮 |

### 3.3 类型化表单组件

#### 组件结构

```
src/components/WorkflowNodeForms/
├── index.tsx                    # 统一入口，根据 type 分发
├── ApprovalNodeForm.tsx         # 审批节点表单
├── ConditionNodeForm.tsx        # 条件节点表单
├── NotificationNodeForm.tsx     # 通知节点表单
├── WebhookNodeForm.tsx          # Webhook 节点表单
├── TaskNodeForm.tsx             # 人工任务节点表单
├── SubWorkflowNodeForm.tsx      # 子流程节点表单
├── TimerNodeForm.tsx            # 定时器节点表单
├── DelayNodeForm.tsx            # 延迟节点表单
├── StartNodeForm.tsx            # 开始节点表单
├── EndNodeForm.tsx              # 结束节点表单
└── BaseNodeForm.tsx             # 公共基础表单
```

#### 统一接口

```typescript
interface WorkflowNodeFormProps {
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
  readOnly?: boolean;
}
```

---

## 4. 交互流程

### 4.1 节点配置编辑流程

```
用户点击画布节点
  → Drawer 以「查看模式」打开
    → 展示节点基本信息 + 配置预览（只读）

用户点击 Drawer 顶部「编辑」按钮
  → Drawer 切换为「编辑模式」
    → 所有表单变为可编辑状态
    → Footer 显示「取消」和「保存」按钮

用户修改表单内容
  → 实时校验（必填项、格式校验）
  → 表单底部显示「保存」按钮状态（禁用/可用）

用户点击「保存」
  → 显示 loading 状态
  → 调用 updateWorkflow(workflowId, { nodes: updatedNodes })
  → 成功：message.success('节点配置已保存')，Drawer 回到查看模式
  → 失败：message.error('保存失败')，保持编辑模式

用户点击「取消」
  → 弹窗确认「确定放弃修改？」
  → 确认后回到查看模式，表单恢复原始值
```

### 4.2 节点名称修改流程

```
查看模式 / 编辑模式下均可修改
  → 节点名称字段从只读文本变为 Input
  → 支持即时修改（blur 时自动保存）或点击保存按钮统一保存
```

### 4.3 节点删除流程

```
用户点击画布节点右上角「×」或 Drawer 底部「删除」
  → 弹窗确认「确定删除该节点？关联的上下游连线将被清除」
  → 确认后调用 updateWorkflow(workflowId, { nodes: filteredNodes, edges: cleanedEdges })
  → 成功：message.success('节点已删除')，Drawer 关闭
  → 失败：message.error('删除失败')
```

---

## 5. 设计规范

### 5.1 Design Token 使用

| 用途 | 硬编码值 | Token |
|------|---------|-------|
| 卡片圆角 | `12px` | `componentRadius.card` |
| 按钮圆角 | `6px` | `componentRadius.button.md` |
| 卡片间距 | `16px` | `spacing.md` |
| 卡片内边距 | `24px` | `componentSpacing.cardPadding.lg` |
| 表单间距 | `12px` | `componentSpacing.formItemGap.sm` |
| 主色 | `#3370E6` | `colors.primary[500]` |
| 成功色 | `#52c41a` | `colors.success[500]` |
| 警告色 | `#faad14` | `colors.warning[500]` |
| 紫色 | `#7C5CFC` | `colors.purple[500]` |
| 错误色 | `#f5222d` | `colors.error[500]` |
| 信息色 | `#3a98f4` | `colors.info[500]` |
| 中性灰 | `#8c8c8c` | `colors.neutral[500]` |

### 5.2 节点类型色彩映射

| 节点类型 | 色值 | Token | 说明 |
|---------|------|-------|------|
| start | `#52c41a` | `colors.success[500]` | 绿色，表示开始 |
| end | `#8c8c8c` | `colors.neutral[500]` | 灰色，表示结束 |
| approval | `#7C5CFC` | `colors.purple[500]` | 紫色，表示审批 |
| condition | `#faad14` | `colors.warning[500]` | 橙色，表示判断 |
| notification | `#3a98f4` | `colors.info[500]` | 蓝色，表示通知 |
| webhook | `#3370E6` | `colors.primary[500]` | 主色，表示外部调用 |
| task | `#2B5DD6` | `colors.primary[600]` | 深蓝，表示人工任务 |
| sub-workflow | `#722ED1` | `colors.purple[600]` | 深紫，表示子流程 |
| delay | `#13C2C2` | - | 青色，表示延迟 |
| timer | `#EB2F96` | - | 粉色，表示定时器 |

---

## 6. API 调用

### 6.1 保存节点配置

```typescript
import { updateWorkflow } from '@/api/workflow';

// 更新单个节点配置
async function saveNodeConfig(
  workflowId: string,
  nodeId: string,
  newConfig: Record<string, unknown>
) {
  const workflow = await getWorkflow(workflowId);
  const updatedNodes = workflow.nodes.map((node) =>
    node.id === nodeId ? { ...node, config: newConfig } : node
  );
  await updateWorkflow(workflowId, { nodes: updatedNodes });
}
```

### 6.2 更新节点名称

```typescript
async function updateNodeName(
  workflowId: string,
  nodeId: string,
  newName: string
) {
  const workflow = await getWorkflow(workflowId);
  const updatedNodes = workflow.nodes.map((node) =>
    node.id === nodeId ? { ...node, name: newName } : node
  );
  await updateWorkflow(workflowId, { nodes: updatedNodes });
}
```

### 6.3 删除节点

```typescript
async function deleteNode(
  workflowId: string,
  nodeId: string
) {
  const workflow = await getWorkflow(workflowId);
  const updatedNodes = workflow.nodes.filter((node) => node.id !== nodeId);
  const updatedEdges = workflow.edges.filter(
    (edge) => edge.source !== nodeId && edge.target !== nodeId
  );
  await updateWorkflow(workflowId, {
    nodes: updatedNodes,
    edges: updatedEdges,
  });
}
```

---

## 7. 实施计划

### Phase 1：节点卡片增强（1-2 天）

- [ ] 增加配置预览行（显示前 2 行关键配置摘要）
- [ ] 增加名称溢出省略号处理
- [ ] 增加 Hover 时操作按钮显示（编辑/复制/删除）
- [ ] 增加配置状态圆点标识

### Phase 2：节点详情 Drawer 改造（2-3 天）

- [ ] Drawer 增加查看/编辑两种模式切换
- [ ] 节点名称支持编辑
- [ ] config 从 JSON 平铺改为表单展示
- [ ] Footer 增加「取消」「保存」「删除」按钮
- [ ] 保存时调用 `updateWorkflow`

### Phase 3：类型化表单实现（3-5 天）

- [ ] 创建 `WorkflowNodeForms/` 组件目录
- [ ] 实现 ApprovalNodeForm（审批表单）
- [ ] 实现 NotificationNodeForm（通知表单）
- [ ] 实现 WebhookNodeForm（Webhook 表单）
- [ ] 实现 ConditionNodeForm（条件表单）
- [ ] 实现 TaskNodeForm（任务表单）
- [ ] 实现 SubWorkflowNodeForm（子流程表单）
- [ ] 实现 TimerNodeForm / DelayNodeForm

### Phase 4：关联配置支持（2-3 天）

- [ ] 变量输入/输出配置
- [ ] 错误处理策略配置
- [ ] 节点间连线编辑入口（为未来 React Flow 集成预留）

---

## 8. 风险与约束

| 风险 | 影响 | 应对 |
|------|------|------|
| `updateWorkflow` 全量替换 nodes/edges | 并发修改可能覆盖他人更改 | 未来引入版本锁/乐观锁 |
| 表单组件复杂度 | 每种节点类型需独立开发 | 抽取 BaseNodeForm 公共部分 |
| Drawer 编辑模式状态管理 | 撤销/恢复原始值 | 编辑前深拷贝原始 config |
| 后端 config 字段无 Schema 验证 | 可能保存非法配置 | 前端严格校验 + 后端加验证 |

---

## 9. 交互完整性审查报告（2026-05-21 更新）

> 基于 CLAUDE.md "前端交互完整性审查规则" 的逐元素、逐字段审查结果。

### 9.1 逐元素交互链审查

#### WorkflowCanvas（画布）

| 元素 | 代码位置 | 可交互？ | 点击后 | loading | 反馈 | 问题 |
|------|---------|---------|--------|---------|------|------|
| 删除按钮 | 第 159-166 行 | 是 | handleDelete | 无 | message.success/error | **缺少二次确认**，直接调用 deleteWorkflow |
| 执行按钮 | 第 167-169 行 | 是 | handleExecute | **无** | message.success/error | **缺少 loading 状态**，异步操作无禁用保护 |
| 节点卡片点击 | 第 255-278 行 | 是 | handleNodeClick 打开 Drawer | 无 | 无 | 无问题 |
| 节点详情 Drawer | 第 290-354 行 | **只读** | 关闭 | 无 | 无 | **全部 Descriptions 只读展示，无任何编辑/保存能力** |
| 空状态 | 第 104-109 行 | 无引导 | 无操作 | — | — | Empty 无引导按钮 |

#### WorkflowList（列表）

| 元素 | 代码位置 | 可交互？ | 点击后 | loading | 反馈 | 问题 |
|------|---------|---------|--------|---------|------|------|
| 新建按钮 | 第 104/116 行 | 是 | setCreateModalOpen | 无 | 弹窗 | 无问题 |
| 创建表单 | 第 177-192 行 | 是 | handleCreate | 无 | message.success/error | **Modal 无 confirmLoading** |
| 列表项点击 | 第 146-173 行 | 是 | onSelect(id) | 无 | 无 | 无问题 |
| 启停按钮 | 第 151-160 行 | 是 | handleToggleStatus | **无** | message.success/error | **缺少 loading/disabled 保护** |
| 删除入口 | 无 | **不存在** | — | — | — | **列表项无删除按钮**，只能在画布页删除 |

#### WorkflowTasks（人工任务）

| 元素 | 代码位置 | 可交互？ | 点击后 | loading | 反馈 | 问题 |
|------|---------|---------|--------|---------|------|------|
| 认领/完成按钮 | 多处 | 是 | 打开 Modal | confirmLoading | message.success/error | 无问题 |
| formData 输入 | 第 588 行 | 是 | 提交时 JSON.parse | 无 | catch error | **无实时 JSON 格式校验** |
| 空状态 | 第 522 行 | 无引导 | — | — | — | Empty 无引导按钮 |

#### EventRegistry（事件注册表）

| 元素 | 代码位置 | 可交互？ | 点击后 | loading | 反馈 | 问题 |
|------|---------|---------|--------|---------|------|------|
| 测试匹配弹窗 | 第 546-692 行 | 是 | runTestMatch | loading | **无** | **执行成功/失败无 message 反馈** |
| 订阅表格 | 第 355-415 行 | 只读 | 无 | — | — | **纯只读表格，无可操作列** |
| 统计表格 | 第 481-537 行 | 只读 | 无 | — | — | **纯只读表格，无可操作列** |

#### TaskTimeouts（超时管理）

| 元素 | 代码位置 | 可交互？ | 点击后 | loading | 反馈 | 问题 |
|------|---------|---------|--------|---------|------|------|
| 立即检查按钮 | 第 301-309 行 | 是 | handleCheckNow | checking | message.success/error | 无问题 |
| 超时任务表格 | 第 358-371 行 | **只读** | 无 | — | — | **表格无操作列**，无法对单个任务执行提醒/升级/取消 |
| 空状态 | 第 369 行 | 纯文本 | — | — | — | **未使用 Empty 组件** |

#### WorkflowDependencies（依赖分析）

| 元素 | 代码位置 | 可交互？ | 点击后 | loading | 反馈 | 问题 |
|------|---------|---------|--------|---------|------|------|
| 检测按钮 | 第 494-501 行 | 是 | handleCheckDefinition | checkLoading | **仅失败有** | **成功时无 message.success** |

### 9.2 逐字段读写状态审查

#### 节点详情 Drawer（WorkflowCanvas.tsx 第 290-354 行）

| 字段 | 组件 | 只读/可编辑 | 保存方式 | 问题 |
|------|------|-----------|---------|------|
| 节点 ID | Descriptions.Item | **只读** | 无 | 合理，ID 不应可编辑 |
| 节点名称 | Descriptions.Item | **只读** | 无 | **应可编辑** |
| 节点类型 | Descriptions.Item + Tag | **只读** | 无 | 合理，类型不可改 |
| 位置 | Descriptions.Item | **只读** | 无 | 合理，拖拽控制 |
| config 字段 | Descriptions.Item | **只读** | 无 | **严重问题：审批人/通知渠道/Webhook URL 等全部只读** |
| 上游/下游 | Text 展示 | **只读** | 无 | 合理 |

### 9.3 CRUD 完整性审查

| 数据实体 | Create | Read | Update | Delete | 问题 |
|---------|--------|------|--------|--------|------|
| 工作流定义 | ✓ Modal | ✓ 列表+画布 | **✗ 无前端入口** | ✓ 画布删除 | **updateWorkflow API 存在但前端未调用** |
| 触发器 | ✗ 无 UI | ✗ 无 UI | ✗ 无 UI | ✗ 无 UI | **API 完整但无任何 UI 页面** |
| 人工任务 | 引擎创建 | ✓ 列表+详情 | ✗ 不可编辑 | ✗ 无取消 | 后端无 cancelTask 端点 |
| 执行实例 | ✓ 执行按钮 | ✓ 历史表格 | ✗ 不可修改 | ✗ 无终止 | 后端无 terminate 端点 |
| 订阅关系 | ✗ 无入口 | ✓ 只读表格 | ✗ 无入口 | ✗ 无入口 | 从触发器派生，无独立 CRUD |

### 9.4 场景逆向验证

| 场景 | 状态 | 卡住步骤 |
|------|------|---------|
| 改审批人：张三→李四 | **无法完成** | 1. 点击节点打开 Drawer 2. Drawer 全部 Descriptions 只读 3. config 审批人字段无 Input/Select，无保存按钮 |
| 改通知渠道：钉钉→飞书 | **无法完成** | 1. 点击通知节点打开 Drawer 2. config 只读展示 3. 无法编辑通知渠道，无保存按钮 |
| 改 Webhook URL | **无法完成** | 1. 点击 Webhook 节点打开 Drawer 2. config.url 字段只读展示 3. 无任何编辑能力 |

### 9.5 反模式检测

| 反模式 | 出现次数 | 位置 |
|--------|---------|------|
| 全部 Descriptions 只读 | 2 处 | WorkflowCanvas.tsx:299-351（节点详情）、WorkflowTasks:354-400（任务详情，合理） |
| 操作后无 message | 2 处 | EventRegistry 测试匹配（第 163-188 行）、WorkflowDependencies 检测成功（第 102-117 行） |
| 按钮无 loading | 3 处 | WorkflowCanvas 执行按钮（第 167 行）、删除按钮（第 159 行）、WorkflowList 启停按钮（第 151 行） |
| Empty 无引导 | 3 处 | WorkflowCanvas 未选工作流（第 107 行）、EventRegistry 订阅空（第 414 行）、EventRegistry 触发器空（第 536 行） |
| Modal 无 confirmLoading | 1 处 | WorkflowList 创建弹窗（第 177-192 行） |
| 无二次确认删除 | 1 处 | WorkflowCanvas 删除按钮（第 159-166 行） |
| JSON 输入无实时校验 | 1 处 | WorkflowTasks formData 字段（第 588 行） |

### 9.6 系统生态集成缺口

| 集成目标 | 当前状态 | 缺失能力 | 优先级 |
|---------|---------|---------|--------|
| Notification Service | config 只读 | 无法选择钉钉/飞书/企微/邮件/SMS 渠道 | P0 |
| Approval Flow Engine | config 只读 | 审批人/审批角色无法编辑 | P0 |
| Event Bus / Trigger Manager | API 完整无 UI | 无法创建/管理事件订阅触发器 | P1 |
| Ticket System | 任务可认领/完成 | 无取消任务、无转交能力 | P2 |
| AI Platform | 无集成 | 无 AI 节点类型 | P2 |
| Pipeline Engine | DAGGraph 仅展示 | 无法从工作流触发 Pipeline | P2 |

### 9.7 问题清单（共 14 项）

| # | 优先级 | 问题 | 代码位置 | 建议方案 |
|---|--------|------|---------|---------|
| 1 | **P0** | 节点详情 Drawer 纯只读，无法编辑配置 | WorkflowCanvas.tsx:290-354 | 添加编辑模式：根据节点类型渲染对应表单，保存调用 updateWorkflow |
| 2 | **P0** | 画布无添加节点能力 | WorkflowCanvas.tsx 全文 | 添加节点工具栏，支持拖拽/点击添加节点和连线 |
| 3 | **P0** | 删除工作流无二次确认 | WorkflowCanvas.tsx:159-166 | 添加 Modal.confirm |
| 4 | P1 | 执行按钮无 loading 状态 | WorkflowCanvas.tsx:167 | 添加 executing state，按钮 disabled+loading |
| 5 | P1 | 工作流列表项无删除按钮 | WorkflowList.tsx:146-173 | 添加删除按钮 + Modal.confirm |
| 6 | P1 | 启停按钮无 loading 保护 | WorkflowList.tsx:151-160 | 添加 togglingId state |
| 7 | P1 | 触发器管理 API 完整但无 UI | api/workflow-trigger.ts | 新建 WorkflowTriggers 页面 |
| 8 | P1 | 创建弹窗无 confirmLoading | WorkflowList.tsx:177-192 | 添加 creating state |
| 9 | P1 | 测试匹配结果无 message | EventRegistry:163-188 | 成功/失败加 message |
| 10 | P1 | 依赖检测成功无 message | WorkflowDependencies:102-117 | 检测成功加 message |
| 11 | P2 | 超时任务表格无操作列 | TaskTimeouts:125-219 | 添加提醒/升级/取消按钮 |
| 12 | P2 | 人工任务无取消/转交 | WorkflowTasks + api | 后端加端点，前端加按钮 |
| 13 | P2 | formData JSON 无实时校验 | WorkflowTasks:588 | 添加 onBlur 校验 |
| 14 | P2 | EventRegistry 标题英文 | EventRegistry:213 | 改为中文"事件注册表" |
