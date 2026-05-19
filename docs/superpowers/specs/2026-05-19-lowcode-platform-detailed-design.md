# 低代码能力配置平台 - 16个模块详细设计方案

## 文档概述

本文档为 16 个需要改造的模块提供详细的低代码能力设计方案，包含：
- 概念设计（低代码形态、配置模型）
- 详细 UI 布局（可视化编辑器界面）
- 数据结构定义
- 交互流程说明

---

## 模块总览

| 序号 | 模块 | 低代码形态 | 优先级 |
|------|------|-----------|--------|
| 1 | 告警规则 | 规则型 | P0 |
| 2 | 审批流程 | 工作流型 | P0 |
| 3 | 工单工作流 | 工作流型 | P1 |
| 4 | 监控仪表盘 | 可视化构建型 | P1 |
| 5 | 分支策略 | 规则型 | P1 |
| 6 | 升级策略 | 规则型 | P2 |
| 7 | 降级规则 | 规则型 | P2 |
| 8 | 数据管道 | 可视化构建型 | P2 |
| 9 | 策略管理 | 规则型 | P2 |
| 10 | 自愈策略 | 规则型 | P2 |
| 11 | 混沌实验 | 可视化构建型 | P2 |
| 12 | 数字孪生 | 规则型 | P2 |
| 13 | 知识库分类 | 模板型 | P2 |
| 14 | 通知规则 | 模板型 | P2 |
| 15 | 质量门禁 | 规则型 | P2 |
| 16 | 部署策略 | 模板型 | P2 |

---

## 模块1：告警规则（Alert Rules）

### 1.1 概念设计

**低代码形态**：规则型（IFTTT 风格）

**配置模型**：
```
告警规则 = 条件 + 动作 + 元信息

条件 = 指标 + 操作符 + 阈值 + 持续时间
动作 = 通知渠道 + 通知对象 + 消息模板
元信息 = 名称 + 标签 + 严重级别 + 生效时间
```

**配置示例**：
```
IF CPU使用率 > 80% 持续 5分钟
THEN 发送钉钉消息到运维群 + 创建工单
严重级别: warning
```

### 1.2 详细 UI 布局

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  告警规则编辑器                                                [保存] [测试] │
├─────────────────────────────────────────────────────────────────────────────┤
│  基本信息                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 规则名称: [请输入规则名称                                    ]       │   │
│  │ 描述:     [可选描述                                           ]       │   │
│  │ 标签:     [+ 添加标签                              ]                 │   │
│  │ 严重级别: ● Critical  ○ Warning  ○ Info                         │   │
│  │ 启用状态: ○ 启用  ● 禁用                                         │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────────────────┤
│  触发条件                                    [+ 添加条件]                  │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 指标: [CPU使用率          ▼]  操作符: [>              ▼]           │   │
│  │ 阈值: [80      ] %        持续时间: [5    ] 分钟                   │   │
│  │                                                   [删除条件]        │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ AND 组合: [请选择] ▼                                               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────────────────┤
│  告警动作                                    [+ 添加动作]                  │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 动作类型: [发送通知          ▼]                                   │   │
│  │ 渠道:     [钉钉   ] [企业微信] [飞书] [邮件]                       │   │
│  │ 通知对象: [运维组 ▼]                                               │   │
│  │ 消息模板: [选择模板 ▼] 或 [自定义]                                │   │
│  │ ────────────────────────────────────────────────────────────────    │   │
│  │ 消息预览:                                                          │   │
│  │ 【告警通知】                                                        │   │
│  │ 规则: {rule_name}                                                 │   │
│  │ 指标: {metric} = {value}                                         │   │
│  │ 时间: {timestamp}                                                 │   │
│  │                                                    [删除动作]       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────────────────┤
│  高级设置                                                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 聚合窗口: [1    ] 分钟  静默期: [10   ] 分钟                        │   │
│  │ 生效时间: ○ 始终生效  ● 自定义时间范围                             │   │
│  │            [选择日期范围]                                          │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.3 数据结构

```typescript
interface AlertRuleConfig {
  // 基本信息
  id: string;
  name: string;
  description?: string;
  labels: Record<string, string>;
  severity: 'critical' | 'warning' | 'info';
  enabled: boolean;

  // 触发条件
  conditions: AlertCondition[];
  conditionLogic: 'AND' | 'OR';

  // 告警动作
  actions: AlertAction[];

  // 高级设置
  evaluationInterval: number;  // 分钟
  silencePeriod: number;       // 分钟
  validTimeRange?: {
    start: string;
    end: string;
  };
}

interface AlertCondition {
  metric: string;
  operator: '>' | '<' | '>=' | '<=' | '==' | '!=' | 'contains';
  threshold: number | string;
  duration: number;  // 分钟
}

interface AlertAction {
  type: 'notify' | 'webhook' | 'ticket' | 'auto_scale' | 'self_healing';
  config: Record<string, any>;
}
```

---

## 模块2：审批流程（Approval Workflow）

### 2.1 概念设计

**低代码形态**：工作流型（流程编排）

**配置模型**：
```
审批流程 = 节点 + 连接 + 条件

节点 = 开始 → 审批节点 → 条件分支 → 通知节点 → 结束
连接 = 节点之间的流向
条件 = 分支条件的判断逻辑
```

**配置示例**：
```
开始 → 主管审批(用户A) → [金额>10000?] 
       ├─ 是 → 部门经理审批(用户B) → 通知申请人 → 结束
       └─ 否 → 通知申请人 → 结束
```

### 2.2 详细 UI 布局

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  审批流程编辑器                                            [保存] [发布]    │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    [开始]                                          │   │
│  │                       │                                            │   │
│  │                       ▼                                            │   │
│  │              ┌──────────────┐                                      │   │
│  │              │  审批节点1   │ ← 点击编辑                           │   │
│  │              │  主管审批    │                                      │   │
│  │              │  (用户A)     │                                      │   │
│  │              └──────┬───────┘                                      │   │
│  │                     │                                              │   │
│  │                     ▼                                              │   │
│  │              条件分支                                              │   │
│  │           ┌──────┴──────┐                                         │   │
│  │           │ 金额>10000? │                                         │   │
│  │           └──────┬──────┘                                         │   │
│  │          是 ↙    ↘ 否                                            │   │
│  │     ┌────────┐      ┌────────┐                                    │   │
│  │     │审批节点2│      │通知节点│                                    │   │
│  │     │部门经理 │      │通知申请人│                                   │   │
│  │     └────┬───┘      └────┬───┘                                    │   │
│  │          └───────→┬←─────┘                                        │   │
│  │                  ▼                                                │   │
│  │             [结束]                                                 │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────────────────┤
│  节点属性面板 (选中"审批节点1"时显示)                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 节点类型: 审批节点                                                  │   │
│  │ 节点名称: [主管审批                                       ]        │   │
│  │ 审批人:   [指定用户  ▼] [指定角色 ▼] [动态选择 ▼]                   │   │
│  │           [选择用户...]                                            │   │
│  │ 审批方式: ○ 或签 (一人通过即可)  ● 会签 (全部通过)                  │   │
│  │ 超时设置: [24  ] 小时超时  超时后: [自动通过 ▼]                     │   │
│  │ 驳回设置: ○ 驳回到发起人  ● 驳回到上一步                           │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.3 数据结构

```typescript
interface ApprovalWorkflowConfig {
  id: string;
  name: string;
  description?: string;
  version: number;
  enabled: boolean;

  // 流程定义
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  
  // 元数据
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

interface WorkflowNode {
  id: string;
  type: 'start' | 'approval' | 'condition' | 'notification' | 'webhook' | 'end';
  position: { x: number; y: number };
  config: ApprovalNodeConfig | ConditionNodeConfig | NotificationNodeConfig;
}

interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  condition?: string;  // 条件分支的条件表达式
}

interface ApprovalNodeConfig {
  approverType: 'user' | 'role' | 'dynamic';
  approverIds?: string[];
  approvalType: 'or' | 'and';  // 或签/会签
  timeout: number;  // 小时
  timeoutAction: 'approve' | 'reject' | 'escalate';
  rejectAction: 'to_initiator' | 'to_previous';
}

interface ConditionNodeConfig {
  expression: string;  // 条件表达式，如: "${amount} > 10000"
  branches: Array<{
    name: string;
    condition: string;
  }>;
}

interface NotificationNodeConfig {
  template: string;
  channels: Array<'dingtalk' | 'wecom' | 'feishu' | 'email'>;
  receivers: Array<{ type: 'user' | 'role' | 'variable'; value: string }>;
}
```

---

## 模块3：工单工作流（Ticket Workflow）

### 3.1 概念设计

**低代码形态**：工作流型（与审批流程类似，但侧重工单生命周期）

**配置模型**：
```
工单流程 = 状态机 + 触发器 + 自动动作

状态机 = 新建 → 处理中 → 已解决 → 已关闭
触发器 = 事件 → 动作 (如：创建时自动分配)
自动动作 = 条件满足时自动执行
```

### 3.2 详细 UI 布局

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  工单流程编辑器                                              [保存] [测试]  │
├─────────────────────────────────────────────────────────────────────────────┤
│  流程名称: [工单处理流程                                    ]             │
│  适用类型: [选择工单类型                          ▼]                     │
├─────────────────────────────────────────────────────────────────────────────┤
│  状态机设计                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │    ┌──────┐     ┌──────────┐     ┌──────────┐     ┌────────┐     │   │
│  │    │ 新建 │ ──→ │ 处理中   │ ──→ │ 已解决   │ ──→ │ 已关闭 │     │   │
│  │    └──────┘     └──────────┘     └──────────┘     └────────┘     │   │
│  │      │               │               │               │            │   │
│  │      ▼               ▼               ▼               ▼            │   │
│  │   [添加状态]      [添加状态]      [添加状态]      [添加状态]        │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────────────────┤
│  自动动作配置                                    [+ 添加自动动作]           │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 触发事件: [工单创建                    ▼]                           │   │
│  │ 条件:     [工单类型 = 'Bug'          ]                             │   │
│  │ 执行动作: [自动分配] → 分配给: [轮询分配] ▼                         │   │
│  │                                                   [删除]           │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────────────────┤
│  状态转移规则                                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 从 [处理中] → 到 [已解决]                                          │   │
│  │ 需要: □ 上传附件  □ 填写解决说明  □ 关联代码                        │   │
│  │ 自动关闭: ○ 是  ● 否                                               │   │
│  │ 自动关闭时间: [  3  ] 天后                                         │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 模块4：监控仪表盘（Monitoring Dashboard）

### 4.1 概念设计

**低代码形态**：可视化构建型（拖拽式）

**配置模型**：
```
仪表盘 = 布局 + 组件 + 数据源

布局 = 网格系统 (12列)
组件 = 折线图 | 柱状图 | 饼图 | 表格 | 告警状态 | 指标卡
数据源 = 查询语句 + 刷新间隔 + 时间范围
```

### 4.2 详细 UI 布局

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  仪表盘构建器                                              [保存] [预览]  │
├─────────────────────────────────────────────────────────────────────────────┤
│  组件面板                              │  画布区域                           │
│  ┌────────────────────────────────┐  │  ┌──────────────────────────────┐   │
│  │ [📊 折线图] [📊 柱状图]       │  │  │     指标卡 (1x1)            │   │
│  │ [📊 饼图]   [📊 表格]        │  │  │  CPU: 45%                    │   │
│  │ [⚠️ 告警状态] [📈 趋势图]    │  │  ├──────────────────────────────┤   │
│  │ [🗓️ 时间选择] [🎯 目标]     │  │  │     折线图 (2x2)            │   │
│  └────────────────────────────────┘  │  │                              │   │
│                                      │  │  ─────────────────────       │   │
│  数据源配置                           │  │                              │   │
│  ┌────────────────────────────────┐  │  │                              │   │
│  │ 查询: [promql...]             │  │  ├──────────────────────────────┤   │
│  │ 刷新: [30秒 ▼]                │  │  │     表格 (2x1)              │   │
│  └────────────────────────────────┘  │  │                              │   │
│                                      │  └──────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────────────────┤
│  组件属性 (选中折线图时显示)                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 标题: [CPU使用率趋势                              ]                 │   │
│  │ 数据源: [选择数据源 ▼]                                           │   │
│  │ 查询语句: [rate(container_cpu_usage_seconds_total[5m])]           │   │
│  │ Y轴单位: [%    ]  图表颜色: [选择颜色]                           │   │
│  │ 图例: ☑ 显示  ☑ 底部  堆叠: ○ 是  ● 否                          │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 模块5：分支策略（Branch Policy）

### 5.1 概念设计

**低代码形态**：规则型

**配置模型**：
```
分支策略 = 保护规则 + 合并条件 + 自动操作

保护规则 = 分支名模式 + 需要审批 + 需要通过检查
合并条件 = 必须通过 CI + 必须审批 + 状态检查
自动操作 = 自动合并 + 自动删除分支
```

### 5.2 详细 UI 布局

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  分支策略编辑器                                              [保存]        │
├─────────────────────────────────────────────────────────────────────────────┤
│  基本信息                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 策略名称: [生产环境保护                              ]             │   │
│  │ 仓库范围: [所有仓库 ▼]  或 [选择仓库...]                         │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────────────────┤
│  保护规则                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 分支模式: [main] 支持通配符: [*/main, release/*]                   │   │
│  │                                                                     │   │
│  │ ☑ 禁止强制推送                                                       │   │
│  │ ☑ 禁止删除                                                          │   │
│  │ ☑ 必须管理员才能推送                                                │   │
│  │ ☐ 允许创建临时分支                                                  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────────────────┤
│  合并条件                                    [+ 添加条件]                  │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ ☑ 必须通过 CI 检查                                                   │   │
│  │    检查项: [全部检查 ▼]  允许失败: [0  ] 项                         │   │
│  │                                                                     │   │
│  │ ☑ 必须获得审批                                                      │   │
│  │    审批人: [至少 1 人]  角色要求: [至少 1 管理员]                  │   │
│  │                                                                     │   │
│  │ ☑ 代码审查通过                                                      │   │
│  │    需要 [2] 人批准  允许自批: ○ 是  ● 否                            │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────────────────┤
│  自动操作                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ ☐ 合并后自动删除源分支                                              │   │
│  │ ☐ 合并后自动打标签                                                  │   │
│  │ ☐ 冲突时自动变基                                                    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 模块6-16：简略设计

### 模块6：升级策略（Escalation）

```
┌─────────────────────────────────────────────────┐
│  升级策略编辑器                                 │
├─────────────────────────────────────────────────┤
│  触发条件: 告警未确认超过 [30] 分钟             │
│                                                 │
│  升级路线:                                      │
│  Level 1 → Level 2 → Level 3 → Level 4        │
│    ↓         ↓         ↓         ↓            │
│  单人通知 → 群组通知 → 值班主管 → 总监         │
│                                                 │
│  每次升级间隔: [30] 分钟                        │
└─────────────────────────────────────────────────┘
```

### 模块7：降级规则（Degradation）

```
┌─────────────────────────────────────────────────┐
│  降级规则编辑器                                 │
├─────────────────────────────────────────────────┤
│  服务选择: [选择服务              ▼]            │
│                                                 │
│  降级条件:                                      │
│  指标: [错误率     ] 阈值: [5]%                │
│  持续: [3] 分钟                                 │
│                                                 │
│  降级动作:                                      │
│  ☑ 减少流量 [50]%                              │
│  ☑ 开启熔断                                      │
│  ☑ 切换到备用服务                               │
│                                                 │
│  恢复条件:                                      │
│  指标: [错误率  ] < [1]% 持续 [5] 分钟         │
└─────────────────────────────────────────────────┘
```

### 模块8：数据管道（Data Pipeline）

```
┌─────────────────────────────────────────────────┐
│  数据管道构建器 (拖拽式节点编排)                 │
├─────────────────────────────────────────────────┤
│  节点: [源] → [处理] → [转换] → [目标]        │
│                                                 │
│  ┌───┐   ┌───┐   ┌───┐   ┌───┐                │
│  │源│───▶│处理│───▶│转换│───▶│目标│                │
│  │数│   │过滤│   │聚合│   │ES  │                │
│  │据│   │   │   │   │   │    │                │
│  └───┘   └───┘   └───┘   └───┘                │
│                                                 │
│  节点配置面板 (选中处理节点):                   │
│  类型: 过滤                                      │
│  条件: age > 30                                 │
└─────────────────────────────────────────────────┘
```

### 模块9-16：使用统一规则编辑器模板

对于以下模块，使用统一的规则编辑器UI：
- 策略管理 (Policy)
- 自愈策略 (Self-Healing)
- 混沌实验 (Chaos)
- 数字孪生 (Digital Twin)
- 知识库分类 (Knowledge)
- 通知规则 (Notification)
- 质量门禁 (Quality Gate)
- 部署策略 (Deployment)

**统一规则编辑器布局**：
```
┌─────────────────────────────────────────────────┐
│  {模块名}编辑器                                 │
├─────────────────────────────────────────────────┤
│  基本信息                                       │
│  名称: [                    ]                   │
│  描述: [                    ]                   │
├─────────────────────────────────────────────────┤
│  条件配置 (IF)                                  │
│  ┌─────────────────────────────────────────┐   │
│  │ 指标/属性: [选择]                        │   │
│  │ 操作符: [>]                              │   │
│  │ 阈值/值: [    ]                          │   │
│  │ 组合方式: AND  OR                        │   │
│  └─────────────────────────────────────────┘   │
├─────────────────────────────────────────────────┤
│  动作配置 (THEN)                                │
│  ┌─────────────────────────────────────────┐   │
│  │ 动作类型: [选择]                          │   │
│  │ 动作参数: [配置...]                      │   │
│  └─────────────────────────────────────────┘   │
├─────────────────────────────────────────────────┤
│  [保存]  [测试]  [启用/禁用]                    │
└─────────────────────────────────────────────────┘
```

---

## 统一低代码平台架构

### 核心组件复用

所有16个模块共享以下统一组件：

```typescript
// 统一的基础组件
interface LowCodeComponents {
  // 条件构建器
  ConditionBuilder: {
    fields: FieldDefinition[];
    operators: Operator[];
    combinators: ('AND' | 'OR')[];
  };

  // 表单构建器
  FormBuilder: {
    types: ('string' | 'number' | 'boolean' | 'select' | 'json' | 'code')[];
    layout: ('horizontal' | 'vertical' | 'inline')[];
  };

  // 流程编辑器
  WorkflowEditor: {
    nodeTypes: NodeType[];
    edgeTypes: EdgeType[];
  };

  // 图表构建器
  ChartBuilder: {
    chartTypes: ('line' | 'bar' | 'pie' | 'table' | 'metric')[];
    dataSources: DataSource[];
  };
}
```

---

## 实施建议

### 实施优先级与工作量

| 模块 | 优先级 | 工作量 | 复杂度 |
|------|--------|--------|--------|
| 告警规则 | P0 | 3人日 | 中 |
| 审批流程 | P0 | 4人日 | 高 |
| 工单工作流 | P1 | 4人日 | 高 |
| 监控仪表盘 | P1 | 5人日 | 高 |
| 分支策略 | P1 | 2人日 | 低 |
| 升级策略 | P2 | 2人日 | 低 |
| 降级规则 | P2 | 2人日 | 中 |
| 数据管道 | P2 | 4人日 | 高 |
| 策略管理 | P2 | 2人日 | 低 |
| 自愈策略 | P2 | 3人日 | 中 |
| 混沌实验 | P2 | 3人日 | 中 |
| 数字孪生 | P2 | 2人日 | 低 |
| 知识库分类 | P2 | 1人日 | 低 |
| 通知规则 | P2 | 1人日 | 低 |
| 质量门禁 | P2 | 2人日 | 低 |
| 部署策略 | P2 | 2人日 | 低 |

### 技术选型建议

| 组件 | 推荐方案 | 原因 |
|------|---------|------|
| 流程图/工作流 | React Flow | 功能强大，文档完善 |
| 图表 | ECharts / Recharts | 组件丰富 |
| 表单 | @formily/react | 支持可视化配置 |
| 拖拽排序 | @dnd-kit | 轻量易用 |
| 条件构建器 | 自研 | 业务特定 |

---

## 附录A：统一低代码平台底层架构设计

### A.1 架构设计原则

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         低代码平台架构设计原则                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. 插件化接入 (Plugin-based)                                               │
│     └── 每个业务模块作为插件接入，无需修改核心引擎                           │
│                                                                             │
│  2. 声明式配置 (Declarative)                                                │
│     └── 用户配置存储为声明式 JSON，而非代码生成                              │
│                                                                             │
│  3. 运行时解释 (Runtime Interpretation)                                     │
│     └── 配置在运行时解释执行，支持热更新，无需重新部署                       │
│                                                                             │
│  4. 版本化管理 (Versioned)                                                  │
│     └── 所有配置版本化，支持回滚和审计                                       │
│                                                                             │
│  5. 沙箱执行 (Sandbox)                                                      │
│     └── 用户逻辑在沙箱中执行，保障系统安全                                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### A.2 核心架构分层

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          低代码平台技术架构                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                      用户交互层 (Presentation)                      │    │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐  │    │
│  │  │ 模板中心    │ │ 规则编辑器  │ │ 流程编辑器  │ │ 可视化构建  │  │    │
│  │  │ Template    │ │ Rule Editor │ │Flow Editor  │ │   Builder   │  │    │
│  │  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘  │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                      配置解析层 (Parser)                             │    │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐  │    │
│  │  │ 模板解析器  │ │ 规则解析器  │ │ 流程解析器  │ │ 图表解析器  │  │    │
│  │  │   Parser    │ │   Parser    │ │   Parser    │ │   Parser    │  │    │
│  │  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘  │    │
│  │                                                                      │    │
│  │  输出: AST (抽象语法树) / Validation Result                         │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                      核心引擎层 (Engine)                             │    │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐  │    │
│  │  │  模板引擎   │ │  规则引擎   │ │  工作流引擎 │ │  执行引擎   │  │    │
│  │  │Template Eng │ │  Rule Eng   │ │Workflow Eng │ │ Execute Eng │  │    │
│  │  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘  │    │
│  │                                                                      │    │
│  │  输出: Execution Plan / Event / State Change                        │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                      插件适配层 (Adapter)                            │    │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐  │    │
│  │  │ 告警适配器  │ │ 审批适配器  │ │ 工单适配器  │ │ 监控适配器  │  │    │
│  │  │Alert Adapter│ │Approval Adp │ │ Ticket Adp  │ │Monitor Adp  │  │    │
│  │  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘  │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                      基础设施层 (Infrastructure)                    │    │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐  │    │
│  │  │ 配置存储    │ │ 消息队列    │ │ 审计日志    │ │ 权限控制    │  │    │
│  │  │ PostgreSQL  │ │    Kafka    │ │   Logger    │ │    RBAC     │  │    │
│  │  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘  │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### A.3 核心引擎设计

#### A.3.1 规则引擎 (Rule Engine)

```typescript
// 规则引擎核心接口
interface RuleEngine {
  // 编译规则
  compile(rule: RuleDefinition): CompiledRule;

  // 执行规则
  execute(rule: CompiledRule, context: ExecutionContext): ExecutionResult;

  // 批量执行规则集
  executeAll(rules: CompiledRule[], context: ExecutionContext): ExecutionResult[];

  // 规则验证
  validate(rule: RuleDefinition): ValidationResult;
}

// 规则定义结构
interface RuleDefinition {
  id: string;
  name: string;
  version: number;
  condition: ConditionExpression;
  actions: ActionDefinition[];
  metadata?: Record<string, any>;
}

// 条件表达式支持
interface ConditionExpression {
  // 支持 JSON Logic 标准
  // 参考: https://jsonlogic.com/
  // 示例: {"and": [
  //   {">": [{"var": "cpu"}, 80]},
  //   {">=": [{"var": "duration"}, 5]}
  // ]}
  logic: any;
}

// 规则执行上下文
interface ExecutionContext {
  // 触发数据
  data: Record<string, any>;

  // 变量上下文
  variables: Record<string, any>;

  // 执行选项
  options: {
    dryRun?: boolean;      // 试运行，不实际执行动作
    trace?: boolean;       // 是否记录执行轨迹
    timeout?: number;      // 执行超时时间(ms)
  };

  // 触发源信息
  source: {
    type: 'event' | 'schedule' | 'manual';
    timestamp: string;
    userId?: string;
  };
}

// 规则执行结果定义
interface ExecutionResult {
  success: boolean;
  output?: Record<string, any>;
  errors?: Array<{
    code: string;
    message: string;
    path?: string;
  }>;
  executionTime: number;  // 毫秒
  actionsExecuted: string[];  // 已执行的动作ID列表
  trace?: Array<{
    step: string;
    timestamp: string;
    data?: Record<string, any>;
  }>;  // 执行轨迹，仅 trace=true 时返回
}

// 编译后的规则
interface CompiledRule {
  id: string;
  version: number;
  conditionAST: any;  // 条件表达式编译后的 AST
  actions: ActionDefinition[];
}

// 动作定义
interface ActionDefinition {
  id: string;
  type: string;
  config: Record<string, any>;
}
```

#### A.3.2 工作流引擎 (Workflow Engine)

```typescript
// 工作流引擎核心接口
// 注意：审批节点使用 ApprovalFlowEngine（来自 ChatOps 文档 2.9 系统级通用审批流程引擎）
// WorkflowEngine 仅负责非审批类流程（如数据流水线、自动化任务、配置变更等）
interface WorkflowEngine {
  // 创建工作流实例
  createInstance(workflowId: string, input: Record<string, any>): WorkflowInstance;

  // 执行工作流
  execute(instanceId: string): Promise<ExecutionResult>;

  // 暂停工作流
  suspend(instanceId: string): Promise<void>;

  // 恢复工作流
  resume(instanceId: string): Promise<void>;

  // 终止工作流
  terminate(instanceId: string, reason?: string): Promise<void>;

  // 获取工作流状态
  getState(instanceId: string): WorkflowState;
}

// 工作流实例
interface WorkflowInstance {
  id: string;
  workflowId: string;
  status: 'pending' | 'running' | 'suspended' | 'completed' | 'failed' | 'terminated';
  currentNodeId: string;
  variables: Record<string, any>;
  history: WorkflowHistory[];
  createdAt: string;
  updatedAt: string;
}

// 工作流历史记录
interface WorkflowHistory {
  nodeId: string;
  action: 'enter' | 'execute' | 'exit' | 'error';
  timestamp: string;
  data?: Record<string, any>;
  error?: string;
}
```

#### A.3.3 模板引擎 (Template Engine)

```typescript
// 模板引擎核心接口
interface TemplateEngine {
  // 渲染模板
  render(template: TemplateDefinition, variables: Record<string, any>): string;

  // 验证模板
  validate(template: TemplateDefinition): ValidationResult;

  // 预览模板
  preview(template: TemplateDefinition, sampleData: Record<string, any>): PreviewResult;
}

// 模板定义
interface TemplateDefinition {
  id: string;
  name: string;
  category: string;        // 模板分类
  version: number;
  content: string;         // 模板内容 (Handlebars/Jinja2 语法)
  variables: VariableDefinition[];
  outputFormat: 'json' | 'yaml' | 'text' | 'pipeline';
}
```

### A.4 插件接入机制

```typescript
// 插件接口定义（前后端分离）

// 前端配置接口
interface LowCodePluginFrontend {
  readonly pluginId: string;
  readonly name: string;
  readonly version: string;

  // 获取配置 Schema（用于前端表单生成）
  getConfigSchema(): ConfigSchema;

  // 获取编辑器组件配置
  getEditorConfig(): {
    componentType: 'rule' | 'workflow' | 'template' | 'builder';
    props: Record<string, any>;
  };

  // 前端验证
  validateConfig(config: any): ValidationResult;
}

// 后端执行接口
interface LowCodePluginBackend {
  readonly pluginId: string;
  readonly version: string;

  // 执行配置
  execute(config: any, context: ExecutionContext): Promise<ExecutionResult>;

  // 后端验证（安全验证）
  validateExecution(config: any): Promise<ValidationResult>;

  // 获取可用的模板/规则列表
  getAvailableItems(): Promise<PluginItem[]>;
}

// 完整插件接口（组合前后端）
interface LowCodePlugin extends LowCodePluginFrontend, LowCodePluginBackend {
  readonly type: 'template' | 'rule' | 'workflow' | 'builder';
}

// 插件注册中心
class PluginRegistry {
  private plugins: Map<string, LowCodePlugin> = new Map();

  // 注册插件
  register(plugin: LowCodePlugin): void;

  // 注销插件
  unregister(pluginId: string): void;

  // 获取插件
  get(pluginId: string): LowCodePlugin | undefined;

  // 获取所有插件
  getAll(): LowCodePlugin[];

  // 按类型获取插件
  getByType(type: LowCodePlugin['type']): LowCodePlugin[];
}

// 插件示例: 告警规则插件
class AlertRulePlugin implements LowCodePlugin {
  readonly pluginId = 'alert-rule';
  readonly name = '告警规则';
  readonly version = '1.0.0';
  readonly type = 'rule';

  getConfigSchema() {
    return {
      type: 'object',
      properties: {
        name: { type: 'string', required: true },
        condition: { type: 'condition', required: true },
        actions: { type: 'array', items: { type: 'action' } },
        severity: { type: 'string', enum: ['critical', 'warning', 'info'] },
        enabled: { type: 'boolean', default: true },
      },
    };
  }

  async execute(config: any, context: ExecutionContext): Promise<ExecutionResult> {
    // 调用告警服务执行
    const alertService = context.services.get('alert');
    return await alertService.createAlert(config, context);
  }
}
```

### A.5 配置存储设计

```sql
-- 低代码配置统一存储表

-- 1. 配置主表
CREATE TABLE lowcode_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    plugin_id VARCHAR(100) NOT NULL,           -- 插件标识
    config_name VARCHAR(200) NOT NULL,          -- 配置名称
    config_type VARCHAR(50) NOT NULL,           -- template/rule/workflow/builder
    config_version INTEGER NOT NULL DEFAULT 1,  -- 版本号
    config_json JSONB NOT NULL,                 -- 配置内容 (JSON)
    status VARCHAR(20) NOT NULL DEFAULT 'draft', -- draft/published/archived
    created_by UUID NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_by UUID,
    updated_at TIMESTAMP,
    published_at TIMESTAMP,
    UNIQUE(tenant_id, plugin_id, config_name, config_version)
);

-- 2. 配置版本历史
CREATE TABLE lowcode_config_version (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_id UUID NOT NULL REFERENCES lowcode_config(id),
    config_version INTEGER NOT NULL,
    config_json JSONB NOT NULL,
    change_summary VARCHAR(500),
    created_by UUID NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 3. 执行日志
CREATE TABLE lowcode_execution_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_id UUID NOT NULL REFERENCES lowcode_config(id),
    instance_id VARCHAR(100),                   -- 执行实例ID
    execution_type VARCHAR(20) NOT NULL,        -- execute/preview/validate
    status VARCHAR(20) NOT NULL,                -- success/failed/timeout
    input_data JSONB,
    output_data JSONB,
    error_message TEXT,
    execution_time_ms INTEGER,
    executed_by UUID,
    executed_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 4. 索引
CREATE INDEX idx_lowcode_config_tenant_plugin ON lowcode_config(tenant_id, plugin_id);
CREATE INDEX idx_lowcode_config_status ON lowcode_config(status);
CREATE INDEX idx_lowcode_execution_log_config ON lowcode_execution_log(config_id, executed_at);
```

### A.6 统一组件库

```typescript
// 可复用的低代码组件接口

// 1. 条件构建器
interface ConditionBuilderProps {
  fields: FieldDefinition[];
  value: ConditionExpression;
  onChange: (value: ConditionExpression) => void;
  readOnly?: boolean;
}

// 2. 表单构建器
interface FormBuilderProps {
  schema: JSONSchema7;
  initialValues?: Record<string, any>;
  onChange?: (values: Record<string, any>) => void;
  readOnly?: boolean;
}

// 3. 流程编辑器
interface FlowEditorProps {
  nodes: FlowNode[];
  edges: FlowEdge[];
  onNodesChange: (nodes: FlowNode[]) => void;
  onEdgesChange: (edges: FlowEdge[]) => void;
  nodeTypes?: Record<string, React.ComponentType>;
  readOnly?: boolean;
}

// 4. 可视化图表构建器
interface ChartBuilderProps {
  chartType: 'line' | 'bar' | 'pie' | 'table' | 'metric';
  config: ChartConfig;
  onChange: (config: ChartConfig) => void;
  previewData?: any[];
}

// 5. 统一验证器
interface ValidationResult {
  valid: boolean;
  errors: Array<{
    path: string;
    message: string;
    severity: 'error' | 'warning';
  }>;
}

// 6. 实时预览组件
interface PreviewPanelProps {
  config: any;
  previewType: 'form' | 'json' | 'result';
  sampleData?: Record<string, any>;
}
```

---

## 附录B：与现有系统集成方案

### B.1 集成架构总览

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          与现有系统集成架构                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                        低代码平台 (新增)                             │    │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐  │    │
│  │  │  配置存储   │ │  核心引擎   │ │  插件适配   │ │  执行调度   │  │    │
│  │  │  Repository │ │   Engine    │ │  Adapter    │ │  Scheduler  │  │    │
│  │  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘  │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                        │
│                          ┌─────────┴─────────┐                              │
│                          │      事件总线      │                              │
│                          │      EventBus     │                              │
│                          └─────────┬─────────┘                              │
│                                    │                                        │
│         ┌──────────────────────────┼──────────────────────────┐            │
│         │                          │                          │            │
│         ▼                          ▼                          ▼            │
│  ┌─────────────┐          ┌─────────────┐          ┌─────────────┐        │
│  │  告警系统   │          │  工单系统   │          │  审批系统   │        │
│  │  Alert Svc  │          │  Ticket Svc │          │ Approval Svc│        │
│  └─────────────┘          └─────────────┘          └─────────────┘        │
│                                                                             │
│         │                          │                          │            │
│         ▼                          ▼                          ▼            │
│  ┌─────────────┐          ┌─────────────┐          ┌─────────────┐        │
│  │  监控系统   │          │  流水线系统 │          │  通知系统   │        │
│  │  Monitor    │          │  Pipeline   │          │ Notification│        │
│  └─────────────┘          └─────────────┘          └─────────────┘        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### B.2 集成模式

#### B.2.1 事件驱动集成

```typescript
// 1. 定义低代码事件类型
type LowCodeEventType =
  | 'config.created'      // 配置创建
  | 'config.updated'      // 配置更新
  | 'config.published'    // 配置发布
  | 'config.deleted'      // 配置删除
  | 'rule.triggered'      // 规则触发
  | 'rule.executed'       // 规则执行
  | 'workflow.started'    // 工作流启动
  | 'workflow.completed'  // 工作流完成
  | 'workflow.failed';    // 工作流失败

// 2. 事件发布接口
interface LowCodeEventPublisher {
  publish(event: LowCodeEvent): Promise<void>;
  subscribe(eventType: LowCodeEventType, handler: EventHandler): void;
}

// 3. 事件格式
interface LowCodeEvent {
  id: string;
  type: LowCodeEventType;
  source: {
    pluginId: string;
    configId: string;
    configName: string;
  };
  payload: Record<string, any>;
  timestamp: string;
  tenantId: string;
}
```

#### B.2.2 服务调用集成

```typescript
// 1. 集成适配器接口
interface IntegrationAdapter<T = any> {
  // 调用现有服务
  call(service: string, method: string, params: any): Promise<T>;

  // 订阅事件
  on(event: string, handler: Function): void;

  // 发布事件
  emit(event: string, data: any): void;
}

// 2. 服务工厂模式（替代简单的 switch case）
interface ServiceClient {
  readonly serviceName: string;
  call(method: string, params: any): Promise<any>;
}

interface ServiceAdapterFactory {
  createClient(serviceName: string): ServiceClient | undefined;
  register(serviceName: string, factory: () => ServiceClient): void;
}

// 服务注册中心
class ServiceRegistry implements ServiceAdapterFactory {
  private factories: Map<string, () => ServiceClient> = new Map();

  register(serviceName: string, factory: () => ServiceClient): void {
    this.factories.set(serviceName, factory);
  }

  createClient(serviceName: string): ServiceClient | undefined {
    const factory = this.factories.get(serviceName);
    return factory ? factory() : undefined;
  }
}

// 现有系统服务适配器
class ExistingSystemAdapter implements IntegrationAdapter {
  private serviceClients: Map<string, ServiceClient> = new Map();
  private registry: ServiceRegistry;

  constructor(registry: ServiceRegistry) {
    this.registry = registry;
  }

  async call(service: string, method: string, params: any): Promise<any> {
    const client = this.getServiceClient(service);
    if (!client) {
      throw new Error(`Unknown service: ${service}`);
    }
    return await client.call(method, params);
  }

  private getServiceClient(service: string): ServiceClient | undefined {
    if (!this.serviceClients.has(service)) {
      const client = this.registry.createClient(service);
      if (client) {
        this.serviceClients.set(service, client);
      }
    }
    return this.serviceClients.get(service);
  }

  on(event: string, handler: Function): void {
    eventBus.subscribe(event, handler);
  }

  emit(event: string, data: any): void {
    eventBus.publish(event, data);
  }
}

// 服务注册示例
const serviceRegistry = new ServiceRegistry();
serviceRegistry.register('alert', () => new AlertServiceClient());
serviceRegistry.register('ticket', () => new TicketServiceClient());
serviceRegistry.register('approval', () => new ApprovalServiceClient());
serviceRegistry.register('notification', () => new NotificationServiceClient());
serviceRegistry.register('pipeline', () => new PipelineServiceClient());
```

### B.3 与各系统集成详情

#### B.3.1 与告警系统集成

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         与告警系统集成                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  数据流:                                                                    │
│  ┌──────────┐    告警规则配置    ┌──────────┐    触发告警    ┌──────────┐ │
│  │ 用户配置  │ ──────────────▶  │ 低代码   │ ──────────────▶ │ 告警服务 │ │
│  │ (前端)   │                   │ 平台     │                 │ Alert Svc│ │
│  └──────────┘                   └──────────┘                 └────┬─────┘ │
│                                                                     │        │
│  API 集成:                                                              │        │
│  POST /api/lowcode/config          POST /api/alert/rules             │        │
│  GET  /api/lowcode/config/{id}     GET  /api/alert/rules/{id}        │        │
│  PUT  /api/lowcode/config/{id}     PUT  /api/alert/rules/{id}        │        │
│                                                                     │        │
│  事件集成:                                                              ▼        │
│  ────────────────────────     ┌──────────┐    发送通知    ┌──────────┐    │
│  rule.triggered ─────────────▶│ 告警引擎 │ ─────────────▶│ 通知服务 │    │
│                                └──────────┘                 └──────────┘    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

```typescript
// 告警规则适配器
class AlertRuleAdapter implements IntegrationAdapter {
  async call(service: string, method: string, params: any): Promise<any> {
    switch (method) {
      case 'createRule':
        // 调用告警服务创建规则
        return await this.createAlertRule(params);

      case 'updateRule':
        return await this.updateAlertRule(params);

      case 'deleteRule':
        return await this.deleteAlertRule(params);

      case 'testRule':
        return await this.testAlertRule(params);

      default:
        throw new Error(`Unknown method: ${method}`);
    }
  }

  private async createAlertRule(params: any): Promise<any> {
    // 转换低代码配置为告警服务格式
    const alertRule = {
      name: params.name,
      condition: this.convertCondition(params.condition),
      actions: this.convertActions(params.actions),
      severity: params.severity,
      enabled: params.enabled,
    };

    // 调用告警服务 API
    return await fetch('/api/alert/rules', {
      method: 'POST',
      body: JSON.stringify(alertRule),
    });
  }

  private convertCondition(condition: any): any {
    // 将低代码条件表达式转换为告警服务格式
    return {
      metric: condition.metric,
      operator: condition.operator,
      threshold: condition.threshold,
      duration: condition.duration,
    };
  }

  private convertActions(actions: any[]): any[] {
    // 将低代码动作配置转换为告警服务格式
    return actions.map(action => ({
      type: action.type,
      config: action.config,
    }));
  }
}
```

#### B.3.2 与工单系统集成

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         与工单系统集成                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  数据流:                                                                    │
│  ┌──────────┐    工单流程配置    ┌──────────┐    创建工单    ┌──────────┐ │
│  │ 用户配置  │ ──────────────▶  │ 低代码   │ ──────────────▶ │ 工单服务 │ │
│  │ (前端)   │                   │ 平台     │                 │Ticket Svc│ │
│  └──────────┘                   └──────────┘                 └────┬─────┘ │
│                                                                     │        │
│  事件:                                                                      │        │
│  workflow.completed ──────────▶ 创建工单 ──────────▶ Ticket Created        │
│  workflow.failed    ──────────▶ 记录日志 ──────────▶ Ticket Error          │
│                                                                             │
│  集成点:                                                                    │
│  1. 工作流状态变化触发工单创建                                               │
│  2. 工单状态变化触发工作流继续                                               │
│  3. 工作流变量传递到工单自定义字段                                           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

```typescript
// 工单工作流适配器
class TicketWorkflowAdapter implements IntegrationAdapter {
  async call(service: string, method: string, params: any): Promise<any> {
    switch (method) {
      case 'createTicket':
        return await this.createTicket(params);

      case 'updateTicketStatus':
        return await this.updateTicketStatus(params);

      case 'assignTicket':
        return await this.assignTicket(params);

      default:
        throw new Error(`Unknown method: ${method}`);
    }
  }

  async on(event: string, handler: Function): void {
    switch (event) {
      case 'ticket.created':
        // 工单创建事件触发工作流
        eventBus.subscribe('ticket.created', handler);
        break;
      case 'ticket.status.changed':
        eventBus.subscribe('ticket.status.changed', handler);
        break;
    }
  }

  private async createTicket(params: any): Promise<any> {
    const ticket = {
      title: params.title,
      type: params.ticketType,
      priority: params.priority,
      customFields: params.variables,  // 工作流变量传递到自定义字段
    };

    return await fetch('/api/tickets', {
      method: 'POST',
      body: JSON.stringify(ticket),
    });
  }
}
```

#### B.3.3 与审批系统集成

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         与审批系统集成                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  数据流:                                                                    │
│  ┌──────────┐    审批流程配置    ┌──────────┐    发起审批    ┌──────────┐ │
│  │ 用户配置  │ ──────────────▶  │ 低代码   │ ──────────────▶ │ Approval │ │
│  │ (前端)   │                   │ 平台     │                 │FlowEngine│ │
│  └──────────┘                   └──────────┘                 └────┬─────┘ │
│                                                                     │        │
│  事件:                                                                      │
│  workflow.started ──────────▶ 发起审批 ──────────▶ Approval Started        │
│  approval.completed ────────▶ 继续执行 ──────────▶ Workflow Continue       │
│                                                                             │
│  集成点:                                                                    │
│  1. 审批节点使用 ApprovalFlowEngine（ChatOps 文档 2.9）                       │
│  2. 审批结果影响工作流分支                                                   │
│  3. 审批变量传递到后续节点                                                   │
│  4. 审批超时/降级/Agent 自动分析由 ApprovalFlowEngine 处理                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### B.3.4 与通知系统集成

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         与通知系统集成                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  集成方式:                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  1. 动作执行器: 低代码平台作为通知的触发方                            │    │
│  │     规则/工作流执行 → 发送通知                                        │    │
│  │                                                                      │    │
│  │  2. 通知模板: 低代码平台定义通知模板                                  │    │
│  │     模板变量 → 渲染通知内容                                           │    │
│  │                                                                      │    │
│  │  3. 通知渠道: 低代码平台配置通知渠道                                  │    │
│  │     渠道选择 → 发送方式                                              │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  API 集成:                                                                   │
│  POST /api/lowcode/config          POST /api/notifications/send             │
│  GET  /api/lowcode/config/{id}     GET  /api/notifications/templates        │
│                                  POST /api/notifications/channels           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### B.3.5 与流水线系统集成

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         与流水线系统集成                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  集成方式:                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  1. 流水线模板: 低代码平台提供流水线模板定义                         │    │
│  │     模板参数 → 生成流水线                                            │    │
│  │                                                                      │    │
│  │  2. 流水线触发: 低代码规则/工作流可触发流水线执行                    │    │
│  │     条件满足 → 触发构建                                              │    │
│  │                                                                      │    │
│  │  3. 流水线状态: 流水线状态可作为规则触发条件                         │    │
│  │     构建成功 → 继续工作流                                            │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  API 集成:                                                                   │
│  GET  /api/pipelines/templates    POST /api/pipelines/instances             │
│  POST /api/pipelines              GET  /api/pipelines/{id}/status           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### B.4 统一认证与权限

#### B.4.1 与 Capability 系统集成

低代码平台的权限控制基于 Orion 现有的 Capability 体系，确保权限管理与平台其他模块保持一致。

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Capability 权限集成                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  权限层级:                                                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  Tenant (租户)                                                      │    │
│  │    └── Capability (能力域)                                          │    │
│  │         └── lowcode (低代码平台)                                    │    │
│  │              └── Resource (资源)                                    │    │
│  │                   ├── config (配置)                                 │    │
│  │                   ├── template (模板)                               │    │
│  │                   └── execution (执行)                              │    │
│  │                        └── Action (操作)                            │    │
│  │                             ├── create                              │    │
│  │                             ├── read                                │    │
│  │                             ├── update                              │    │
│  │                             ├── delete                              │    │
│  │                             ├── publish                             │    │
│  │                             └── execute                             │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  权限校验流程:                                                                │
│  1. 用户请求 → 低代码平台 API                                                │
│  │  │  └─────────────────────────────────────────────────────────────┘    │
│  │                                                                        │    │
│  │  2. API → CapabilityEngine.check(userId, 'lowcode', resource, action)  │
│  │                                                                        │    │
│  │  3. CapabilityEngine → 返回 true/false                                  │
│  │                                                                        │    │
│  │  4. 允许/拒绝请求                                                        │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

```typescript
// 与 Capability 系统集成
class CapabilityIntegration {
  private capabilityEngine: CapabilityEngine;

  constructor(capabilityEngine: CapabilityEngine) {
    this.capabilityEngine = capabilityEngine;
  }

  // 验证配置操作权限
  async checkPermission(
    userId: string,
    tenantId: string,
    pluginId: string,
    action: LowCodeAction
  ): Promise<boolean> {
    // 构建 Capability 资源标识
    const resource = `lowcode:${pluginId}`;

    // 调用 Capability 引擎验证
    return await this.capabilityEngine.check(userId, {
      tenant: tenantId,
      capability: 'lowcode',
      resource: resource,
      action: action,
    });
  }

  // 获取用户在低代码平台的所有权限
  async getUserLowCodePermissions(
    userId: string,
    tenantId: string
  ): Promise<LowCodePermission[]> {
    const capabilities = await this.capabilityEngine.getUserCapabilities(
      userId,
      tenantId
    );

    // 过滤低代码相关权限
    return capabilities
      .filter(c => c.capability === 'lowcode')
      .map(c => ({
        pluginId: c.resource.split(':')[1],
        resourceType: c.resource.split(':')[2] as LowCodeResourceType,
        actions: c.actions as LowCodeAction[],
      }));
  }
}

// 权限类型定义
type LowCodeResourceType = 'config' | 'template' | 'execution';
type LowCodeAction = 'create' | 'read' | 'update' | 'delete' | 'publish' | 'execute';

interface LowCodePermission {
  pluginId: string;
  resourceType: LowCodeResourceType;
  actions: LowCodeAction[];
}
```

#### B.4.2 权限配置示例

```typescript
// 权限配置示例
interface LowCodePermission {
  resourceType: 'lowcode_config' | 'lowcode_template' | 'lowcode_execution';
  resourceId: string;
  actions: Array<'create' | 'read' | 'update' | 'delete' | 'publish' | 'execute'>;
  tenantId: string;
}
```

### B.5 迁移策略

#### B.5.1 迁移执行流程

```typescript
// 现有配置迁移到低代码平台

interface MigrationStrategy {
  // 1. 告警规则迁移
  migrateAlertRules(): Promise<MigrationResult>;

  // 2. 审批流程迁移
  migrateApprovalWorkflows(): Promise<MigrationResult>;

  // 3. 工单工作流迁移
  migrateTicketWorkflows(): Promise<MigrationResult>;

  // 4. 流水线模板迁移
  migratePipelineTemplates(): Promise<MigrationResult>;
}

// 迁移执行计划
interface MigrationPlan {
  source: {
    system: string;
    dataType: string;
    recordCount: number;
  };
  target: {
    pluginId: string;
    configType: string;
  };
  mapping: FieldMapping[];
  validation: ValidationRule[];
  estimatedTime: number;  // 毫秒
}

// 迁移结果
interface MigrationResult {
  success: number;
  failed: number;
  errors: Array<{
    recordId: string;
    error: string;
  }>;
}

// 迁移执行
class ConfigMigration {
  async execute(plan: MigrationPlan): Promise<MigrationResult> {
    const results: MigrationResult = {
      success: 0,
      failed: 0,
      errors: [],
    };

    for (const record of await this.fetchSourceData(plan.source)) {
      try {
        // 1. 数据转换
        const transformed = this.transform(record, plan.mapping);

        // 2. 验证
        const validation = this.validate(transformed, plan.validation);
        if (!validation.valid) {
          results.failed++;
          results.errors.push(...validation.errors);
          continue;
        }

        // 3. 保存到低代码平台
        await this.saveToLowCode(plan.target.pluginId, transformed);

        results.success++;
      } catch (error) {
        results.failed++;
        results.errors.push({
          recordId: record.id,
          error: error.message,
        });
      }
    }

    return results;
  }
}
```

#### B.5.2 回滚机制

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         迁移回滚机制                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  回滚策略:                                                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  1. 迁移前备份                                                        │    │
│  │     └── 备份原始数据到临时表 backup_${dataType}_${timestamp}         │    │
│  │                                                                      │    │
│  │  2. 迁移中记录                                                        │    │
│  │     └── 记录每条迁移记录的对应关系 (old_id → new_id)                 │    │
│  │                                                                      │    │
│  │  3. 迁移后验证                                                        │    │
│  │     └── 验证迁移数据的完整性和一致性                                   │    │
│  │                                                                      │    │
│  │  4. 回滚执行                                                          │    │
│  │     └── 从备份表恢复数据，删除新创建的配置                              │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  回滚触发条件:                                                                │
│  - 迁移失败率 > 10%                                                          │
│  - 数据一致性检查失败                                                         │
│  - 用户主动触发回滚                                                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

```typescript
// 回滚执行
class MigrationRollback {
  // 执行回滚
  async execute(migrationId: string): Promise<RollbackResult> {
    const migration = await this.getMigrationRecord(migrationId);

    // 1. 从备份恢复原始数据
    await this.restoreFromBackup(migration.source);

    // 2. 删除新创建的配置
    await this.deleteMigratedConfigs(migration.target);

    // 3. 记录回滚结果
    await this.recordRollback(migrationId);

    return { success: true, message: '回滚完成' };
  }

  // 验证回滚结果
  async verify(migrationId: string): Promise<boolean> {
    // 验证原始数据已恢复
    // 验证新配置已删除
    return true;
  }
}

interface RollbackResult {
  success: boolean;
  message: string;
}
```

### B.6 集成检查清单

| 集成项 | 现有系统 | 集成方式 | 状态 | 备注 |
|--------|---------|---------|------|------|
| 告警规则 | AlertService | 事件驱动 + API | 待开发 | 优先集成 |
| 工单工作流 | TicketService | 事件驱动 + API | 待开发 | 优先集成 |
| 审批流程 | ApprovalFlowEngine (V3) | 事件驱动 + API | 待开发 | 优先集成 |
| 通知发送 | NotificationService | SDK 调用 | 待开发 | 优先集成 |
| 流水线触发 | PipelineService | 事件驱动 + API | 待开发 | 第二批 |
| 监控系统 | MonitorService | API 调用 | 待开发 | 第二批 |
| 权限系统 | AuthService | SDK 调用 | 待开发 | 贯穿始终 |
| 审计日志 | AuditService | SDK 调用 | 待开发 | 贯穿始终 |

---

## 相关文档

| 文档 | 说明 |
|------|------|
| 全局权限管控体系设计 | Capability 系统架构 |
| 模块权限控制独立性分析 | 能力域划分 |
| 权限配置页面设计 | 管理页面方案 |
| 低代码能力分析报告 | 模块分析（本文档前置） |
| 低代码平台详细设计 | 16个模块详细设计（本文档主体） |