# Orion Pipeline 模块全栈升级设计文档

> 生成日期: 2026-05-21
> 设计范围: 前端交互与可视化 + 后端能力 UI 化 + 扩展性架构
> 方法论: 渐进式三阶段实施，每阶段独立可上线

---

## 1. 背景与现状分析

### 1.1 已有能力（后端 80% 已实现）

| 能力域 | 后端服务 | 前端 UI 覆盖 | 差距 |
|--------|---------|-------------|------|
| 执行引擎 | PipelineEngine, StageExecutor, TaskRunner | PipelineEditor（列表式） | 可视化 DAG 编辑器未打通 |
| 触发系统 | PipelineTriggerService, SCMWebhookService | TriggerPage（基础） | 无可视化配置、无事件历史 |
| 版本控制 | PipelineVersionService | PipelineVersionHistory | 已实现版本对比、回滚、基线 |
| 部署策略 | DeploymentStrategyService | PipelineEditor（无配置 UI） | 0% 前端覆盖 |
| 审批卡点 | ApprovalGateService | 无 | 0% 前端覆盖 |
| 质量门禁 | QualityGateService | 无 | 0% 前端覆盖 |
| 自动重试 | AutoRetryService | PipelineEditor（基础） | 缺少策略配置 UI |
| 超时控制 | 已支持 | 无 | 0% 前端覆盖 |
| IM 通知 | IMNotifier, 飞书/钉钉/企微适配器 | 无 | 0% 前端覆盖 |
| 环境变量 | EnvironmentService | 无 | 0% 前端覆盖 |
| 模板系统 | PipelineTemplateService | TemplateSelector（内置 4 个） | 后端 API 未完全对接 |
| SSE 实时日志 | PipelineLogSSEService | PipelineRunLive | 已实现 |
| 性能指标 | PipelineMetricsService | 无 | 0% 前端覆盖 |
| 密钥管理 | SecretsService | PipelineEditor（无配置 UI） | 0% 前端覆盖 |
| 子流水线 | SubPipelineService | PipelineEditor（无配置 UI） | 0% 前端覆盖 |
| 自适应超时 | AdaptiveTimeoutService | 无 | 0% 前端覆盖 |
| 执行队列 | PipelineExecutionQueue | Queue 页面 | 已实现基础 |
| 预算控制 | PipelineBudgetService | PipelineBudget | 已实现基础 |

### 1.2 核心问题清单

#### P0 严重问题

| 编号 | 问题 | 影响 |
|------|------|------|
| P0-1 | PipelineCanvas 是存根（`canvas.tsx` 仅显示一行文字） | 用户无法使用可视化 DAG 编辑 |
| P0-2 | PipelineList 缺少编辑入口 | CRUD 不完整，无法修改已有 Pipeline |
| P0-3 | PipelineRunList 无取消/重试按钮 | 运行管理能力缺失 |
| P0-4 | 审批卡点无前端 UI | 人工审批流程无法使用 |

#### P1 交互缺失

| 编号 | 问题 | 影响 |
|------|------|------|
| P1-1 | 无运行监控面板（性能指标、失败分析、历史趋势） | 无法诊断和优化 Pipeline |
| P1-2 | 模板系统未完全对接后端 | 用户无法保存/分享自定义模板 |
| P1-3 | 空状态引导不完整 | 新用户上手困难 |
| P1-4 | 触发器配置功能基础 | Git/Webhook/Schedule 无法可视化配置 |
| P1-5 | 无环境隔离 UI | 多环境部署无法管理 |

#### P2 扩展性问题

| 编号 | 问题 | 影响 |
|------|------|------|
| P2-1 | Stage 类型硬编码（STAGE_TYPES 数组） | 新增类型需改代码 |
| P2-2 | 无插件化机制 | 无法动态注册新的 Stage/Trigger 类型 |
| P2-3 | 无自定义字段系统 | 无法扩展 Stage 配置 |

---

## 2. 整体架构设计

### 2.1 分阶段实施策略

采用方案 A（渐进式修补），分 3 个阶段逐步补齐，每阶段独立可上线。

```
Phase 1 (2-3 周)          Phase 2 (2-3 周)         Phase 3 (2-3 周)
可视化与交互补全     →     后端能力 UI 化     →     扩展性架构升级
├─ Canvas 打通            ├─ 触发器配置             ├─ Stage 插件注册
├─ 审批/超时/门禁 UI      ├─ 环境变量管理           ├─ 模板市场
├─ CRUD 完整性            ├─ 部署策略配置           ├─ 自定义字段
├─ 运行监控面板           └─ IM 通知配置            └─ 第三方扩展点
└─ 空状态引导

每阶段独立交付 ✅           每阶段独立交付 ✅         每阶段独立交付 ✅
```

### 2.2 前端文件组织

```
orion-frontend/src/pages/pipeline-svc/
├── PipelineList/              # 列表页 (Phase 1 修复)
│   ├── index.tsx              # 主页面
│   ├── BatchActions.tsx       # 批量操作
│   └── TemplateSelector.tsx   # 模板选择器
├── PipelineEditor/            # 编辑器 (Phase 1 重写 Canvas)
│   ├── index.tsx              # 主页面
│   ├── canvas.tsx             # ← 改为代理导入，指向 ReactFlow 实现
│   ├── StageItem.tsx          # 列表式 Stage 项（保留兼容）
│   ├── StageModal.tsx         # Stage 配置弹窗 (Phase 1 增强)
│   └── StageNode.tsx          # Canvas 节点组件 (Phase 1 增强)
├── PipelineDetail/            # 详情页 (Phase 1 增强)
├── PipelineRunList/           # 运行列表 (Phase 1 增强)
├── PipelineRunLive/           # 实时运行 (已有 SSE)
├── PipelineVersionHistory/    # 版本历史 (已完成)
├── PipelineMonitor/           # 运行监控面板 (Phase 1 新增)
├── TriggerConfig/             # 触发器配置 (Phase 2 新增)
├── EnvironmentManager/        # 环境变量管理 (Phase 2 新增)
├── NotificationConfig/        # 通知配置 (Phase 2 新增)
├── TemplateMarket/            # 模板市场 (Phase 3 新增)
├── Queue/                     # 执行队列 (已有)
├── PipelineBudget/            # 预算控制 (已有)
├── TestReport/                # 测试报告 (已有)
├── TestSelector/              # 测试选择器 (已有)
├── ApkCredentials/            # APK 凭证 (已有)
├── ApkUploadHistory/          # APK 上传历史 (已有)
├── cache/                     # 缓存配置 (已有)
├── trigger/                   # 旧触发器页面 (Phase 2 替换)
├── orchestration/             # 编排页面 (已有)
├── data-pipeline/             # 数据流水线 (已有)
└── autonomous-pipeline/       # 自主流水线 (已有)
```

### 2.3 API 路由完整性

| 路由前缀 | 后端状态 | 前端对接 | 阶段 |
|---------|---------|---------|------|
| `/v1/pipelines` | ✅ 完整 | ✅ 完整 | - |
| `/v1/pipeline-runs` | ✅ 完整 | ⚠️ 缺取消/重试按钮 | Phase 1 |
| `/v1/pipelines/:id/versions` | ✅ 完整 | ✅ 完整 | - |
| `/v1/pipeline-templates` | ✅ 完整 | ⚠️ 部分对接 | Phase 2 |
| `/v1/webhooks/scm` | ✅ 完整 | ⚠️ 仅接收端点 | Phase 2 |
| `/v1/pipelines/sse/logs` | ✅ 完整 | ✅ 完整 | - |
| `/v1/pipelines/sse/metrics` | ✅ 完整 | ❌ 未对接 | Phase 1 |
| `/v1/approval-gates` | ✅ 完整 | ❌ 无 UI | Phase 1 |
| `/v1/quality-gates` | ✅ 完整 | ❌ 无 UI | Phase 1 |
| `/v1/environments` | ✅ 完整 | ❌ 无 UI | Phase 2 |
| `/v1/secrets` | ✅ 完整 | ⚠️ 无 UI | Phase 2 |
| `/v1/webhooks/configs` | ✅ 完整 | ❌ 无 UI | Phase 2 |

---

## 3. Phase 1：可视化与交互补全

### 3.1 PipelineCanvas 打通

**问题**：`pipeline-svc/PipelineEditor/canvas.tsx` 是存根，真正的 ReactFlow 实现在 `pipeline-editor/canvas/PipelineCanvas.tsx` 但未被编辑器引用。

**解决方案**：

1. **代理导入**：将 `canvas.tsx` 改为代理导入
```typescript
// pipeline-svc/PipelineEditor/canvas.tsx
export { PipelineCanvas } from '../pipeline-editor/canvas/PipelineCanvas';
```

2. **编辑器引用**：PipelineEditor 已引用 `{ PipelineCanvas } from './canvas'`，打通后自动使用 ReactFlow 实现

3. **StageNode 增强**：在节点上显示状态标识
```typescript
// StageNode 组件增加 props
interface StageNodeProps {
  // 现有
  label: string;
  stageType: string;
  // 新增
  hasApproval?: boolean;      // 是否启用审批
  timeout?: number;           // 超时时间
  hasQualityGate?: boolean;   // 是否启用质量门禁
  status?: 'success' | 'failed' | 'running' | 'pending';
}
```

4. **节点标识渲染**：
```typescript
// StageNode 内增加状态标识
<div className="stage-node-indicators">
  {hasApproval && <Badge status="processing" text="审批" />}
  {timeout && <Tag color="warning">超时 {timeout}s</Tag>}
  {hasQualityGate && <Badge status="success" text="门禁" />}
</div>
```

**涉及文件**：
- `pipeline-svc/PipelineEditor/canvas.tsx` - 改为代理导入
- `pipeline-editor/canvas/StageNode.tsx` - 增强节点标识
- `pipeline-svc/PipelineEditor/StageModal.tsx` - 增加审批/超时/门禁配置 Tab

### 3.2 StageConfigModal 增强

#### 3.2.1 超时配置 Tab

```typescript
interface TimeoutConfig {
  enabled: boolean;
  duration: number;           // 超时时间（秒）
  action: 'fail' | 'skip' | 'retry';  // 超时动作
}
```

**UI 布局**：
```
┌─────────────────────────────────┐
│ □ 启用阶段超时                    │
│                                 │
│ 超时时间： [ 300 ] 秒             │
│                                 │
│ 超时动作：                      │
│ ○ 标记为失败                     │
│ ○ 跳过并继续                     │
│ ○ 自动重试 (最多 [3] 次)         │
└─────────────────────────────────┘
```

#### 3.2.2 审批卡点 Tab

```typescript
interface ApprovalConfig {
  enabled: boolean;
  approvers: string[];          // 审批人列表（用户 ID 或角色名）
  mode: 'unanimous' | 'any';    // 会签 / 或签
  timeout: number;              // 审批超时（秒），0 表示不超时
  timeoutAction: 'approve' | 'reject';  // 超时自动处理
}
```

**UI 布局**：
```
┌─────────────────────────────────┐
│ □ 启用审批卡点                    │
│                                 │
│ 审批人：[Select 多选用户/角色]     │
│                                 │
│ 审批模式：                      │
│ ○ 会签（全部通过）                │
│ ○ 或签（任一通过）                │
│                                 │
│ 审批超时：[ 0 ] 秒                │
│ 超时动作：                      │
│ ○ 自动通过                       │
│ ○ 自动拒绝                       │
└─────────────────────────────────┘
```

#### 3.2.3 质量门禁 Tab

```typescript
interface QualityGateConfig {
  enabled: boolean;
  rules: Array<{
    metric: 'test_pass_rate' | 'coverage' | 'vulnerability_count' | 'custom';
    operator: '>' | '<' | '>=' | '<=' | '==';
    threshold: number;
  }>;
  failureAction: 'block' | 'warn' | 'continue';
}
```

**UI 布局**：
```
┌─────────────────────────────────┐
│ □ 启用质量门禁                    │
│                                 │
│ 门禁规则：                      │
│ ┌──────────────────────────┐    │
│ │ 测试通过率 ≥ [95] %       │ [×]│
│ │ 代码覆盖率 ≥ [80] %       │ [×]│
│ │ 漏洞数量 ≤ [0] 个         │ [×]│
│ └──────────────────────────┘    │
│ [+ 添加规则]                     │
│                                 │
│ 不通过时：                      │
│ ○ 阻止部署                       │
│ ○ 仅告警，继续执行                │
│ ○ 忽略                           │
└─────────────────────────────────┘
```

#### 3.2.4 StageModal 完整结构

```
StageConfigModal
├── Tab 1: 基础配置（已有）
│   ├── 名称
│   ├── 类型
│   ├── 描述
│   └── 运行环境
├── Tab 2: 依赖配置（已有）
│   ├── 上游阶段（dependsOn）
│   └── DAG 可视化预览
├── Tab 3: 超时配置（新增）
│   ├── 启用开关
│   ├── 超时时间
│   └── 超时动作
├── Tab 4: 重试策略（已有，增强）
│   ├── 重试次数
│   ├── 重试间隔（指数退避/固定间隔）
│   └── 重试条件（仅失败/特定错误）
├── Tab 5: 审批卡点（新增）
│   ├── 启用开关
│   ├── 审批人
│   ├── 审批模式
│   └── 超时策略
├── Tab 6: 质量门禁（新增）
│   ├── 启用开关
│   ├── 规则列表
│   └── 不通过动作
├── Tab 7: 缓存配置（已有）
│   ├── 启用开关
│   ├── 缓存键
│   └── 缓存路径
├── Tab 8: 制品配置（已有）
│   ├── 上传路径
│   └── 过期时间
└── Tab 9: 高级配置（已有）
    ├── Matrix 构建
    ├── PR/MR 触发
    └── 子流水线
```

### 3.3 CRUD 完整性修复

#### 3.3.1 PipelineList 编辑入口

**修改**：操作列增加"编辑"按钮

```typescript
// PipelineList 操作列
{
  key: 'actions',
  title: '操作',
  width: 280,  // 从 200 改为 280，容纳新增按钮
  render: (_, record) => (
    <Space size="small">
      <Button type="link" size="small" onClick={() => navigate(`/pipelines/${record.id}`)}>
        查看
      </Button>
      <Button type="link" size="small" onClick={() => navigate(`/pipelines/edit/${record.id}`)}>
        编辑
      </Button>
      <Button type="link" size="small" onClick={() => handleRun(record)}>
        运行
      </Button>
      <Button type="link" size="small" onClick={() => navigate(`/pipelines/${record.id}/runs`)}>
        运行记录
      </Button>
      <Popconfirm title="确认删除该 Pipeline？" onConfirm={() => handleDelete(record)}>
        <Button type="link" size="small" danger>
          删除
        </Button>
      </Popconfirm>
    </Space>
  ),
}
```

#### 3.3.2 PipelineRunList 取消/重试

**修改**：运行状态列增加操作按钮

```typescript
// 运行中的行显示"取消"按钮
// 失败/已取消的行显示"重试"按钮（支持下拉：完整重试/从阶段重试）

{
  key: 'actions',
  title: '操作',
  width: 200,
  render: (_, record) => (
    <Space size="small">
      <Button type="link" size="small" onClick={() => navigate(`/pipelines/${record.pipelineId}/runs/${record.id}`)}>
        查看日志
      </Button>
      {record.status === 'running' && (
        <Popconfirm title="确认取消该运行？" onConfirm={() => handleCancel(record.id)}>
          <Button type="link" size="small" danger loading={cancellingIds.has(record.id)}>
            取消
          </Button>
        </Popconfirm>
      )}
      {(record.status === 'failed' || record.status === 'cancelled') && (
        <Dropdown menu={{
          items: [
            { key: 'full', label: '完整重试', onClick: () => handleRetry(record.id) },
            { key: 'from-stage', label: '从阶段重试', onClick: () => openStageSelector(record.id) },
          ],
        }}>
          <Button type="link" size="small">
            重试 ▾
          </Button>
        </Dropdown>
      )}
    </Space>
  ),
}
```

#### 3.3.3 阶段选择器（从阶段重试）

```typescript
// 弹窗：选择从哪个阶段开始重试
interface StageSelectorModalProps {
  runId: string;
  visible: boolean;
  onRetry: (stageId: string, onlyFailed: boolean) => void;
  onCancel: () => void;
}
```

### 3.4 运行监控面板（新页面）

**文件**：`pipeline-svc/PipelineMonitor/index.tsx`

**路由**：`/pipelines/monitor`

**布局**：
```
┌──────────────────────────────────────────────┐
│  📊 运行监控                      [刷新] [时间范围▼] │
├──────────────────────────────────────────────┤
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐        │
│  │今日运行│ │成功率 │ │平均耗时│ │失败数 │        │
│  │  128  │ │ 96.2%│ │ 2m34s │ │   5  │        │
│  └──────┘ └──────┘ └──────┘ └──────┘        │
├──────────────────────────────────────────────┤
│  失败分析                                    │
│  ┌──────────────┐ ┌─────────────────────┐   │
│  │ 失败模式分布  │ │ 失败阶段 Top 5       │   │
│  │ (饼图)       │ │ (条形图)             │   │
│  │              │ │                      │   │
│  │ 超时 40%     │ │ Build     ████████ 4  │   │
│  │ 编译错误 30% │ │ Test      ██████ 3    │   │
│  │ 部署失败 20% │ │ Deploy    ████ 2      │   │
│  │ 其他 10%     │ │ Scan      ██ 1        │   │
│  │              │ │ Notify    ██ 1        │   │
│  └──────────────┘ └─────────────────────┘   │
├──────────────────────────────────────────────┤
│  失败趋势（近 7 天折线图）                    │
│  8 ┤                                          │
│  6 ┤    ╱╲                                  │
│  4 ┤   ╱  ╲╱╲                                │
│  2 ┤  ╱      ╲                               │
│  0 ┤─╯        ╰─                              │
│    └─┬─┬─┬─┬─┬─┬─┬─┘                         │
│     一 二 三 四 五 六 日                      │
├──────────────────────────────────────────────┤
│  性能指标                                    │
│  ┌─────────────────────────────────────┐    │
│  │ 各阶段平均耗时 (条形图)               │    │
│  │ Build     ████████████ 45s          │    │
│  │ Test      ██████████ 38s            │    │
│  │ Deploy    ████████ 30s              │    │
│  │ Scan      ██████ 22s                │    │
│  └─────────────────────────────────────┘    │
│                                              │
│  最近运行耗时对比（表格）                     │
│  ┌────┬────┬────┬────┬────┬────┐           │
│  │运行#│ 状态│ Build│ Test│Deploy│总耗时│           │
│  │#128│ ✅  │ 42s │ 35s│ 28s │ 1m45s│           │
│  │#127│ ❌  │ 45s │ -- │ --  │ 45s  │           │
│  │#126│ ✅  │ 48s │ 40s│ 32s │ 2m00s│           │
│  └────┴────┴────┴────┴────┴────┘           │
└──────────────────────────────────────────────┘
```

**数据来源**：
- 统计卡片：`GET /v1/pipeline-runs?limit=100` → 聚合计算
- 失败分析：前端聚合 `runs.filter(r => r.status === 'failed')` 按失败原因分类
- 失败趋势：前端按日期聚合运行数据
- 性能指标：`GET /v1/pipelines/sse/metrics`（PipelineMetricsService）

**涉及 API**：
```typescript
// pipeline-svc/PipelineMonitor/api.ts
export function getRunStats(params?: { days?: number }) {
  return api.get('/v1/pipeline-runs/stats', { params });
}

export function getMetrics() {
  return api.get('/v1/pipelines/sse/metrics');
}
```

### 3.5 空状态引导完善

**PipelineDetail**：
- TaskOutputsTable 空状态：添加引导文字"任务输出变量传播功能即将上线"
- 运行记录 tab：Empty + "运行该 Pipeline 后将显示运行记录"
- 审批记录 tab：Empty + "配置审批卡点后将显示审批记录"

**PipelineRunList**：
- 无运行记录：Empty + "从列表页运行该 Pipeline"

---

## 4. Phase 2：后端能力 UI 化

### 4.1 触发器可视化配置

**文件**：`pipeline-svc/TriggerConfig/index.tsx`（替代现有 `trigger/TriggerPage.tsx`）

**路由**：`/pipelines/:id/triggers`

**后端对接**：
- `GET /v1/pipelines/:id/triggers` - 获取 Pipeline 的触发器列表
- `POST /v1/pipelines/:id/triggers` - 创建触发器
- `PUT /v1/pipelines/:id/triggers/:triggerId` - 更新触发器
- `DELETE /v1/pipelines/:id/triggers/:triggerId` - 删除触发器
- `GET /v1/webhooks/scm/events` - 获取 Webhook 事件历史

**页面布局**：
```
┌──────────────────────────────────────────┐
│  触发器管理                               │
│  当前 Pipeline: my-ci-pipeline           │
│  [+ 添加触发器] [刷新]                    │
├──────────────────────────────────────────┤
│  ┌────────────────────────────────────┐ │
│  │ 📌 Git 触发 (active)               │ │
│  │ 分支: main                         │ │
│  │ 路径: src/**, package.json         │ │
│  │ 最近触发: 2分钟前 (成功)            │ │
│  │ [编辑] [禁用] [删除] [触发历史]     │ │
│  └────────────────────────────────────┘ │
│  ┌────────────────────────────────────┐ │
│  │ ⏰ 定时触发 (active)               │ │
│  │ Cron: 0 2 * * * (每天 02:00)       │ │
│  │ 时区: Asia/Shanghai                │ │
│  │ 下次触发: 明天 02:00               │ │
│  │ [编辑] [禁用] [删除]               │ │
│  └────────────────────────────────────┘ │
│  ┌────────────────────────────────────┐ │
│  │ 🔗 Webhook 触发 (inactive)         │ │
│  │ URL: /webhooks/scm/my-pipeline     │ │
│  │ 密钥: 已配置                       │ │
│  │ [编辑] [启用] [删除]               │ │
│  └────────────────────────────────────┘ │
└──────────────────────────────────────────┘
```

**触发器编辑弹窗**：
```
┌─────────────────────────────────────┐
│ 编辑触发器                           │
│                                     │
│ 触发类型：                           │
│ ○ Git 推送/拉取请求                  │
│ ○ Webhook 回调                      │
│ ○ 定时执行 (Cron)                   │
│ ○ 手动触发（无需配置）                │
│                                     │
│ [根据类型展开不同配置]                │
│                                     │
│ Git 触发配置：                      │
│ 分支匹配：[main, develop]            │
│ 路径包含：[src/**, package.json]     │
│ 路径排除：[**/*.md]                  │
│ 事件类型：[Push, Pull Request]       │
│                                     │
│ Cron 触发配置：                     │
│ Cron 表达式：[0 2 * * *]             │
│ 时区：[Asia/Shanghai ▼]              │
│ 下次触发时间：明天 02:00             │
│                                     │
│ Webhook 触发配置：                  │
│ 回调 URL：/webhooks/scm/xxx          │
│ 签名密钥：[****************] [生成新密钥] │
│ 签名方式：[HMAC-SHA256 ▼]            │
│                                     │
│ [保存] [取消]                        │
└─────────────────────────────────────┘
```

### 4.2 环境变量管理页面

**文件**：`pipeline-svc/EnvironmentManager/index.tsx`

**路由**：`/console/environments`

**后端对接**：
- `GET /v1/environments` - 获取环境列表
- `POST /v1/environments` - 创建环境
- `PUT /v1/environments/:id` - 更新环境
- `DELETE /v1/environments/:id` - 删除环境
- `GET /v1/environments/:id/variables` - 获取环境变量
- `POST /v1/environments/:id/variables` - 创建变量
- `PUT /v1/environments/:id/variables/:key` - 更新变量
- `DELETE /v1/environments/:id/variables/:key` - 删除变量

**变量继承层级**：
```
全局变量 (Global)
    ↓
项目变量 (Project)
    ↓
环境变量 (Environment: dev/staging/prod)
    ↓
Pipeline 变量
    ↓
Stage 变量
```

**页面布局**：
```
┌──────────────────────────────────────────┐
│  环境变量管理                             │
│  [+ 创建环境]                             │
├──────────────────────────────────────────┤
│  环境列表                                │
│  ┌──────┬──────┬──────┬──────┐          │
│  │开发   │测试   │预发   │生产   │          │
│  │12个变量│15个变量│18个变量│20个变量│          │
│  │[管理] │[管理] │[管理] │[管理] │          │
│  └──────┴──────┴──────┴──────┘          │
├──────────────────────────────────────────┤
│  开发环境 - 变量列表                      │
│  [+ 添加变量] [导入] [导出]               │
│  ┌──────┬──────┬──────┬──────┐          │
│  │变量名 │值    │加密  │操作  │          │
│  ├──────┼──────┼──────┼──────┤          │
│  │DB_HOST│localhost│否  │[编辑]│          │
│  │DB_PASS│•••••• │是  │[编辑]│          │
│  │APP_ENV│dev  │否  │[编辑]│          │
│  └──────┴──────┴──────┴──────┘          │
│                                          │
│  变量使用追踪                            │
│  DB_HOST 被以下 Pipeline 引用：           │
│  - my-ci-pipeline (Stage: Deploy)        │
│  - nightly-build (Stage: Build)           │
└──────────────────────────────────────────┘
```

### 4.3 部署策略配置

**集成位置**：PipelineEditor 中 Deploy 类型 Stage 的配置面板

**配置项**：
```typescript
interface DeploymentStrategyConfig {
  strategy: 'rolling' | 'canary' | 'blue-green';
  // 滚动部署
  rolling?: {
    maxUnavailable: number;  // 最大不可用比例 (0-100)
    maxSurge: number;        // 最大超出副本数
  };
  // 金丝雀发布
  canary?: {
    steps: Array<{
      trafficPercent: number;  // 流量比例
      pauseDuration: number;   // 暂停时长（秒），0 表示自动
    }>;
    analysis?: {
      errorRateThreshold: number;    // 错误率阈值
      latencyThreshold: number;      // 延迟阈值（ms）
      analysisInterval: number;      // 分析间隔（秒）
    };
  };
  // 蓝绿部署
  blueGreen?: {
    autoPromote: boolean;      // 是否自动切换
    promoteDelay: number;      // 切换延迟（秒）
    healthCheckPath: string;   // 健康检查路径
  };
}
```

**UI 布局**（StageModal 内 Deploy 类型的专属 Tab）：
```
┌─────────────────────────────────────┐
│ 部署策略                              │
│                                     │
│ 策略类型：                           │
│ ○ 滚动部署 (Rolling Update)          │
│ ○ 金丝雀发布 (Canary)               │
│ ○ 蓝绿部署 (Blue-Green)             │
│                                     │
│ [根据策略类型展开不同配置]             │
│                                     │
│ 金丝雀发布配置：                     │
│ 流量比例步骤：                       │
│ ┌─────────────────────────┐        │
│ │ 步骤1: 5%  暂停 [300]秒  │ [×]   │
│ │ 步骤2: 25% 暂停 [600]秒  │ [×]   │
│ │ 步骤3: 50% 暂停 [600]秒  │ [×]   │
│ │ 步骤4: 100% 完成         │       │
│ └─────────────────────────┘        │
│ [+ 添加步骤]                        │
│                                     │
│ 自动回滚条件：                      │
│ 错误率 > [5] % 时回滚               │
│ 延迟 > [2000] ms 时回滚             │
│ 分析间隔：[60] 秒                   │
│                                     │
│ [保存] [取消]                        │
└─────────────────────────────────────┘
```

### 4.4 IM 通知配置

**文件**：`pipeline-svc/NotificationConfig/index.tsx`

**路由**：`/console/pipeline-notifications`

**后端对接**：
- 复用 PipelineEngine 的 IMNotifier + 适配器（飞书/钉钉/企微）
- 新增通知配置 CRUD 端点

**页面布局**：
```
┌──────────────────────────────────────────┐
│ 通知配置                                 │
│  [+ 添加通知规则]                         │
├──────────────────────────────────────────┤
│  通知渠道                                │
│  ┌────────────────────────────────┐     │
│  │ 🟢 飞书 - 工程团队群            │     │
│  │ Webhook: https://open.feishu... │     │
│  │ [测试] [编辑] [删除]            │     │
│  └────────────────────────────────┘     │
│  ┌────────────────────────────────┐     │
│  │ 🟡 钉钉 - 运维告警群             │     │
│  │ Webhook: https://oapi.dingtalk..│     │
│  │ [测试] [编辑] [删除]            │     │
│  └────────────────────────────────┘     │
├──────────────────────────────────────────┤
│  通知规则                                │
│  ┌────────────────────────────────┐     │
│  │ Pipeline: my-ci-pipeline       │     │
│  │ 触发条件：运行失败、运行超时      │     │
│  │ 通知渠道：飞书 - 工程团队群      │     │
│  │ 静默时段：22:00 - 08:00         │     │
│  │ [编辑] [删除]                   │     │
│  └────────────────────────────────┘     │
└──────────────────────────────────────────┘
```

---

## 5. Phase 3：扩展性架构升级

### 5.1 插件化 Stage 类型注册系统

**核心接口**：
```typescript
// 核心注册表
interface StageTypePlugin {
  id: string;                                    // 唯一标识，如 'build', 'deploy-k8s'
  name: string;                                  // 显示名称，如 '构建 (Build)'
  icon: string;                                  // 图标，如 '🔨' 或 Ant Design 图标名
  category: 'build' | 'test' | 'deploy' | 'scan' | 'notify' | 'custom';
  description: string;                           // 描述文字
  configSchema: Record<string, ConfigField>;    // 配置字段定义
  defaultConfig: Record<string, unknown>;        // 默认配置
  validator?: (config: Record<string, unknown>) => string[]; // 校验函数
}

interface ConfigField {
  type: 'string' | 'number' | 'boolean' | 'select' | 'array' | 'json';
  label: string;
  required?: boolean;
  default?: unknown;
  options?: { label: string; value: unknown }[];  // select 类型专用
  placeholder?: string;
  description?: string;
}

// 注册 API
class StageTypeRegistry {
  private plugins = new Map<string, StageTypePlugin>();

  register(plugin: StageTypePlugin): void {
    if (this.plugins.has(plugin.id)) {
      throw new Error(`Stage type "${plugin.id}" already registered`);
    }
    this.plugins.set(plugin.id, plugin);
  }

  unregister(id: string): void {
    this.plugins.delete(id);
  }

  get(id: string): StageTypePlugin | undefined {
    return this.plugins.get(id);
  }

  list(category?: string): StageTypePlugin[] {
    const all = Array.from(this.plugins.values());
    return category ? all.filter(p => p.category === category) : all;
  }
}

// 全局单例
export const stageTypeRegistry = new StageTypeRegistry();
```

**内置 Stage 类型注册**：
```typescript
// 注册内置 Stage 类型
stageTypeRegistry.register({
  id: 'build',
  name: '构建 (Build)',
  icon: '🔨',
  category: 'build',
  description: '编译代码、构建制品',
  configSchema: {
    command: { type: 'string', label: '构建命令', required: true, default: 'npm run build' },
    outputDir: { type: 'string', label: '输出目录', default: 'dist' },
    nodeVersion: { type: 'select', label: 'Node 版本', options: [
      { label: '18.x', value: '18' },
      { label: '20.x', value: '20' },
      { label: '22.x', value: '22' },
    ]},
  },
  defaultConfig: { command: 'npm run build', outputDir: 'dist' },
});

stageTypeRegistry.register({
  id: 'test',
  name: '测试 (Test)',
  icon: '🧪',
  category: 'test',
  description: '运行单元测试、集成测试',
  configSchema: {
    command: { type: 'string', label: '测试命令', required: true, default: 'npm test' },
    coverageThreshold: { type: 'number', label: '覆盖率阈值 (%)', default: 80 },
    testType: { type: 'select', label: '测试类型', options: [
      { label: '单元测试', value: 'unit' },
      { label: '集成测试', value: 'integration' },
      { label: '端到端测试', value: 'e2e' },
    ]},
  },
  defaultConfig: { command: 'npm test', coverageThreshold: 80 },
});

// ... deploy, scan, notify, custom, buildx, container 等
```

**第三方扩展方式**：
```typescript
// 第三方开发者通过全局 API 注册自定义 Stage 类型
import { stageTypeRegistry } from '@/components/pipeline/StageTypeRegistry';

stageTypeRegistry.register({
  id: 'deploy-ecs',
  name: 'ECS 部署',
  icon: '☁️',
  category: 'deploy',
  description: '部署到阿里云 ECS 实例',
  configSchema: {
    region: { type: 'string', label: '地域', required: true },
    instanceIds: { type: 'array', label: '实例 ID 列表', required: true },
    deployScript: { type: 'string', label: '部署脚本', required: true },
  },
  defaultConfig: { region: 'cn-hangzhou', instanceIds: [], deployScript: '' },
});
```

**编辑器自动渲染**：
- StageModal 根据 `configSchema` 自动生成表单字段
- 无需为每个 Stage 类型硬编码表单

### 5.2 Pipeline 模板市场

**文件**：`pipeline-svc/TemplateMarket/index.tsx`

**路由**：`/pipeline-templates/market`

**功能**：
- 浏览所有模板（系统内置 + 用户创建）
- 按分类筛选（CI/CD/部署/测试）
- 模板预览（YAML + 可视化预览）
- 一键创建 Pipeline
- 用户可将自己创建的 Pipeline 保存为模板
- 模板版本管理

**页面布局**：
```
┌──────────────────────────────────────────┐
│  模板市场                     [搜索] [+ 保存当前 Pipeline 为模板] │
├──────────────────────────────────────────┤
│  分类：[全部] [CI] [CD] [完整 CI/CD] [部署] [测试]       │
├──────────────────────────────────────────┤
│  ┌──────────────┐ ┌──────────────┐      │
│  │ 🔨 基础 CI    │ │ 🚀 基础 CD    │      │
│  │ 代码扫描+构建  │ │ 构建镜像+部署  │      │
│  │ ⭐ 系统内置    │ │ ⭐ 系统内置    │      │
│  │ [预览] [使用]  │ │ [预览] [使用]  │      │
│  └──────────────┘ └──────────────┘      │
│  ┌──────────────┐ ┌──────────────┐      │
│  │ ⚡ 完整 CI/CD │ │ ☸️ K8s 部署  │      │
│  │ 扫描到部署全链 │ │ 直接部署到K8s │      │
│  │ ⭐ 系统内置    │ │ ⭐ 系统内置    │      │
│  │ [预览] [使用]  │ │ [预览] [使用]  │      │
│  └──────────────┘ └──────────────┘      │
│  ┌──────────────┐ ┌──────────────┐      │
│  │ 📦 多架构构建  │ │ 🧪 测试套件  │      │
│  │ amd64+arm64   │ │ 单元+集成+E2E │      │
│  │ 👤 用户创建    │ │ 👤 用户创建    │      │
│  │ [预览] [使用]  │ │ [预览] [使用]  │      │
│  └──────────────┘ └──────────────┘      │
└──────────────────────────────────────────┘
```

**模板预览弹窗**：
```
┌─────────────────────────────────────┐
│ 模板预览：基础 CI                     │
│                                     │
│ [YAML] [可视化]                      │
│ ───────                             │
│ apiVersion: v1                      │
│ kind: Pipeline                       │
│ metadata:                           │
│   name: basic-ci                     │
│ spec:                               │
│   stages:                           │
│     - name: 代码扫描                  │
│       type: scan                     │
│     - name: 构建                     │
│       type: build                    │
│     - name: 单元测试                  │
│       type: test                     │
│                                     │
│ [取消] [使用该模板创建 Pipeline]       │
└─────────────────────────────────────┘
```

**保存 Pipeline 为模板**：
```typescript
// 从 PipelineDetail 或 PipelineEditor 触发
async function saveAsTemplate(pipelineId: string, templateData: {
  name: string;
  description: string;
  category: string;
  tags: string[];
  isPublic: boolean;
}) {
  // 调用后端 API
  const response = await pipelineTemplatesApi.saveFromPipeline(pipelineId, templateData);
  return response;
}
```

### 5.3 自定义字段扩展点

**设计**：
- 为 Pipeline、Stage、Trigger 提供 `customFields: Record<string, unknown>` 字段
- 前端通过配置定义自定义字段的展示和编辑 UI
- 后端存储为 JSON 字段，不干扰核心逻辑

**配置方式**：
```typescript
// 项目级别配置：定义自定义字段 schema
interface CustomFieldDefinition {
  key: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'select' | 'json';
  scope: 'pipeline' | 'stage' | 'trigger';  // 作用域
  options?: { label: string; value: unknown }[];
  required?: boolean;
}

// 示例：为 Stage 添加"负责人"和"成本中心"自定义字段
const customFields: CustomFieldDefinition[] = [
  { key: 'owner', label: '负责人', type: 'string', scope: 'stage', required: true },
  { key: 'costCenter', label: '成本中心', type: 'select', scope: 'stage', options: [
    { label: '前端团队', value: 'frontend' },
    { label: '后端团队', value: 'backend' },
    { label: '基础设施', value: 'infra' },
  ]},
];
```

---

## 6. 数据流设计

### 6.1 Pipeline 编辑器数据流

```
用户操作 (拖拽/编辑节点)
    ↓
ReactFlow onNodesChange/onEdgesChange
    ↓
onStagesChange (回调)
    ↓
PipelineEditor 状态更新 (useState)
    ↓
生成 YAML (实时预览)
    ↓
点击保存
    ↓
updatePipeline API (PUT /v1/pipelines/:id)
    ↓
后端 PipelineService.update()
    ↓
PipelineRepository.update()
    ↓
PostgreSQL UPDATE
    ↓
返回成功 → 创建新版本 (PipelineVersionService)
    ↓
message.success('保存成功')
```

### 6.2 Pipeline 执行数据流

```
用户点击"运行"按钮
    ↓
triggerPipeline API (POST /v1/pipelines/:id/runs)
    ↓
PipelineRunController.trigger()
    ↓
PipelineService.triggerRun()
    ↓
PipelineEngine.execute()
    ↓
    ├── 创建 PipelineRun 记录
    ├── 初始化 Stages 和 Tasks
    ├── 发布 PipelineEvent (SSE)
    └── 开始执行
        ↓
    StageExecutor.executeStage()
        ↓
    TaskRunner.executeTask()
        ↓
    发布 TaskLogEvent (SSE) ← PipelineLogSSEService
        ↓
    前端 usePipelineSSE hook 接收事件
        ↓
    更新日志 + 更新 Stage/Task 状态
        ↓
    PipelineEngine.checkNextStages()
        ↓
    执行完成 → 更新 PipelineRun 状态
        ↓
    发布 PipelineCompleteEvent
```

### 6.3 模板实例化数据流

```
用户选择模板 → 点击"使用"
    ↓
navigate('/pipelines/new?template=basic-ci')
    ↓
PipelineEditor 读取 searchParams.template
    ↓
pipelineTemplates.find(t => t.id === templateId)
    ↓
templateToYaml(template, name, version, description)
    ↓
stages 状态更新
    ↓
用户修改 → 保存
    ↓
createPipeline API (POST /v1/pipelines)
```

---

## 7. 错误处理设计

### 7.1 前端错误处理统一规范

| 错误类型 | 处理方式 | 用户提示 |
|---------|---------|---------|
| 网络错误 (401/403/500) | message.error + 可选重试 | "请求失败，请稍后重试" |
| 参数校验失败 | 表单 inline error | 具体字段错误提示 |
| 业务逻辑错误 | message.error + 详情 | 后端返回的错误消息 |
| 操作取消 | message.info | "操作已取消" |
| 空数据 | Empty 组件 + 引导 | "暂无数据" + 操作按钮 |

### 7.2 Pipeline 特定错误处理

**YAML 解析错误**：
- 保存时调用 `POST /v1/pipelines/validate`
- 错误返回：`{ valid: false, errors: ['Stage "Build" 缺少 name 字段'] }`
- 前端展示：Alert 组件 + 红色边框标记错误 Stage

**DAG 循环依赖错误**：
- 保存时调用 `validateDAG(stages)`
- 错误返回：`{ valid: false, errors: ['检测到循环依赖: Build → Test → Scan → Build'] }`
- 前端展示：Modal 弹窗 + 高亮循环路径

**执行失败**：
- PipelineRun 状态变为 'failed'
- PipelineDetail 展示失败阶段 + 错误消息
- PipelineErrorDetail 展示结构化错误分析（已实现）

---

## 8. 测试策略

### 8.1 单元测试

| 模块 | 测试内容 | 文件 |
|------|---------|------|
| StageTypeRegistry | 注册、注销、查询、去重 | `__tests__/StageTypeRegistry.test.ts` |
| templateToYaml | 模板转 YAML 正确性 | `__tests__/templateToYaml.test.ts` |
| validateDAG | DAG 循环依赖检测 | `__tests__/validateDAG.test.ts` |
| TimeoutConfig | 超时配置序列化 | `__tests__/TimeoutConfig.test.ts` |
| ApprovalConfig | 审批配置序列化 | `__tests__/ApprovalConfig.test.ts` |

### 8.2 组件测试

| 组件 | 测试内容 | 文件 |
|------|---------|------|
| PipelineCanvas | 节点渲染、连线、拖拽 | `__tests__/PipelineCanvas.test.tsx` |
| StageModal | 各 Tab 渲染、表单验证 | `__tests__/StageModal.test.tsx` |
| PipelineMonitor | 数据统计、图表渲染 | `__tests__/PipelineMonitor.test.tsx` |
| TriggerConfig | 触发器 CRUD | `__tests__/TriggerConfig.test.tsx` |

### 8.3 集成测试

| 场景 | 测试内容 |
|------|---------|
| 创建 Pipeline → 运行 → 查看日志 | 完整端到端流程 |
| 编辑 Pipeline → 保存版本 → 回滚 | 版本管理流程 |
| 模板选择 → 创建 Pipeline → 运行 | 模板实例化流程 |
| 配置触发器 → 模拟 Webhook → 自动运行 | 触发器流程 |

---

## 9. 迁移计划

### 9.1 不影响现有功能

所有新增功能均为**新增页面和新接口**，不修改现有页面和 API 的行为。

### 9.2 Canvas 兼容

- PipelineEditor 同时支持列表模式（StageItem + dnd-kit）和画布模式（ReactFlow）
- 通过 Segmented 切换：`[列表视图] [画布视图]`
- 两种模式共享同一个 `stages` 状态
- 画布模式设为默认（用户可切回列表）

### 9.3 渐进上线

| 阶段 | 新增功能 | 风险控制 |
|------|---------|---------|
| Phase 1 | Canvas 打通、StageModal 增强、CRUD 修复、监控面板 | 旧编辑器保留，Canvas 可选 |
| Phase 2 | 触发器配置、环境变量、部署策略、IM 通知 | 各功能独立页面，不影响现有编辑器 |
| Phase 3 | 插件注册、模板市场、自定义字段 | 扩展点独立，不影响核心逻辑 |

---

## 10. 成功标准

### Phase 1 成功标准

- [ ] PipelineCanvas 可作为编辑器主画布使用（ReactFlow 拖拽编辑）
- [ ] StageModal 新增 3 个 Tab（超时、审批、质量门禁）并正常工作
- [ ] PipelineList 有编辑入口，操作列按钮可点击
- [ ] PipelineRunList 有取消/重试按钮，点击后有确认和反馈
- [ ] PipelineMonitor 页面可展示统计数据
- [ ] TypeScript 编译无新增错误
- [ ] 新增测试覆盖率 ≥ 80%

### Phase 2 成功标准

- [ ] TriggerConfig 页面可创建/编辑/删除 3 种触发器
- [ ] EnvironmentManager 页面可管理环境变量和变量
- [ ] Deploy Stage 可配置部署策略
- [ ] NotificationConfig 页面可配置通知渠道和规则
- [ ] 所有新页面 TypeScript 编译通过

### Phase 3 成功标准

- [ ] StageTypeRegistry 可注册/查询 Stage 类型
- [ ] 至少 6 个内置 Stage 类型通过插件方式注册
- [ ] 第三方 Stage 类型可成功注册并在编辑器中显示
- [ ] TemplateMarket 页面可浏览/预览/使用模板
- [ ] 用户可将 Pipeline 保存为模板
- [ ] 自定义字段可在 Stage 配置中展示和编辑
