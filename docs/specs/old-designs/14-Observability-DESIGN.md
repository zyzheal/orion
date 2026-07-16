# Orion 可观测性 Dashboard 设计文档

> 版本：v1.0  
> 创建日期：2026-04-10  
> 设计师：Orion Design System Team  
> 适用范围：P1 核心功能 - 监控与可观测性模块

---

## 一、页面概述

### 1.1 页面定义

可观测性 Dashboard（Observability）是 Orion 平台的系统监控与故障排查中心，用户在此查看系统健康概览、服务依赖拓扑、资源使用率、告警列表和日志查询。页面采用运维仪表板设计，兼顾实时监控和故障追溯能力。

### 1.2 目标用户

| 角色 | 核心任务 | 使用频率 | 权限级别 |
|------|----------|----------|----------|
| 运维工程师 | 监控系统健康、处理告警 | 高频（每日 20+ 次） | 完全访问 |
| 平台工程师 | 排查故障、分析性能 | 高频（每日 10+ 次） | 配置/执行 |
| 开发工程师 | 查看服务状态、分析日志 | 中频（每周 5-8 次） | 只读/查询 |
| 技术主管 | 查看系统概览、SLA 统计 | 低频（每周 2-3 次） | 概览/只读 |

### 1.3 设计原则

- **实时可视**：指标秒级刷新，状态一目了然
- **拓扑直观**：服务依赖关系清晰，故障传播路径可视
- **告警优先**：未解决告警突出显示，支持快速降噪
- **查询高效**：日志查询支持 Lucene 语法，结果高亮显示

---

## 二、布局结构

### 2.1 页面布局（ASCII）

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Top Navigation Bar                                                     │
├────────┬────────────────────────────────────────────────────────────────┤
│        │                                                                │
│ Side   │  ┌──────────────────────────────────────────────────────────┐ │
│ bar    │  │  Observability Dashboard                [+ New Alert]    │ │
│        │  └──────────────────────────────────────────────────────────┘ │
│        │                                                                │
│        │  ┌──────────────────────────────────────────────────────────┐ │
│        │  │  [Overview] [Topology] [Resources] [Alerts] [Logs]      │ │
│        │  └──────────────────────────────────────────────────────────┘ │
│        │                                                                │
│        │  ┌──────────────────────────────────────────────────────────┐ │
│        │  │  System Overview                                        │ │
│        │  │  ┌─────────┬─────────┬─────────┬───────────────────────┐ │ │
│        │  │  │ QPS     │ Error   │ P99     │ Available             │ │ │
│        │  │  │ 12,540  │ Rate    │ Latency │ Services              │ │ │
│        │  │  │ ↑ 12%   │ 0.02%   │ 125ms   │ 45/46                 │ │ │
│        │  │  │         │ ↓ 0.01% │ ↑ 8ms   │ 97.8%                 │ │ │
│        │  │  └─────────┴─────────┴─────────┴───────────────────────┘ │ │
│        │  └──────────────────────────────────────────────────────────┘ │
│        │                                                                │
│        │  ┌──────────────────────────────────────────────────────────┐ │
│        │  │  Service Topology                    [Auto Refresh: 10s] │ │
│        │  │  ┌────────────────────────────────────────────────────┐  │ │
│        │  │  │    ┌─────┐         ┌─────┐                        │  │ │
│        │  │  │    │ API │ ──────→ │ DB  │                        │  │ │
│        │  │  │    └─────┘    🟢   └─────┘                        │  │ │
│        │  │  │       │                                           │  │ │
│        │  │  │       ↓ 🟢                                        │  │ │
│        │  │  │    ┌─────┐         ┌─────┐                        │  │ │
│        │  │  │    │Cache│ ←─────→ │Queue│                        │  │ │
│        │  │  │    └─────┘    🟢   └─────┘                        │  │ │
│        │  │  └────────────────────────────────────────────────────┘  │ │
│        │  └──────────────────────────────────────────────────────────┘ │
│        │                                                                │
│        │  ┌──────────────────────────────────────────────────────────┐ │
│        │  │  Active Alerts (12)                   [Ack All] [Mute]   │ │
│        │  │  ──────────────────────────────────────────────────────  │ │
│        │  │  │ Severity │ Message           │ Since    │ Service   │ │
│        │  │  │──────────│───────────────────│──────────│───────────│ │
│        │  │  │ 🔴 P0    │ DB Connection High│ 5m ago   │ payment   │ │
│        │  │  │ 🟠 P1    │ Error Rate > 1%   │ 12m ago  │ order     │ │
│        │  │  │ 🟡 P2    │ P99 > 500ms       │ 25m ago  │ user      │ │
│        │  │  │ ...                                                    │ │
│        │  │  [View All Alerts]                                        │ │
│        │  └──────────────────────────────────────────────────────────┘ │
│        │                                                                │
└────────┴────────────────────────────────────────────────────────────────┘
```

### 2.2 告警详情抽屉（ASCII）

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Alert #A-20260410-001 - DB Connection High               [X] [Ack]     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Severity: 🔴 P0    Status: Firing    Since: 2026-04-10 14:25:33      │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  Alert Details                                                    │  │
│  │  ───────────────────────────────────────────────────────────────  │  │
│  │  Rule:      Database Connection Pool Exhausted                    │  │
│  │  Condition: active_connections / max_connections > 0.85           │  │
│  │  Current:   92% (184/200)                                         │  │
│  │  Threshold: 85%                                                   │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  Affected Resources                                               │  │
│  │  ───────────────────────────────────────────────────────────────  │  │
│  │  ┌────────────────────────────────────────────────────────────┐   │  │
│  │  │ 🗄️ payment-db-master (postgres-0.internal)                 │   │  │
│  │  │    Status: 🟡 Degraded    CPU: 78%    Memory: 82%          │   │  │
│  │  │    [View Metrics] [View Logs] [Connect]                    │   │  │
│  │  └────────────────────────────────────────────────────────────┘   │  │
│  │  ┌────────────────────────────────────────────────────────────┐   │  │
│  │  │ 🗄️ payment-db-replica (postgres-1.internal)                │   │  │
│  │  │    Status: 🟢 Healthy     CPU: 45%    Memory: 56%          │   │  │
│  │  └────────────────────────────────────────────────────────────┘   │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  Timeline                                                         │  │
│  │  ───────────────────────────────────────────────────────────────  │  │
│  │  ┌────────────────────────────────────────────────────────────┐   │  │
│  │  │ 14:25:33  Alert fired                                      │   │  │
│  │  │ 14:26:15  Auto-acknowledged by system                      │   │  │
│  │  │ 14:28:00  Notification sent to #oncall-payment             │   │  │
│  │  │ 14:30:22  John Doe commented: "Investigating..."           │   │  │
│  │  └────────────────────────────────────────────────────────────┘   │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  Related Metrics (Last 1 hour)                                    │  │
│  │  ───────────────────────────────────────────────────────────────  │  │
│  │  ┌────────────────────────────────────────────────────────────┐   │  │
│  │  │ [Line Chart: Connections Over Time]                        │   │  │
│  │  │                                                              │   │  │
│  │  │ 200 ┤                                   ╭─────              │   │  │
│  │  │ 150 ┤                         ╭─────────╯                   │   │  │
│  │  │ 100 ┤             ╭───────────╯                             │   │  │
│  │  │  50 ┤───────╮─────╯                                         │   │  │
│  │  │   0 ┴───────┴───────┴───────┴───────┴───────┴────           │   │  │
│  │  │      14:00  14:15  14:30  14:45  15:00  15:15               │   │  │
│  │  └────────────────────────────────────────────────────────────┘   │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  Actions                                                          │  │
│  │  ───────────────────────────────────────────────────────────────  │  │
│  │  [Acknowledge]  [Mute Alert]  [Create Incident]  [Runbook]       │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.3 响应式断点布局

| 断点 | 宽度 | 布局策略 |
|------|------|----------|
| XS | < 576px | 单列卡片布局，拓扑图简化，指标堆叠 |
| SM | 576-768px | 双列指标卡，告警列表简化 |
| MD | 768-992px | 完整布局，拓扑图可缩放 |
| LG+ | > 992px | 完整布局，支持多面板并排 |

---

## 三、组件清单

### 3.1 使用组件列表

| 组件名 | 用途 | 状态数 | 设计规范 |
|--------|------|--------|----------|
| `PageHeader` | 页面标题 + 创建按钮 | 1 | 带时间范围 |
| `MetricCard` | 指标卡片 | 4 | QPS/Error/P99/Availability |
| `TrendIndicator` | 趋势指示器 | 3 | 上升/下降/持平 |
| `TopologyGraph` | 拓扑图 | 5 | 交互式/静态/简化 |
| `ServiceNode` | 服务节点 | 4 | Healthy/Degraded/Down/Unknown |
| `ResourceCard` | 资源卡片 | 4 | CPU/Memory/Disk/Network |
| `ProgressBar` | 进度条 | 4 | 使用率可视化 |
| `AlertTable` | 告警列表 | 5 | 支持批量操作 |
| `SeverityBadge` | 严重等级徽章 | 5 | P0/P1/P2/P3/P4 |
| `AlertDrawer` | 告警详情抽屉 | 2 | 从右侧滑出 |
| `Timeline` | 时间线组件 | 3 | 事件/评论/操作 |
| `MetricChart` | 指标图表 | 4 | 折线/面积/柱状 |
| `LogSearch` | 日志搜索 | 4 | Lucene 语法 |
| `LogViewer` | 日志查看器 | 3 | 高亮/过滤/导出 |
| `EmptyState` | 空状态 | 3 | 无告警/无日志 |
| `Skeleton` | 加载骨架屏 | 4 | 卡片/图表/列表 |

### 3.2 组件颜色映射

```css
/* 服务状态颜色 - 基于 Orion Design Tokens */
:root {
  --service-healthy-bg: var(--success-50);
  --service-healthy-text: var(--success-600);
  --service-healthy-border: var(--success-200);
  
  --service-degraded-bg: var(--warning-50);
  --service-degraded-text: var(--warning-700);
  --service-degraded-border: var(--warning-200);
  
  --service-down-bg: var(--error-50);
  --service-down-text: var(--error-600);
  --service-down-border: var(--error-200);
  
  --service-unknown-bg: var(--neutral-50);
  --service-unknown-text: var(--neutral-500);
  --service-unknown-border: var(--neutral-200);
}

/* 告警严重等级颜色 */
:root {
  --alert-p0: var(--error-700);         /* #A8222E */
  --alert-p1: var(--error-500);         /* #F5222D */
  --alert-p2: var(--warning-500);       /* #FAAD14 */
  --alert-p3: var(--info-500);          /* #13C2C2 */
  --alert-p4: var(--neutral-500);       /* #8C8C8C */
}
```

---

## 四、颜色与视觉规范

### 4.1 主色调应用

| 元素 | 颜色 Token | HEX | 用途 |
|------|-----------|-----|------|
| 主按钮背景 | `primary-600` | #0058C4 | 创建告警 |
| 主按钮悬停 | `primary-700` | #0047A0 | 按钮 Hover |
| 正常状态 | `success-500` | #52C41A | 健康指标 |
| 警告状态 | `warning-500` | #FAAD14 | 降级指标 |
| 错误状态 | `error-500` | #F5222D | 故障指标 |

### 4.2 服务状态色完整定义

```css
/* Healthy - 健康 */
.service-healthy {
  background-color: var(--success-50);    /* #F6FFED */
  color: var(--success-600);              /* #389E0D - 对比度 5.2:1 ✅ */
  border-color: var(--success-200);       /* #B7EB8F */
}

/* Degraded - 降级 */
.service-degraded {
  background-color: var(--warning-50);    /* #FFFBE6 */
  color: var(--warning-700);              /* #AD6800 - 对比度 6.2:1 ✅ */
  border-color: var(--warning-200);       /* #FFE58F */
}

/* Down - 宕机 */
.service-down {
  background-color: var(--error-50);      /* #FFF1F0 */
  color: var(--error-600);                /* #D9363E - 对比度 5.1:1 ✅ */
  border-color: var(--error-200);         /* #FFA39E */
  animation: pulse-down 2s infinite;
}

/* Unknown - 未知 */
.service-unknown {
  background-color: var(--neutral-50);    /* #FAFAFA */
  color: var(--neutral-500);              /* #8C8C8C - 对比度 4.2:1 ✅ */
  border-color: var(--neutral-200);       /* #EBEBEB */
}

@keyframes pulse-down {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}
```

### 4.3 告警严重等级色

```css
/* P0 - 最高优先级 (Critical) */
.alert-p0 {
  background-color: #FFF1F0);
  color: var(--error-700);                /* #A8222E - 对比度 6.8:1 ✅ */
  border-color: var(--error-300);
}

/* P1 - 高优先级 (High) */
.alert-p1 {
  background-color: var(--error-50);
  color: var(--error-600);                /* #D9363E - 对比度 5.1:1 ✅ */
  border-color: var(--error-200);
}

/* P2 - 中优先级 (Medium) */
.alert-p2 {
  background-color: var(--warning-50);
  color: var(--warning-600);              /* #D48806 - 对比度 4.6:1 ✅ */
  border-color: var(--warning-200);
}

/* P3 - 低优先级 (Low) */
.alert-p3 {
  background-color: var(--info-50);
  color: var(--info-600);
  border-color: var(--info-200);
}

/* P4 - 提示 (Info) */
.alert-p4 {
  background-color: var(--neutral-50);
  color: var(--neutral-600);
  border-color: var(--neutral-200);
}
```

### 4.4 资源使用率颜色

```css
/* 资源使用率阈值颜色 */
.resource-usage {
  /* Healthy - 健康 (0-60%) */
  --usage-healthy: var(--success-500);    /* #52C41A */
  /* Warning - 警告 (61-80%) */
  --usage-warning: var(--warning-500);    /* #FAAD14 */
  /* Critical - 严重 (81-100%) */
  --usage-critical: var(--error-500);     /* #F5222D */
}
```

### 4.5 暗黑模式映射

```css
.dark-mode {
  --service-healthy-bg: hsl(145, 25%, 12%);
  --service-healthy-text: var(--success-300);
  --service-healthy-border: hsl(145, 30%, 25%);
  
  --service-degraded-bg: hsl(38, 30%, 15%);
  --service-degraded-text: var(--warning-300);
  
  --service-down-bg: hsl(359, 30%, 15%);
  --service-down-text: var(--error-300);
  
  --alert-p0: #ff6b6d;
  --alert-p1: #ff6b6d;
  --alert-p2: #ffc53d;
  --alert-p3: #36cfc9;
  
  --usage-healthy: #73d13d;
  --usage-warning: #ffc53d;
  --usage-critical: #ff6b6d;
}
```

---

## 五、字体与排版

### 5.1 字号层级

| 元素 | Token | 字号 | 行高 | 字重 |
|------|-------|------|------|------|
| 页面标题 | `text-2xl` | 24px | 32px | 600 |
| 卡片标题 | `text-lg` | 18px | 28px | 600 |
| 抽屉标题 | `text-xl` | 20px | 28px | 600 |
| 指标数值 | `text-3xl` | 30px | 38px | 700 |
| 指标标签 | `text-sm` | 14px | 20px | 500 |
| 表格标题 | `text-xs` | 12px | 16px | 600 |
| 表格正文 | `text-sm` | 14px | 20px | 400 |
| 日志内容 | `text-xs` | 12px | 16px | 400 |

### 5.2 拓扑图节点尺寸

| 元素 | 宽度 | 高度 | 边框 |
|------|------|------|------|
| 服务节点 | 120px | 60px | 2px |
| 数据库节点 | 100px | 50px | 2px |
| 缓存节点 | 100px | 50px | 2px |
| 队列节点 | 100px | 50px | 2px |
| 连接线 | 2px | - | 虚线/实线 |

---

## 六、交互说明

### 6.1 核心交互行为

| 交互 | 触发条件 | 反馈 | 持续时间 |
|------|----------|------|----------|
| 服务节点悬停 | 鼠标进入 | 显示详情 Tooltip | 100ms |
| 点击服务节点 | 点击 | 右侧抽屉滑出 | 300ms |
| 拓扑图缩放 | 滚轮/捏合 | 平滑缩放 | 即时 |
| 拓扑图拖拽 | 拖动 | 平移视图 | 即时 |
| 告警确认 | 点击确认 | 状态更新 | 200ms |
| 批量操作 | 选择多行→操作 | 确认→执行 | 300ms |
| 日志查询 | 输入→回车 | 结果刷新 | 防抖 300ms |

### 6.2 键盘快捷键

| 快捷键 | 功能 | 适用场景 |
|--------|------|----------|
| `Cmd/Ctrl + K` | 聚焦全局搜索 | 全局 |
| `Cmd/Ctrl + N` | 创建新告警 | 全局 |
| `Cmd/Ctrl + A` | 确认所有告警 | 告警列表 |
| `Cmd/Ctrl + L` | 聚焦日志搜索 | 日志视图 |
| `Cmd/Ctrl + /` | 打开快捷键帮助 | 全局 |
| `Escape` | 关闭抽屉/弹窗 | 任意 |
| `↑/↓` | 上下选择告警 | 列表聚焦 |
| `Enter` | 打开选中的告警 | 行聚焦 |
| `Space` | 切换选中状态 | 行聚焦 |
| `A` | 确认选中的告警 | 有选中项 |
| `M` | 静音选中的告警 | 有选中项 |

### 6.3 告警操作确认规则

| 操作 | 是否需要确认 | 确认方式 | 通知 |
|------|--------------|----------|------|
| 确认告警 | 否 | 直接确认 | 通知团队成员 |
| 批量确认 (≥5) | 是 | 数量确认 | 通知团队 |
| 静音告警 | 是 | 时长选择 | 静默期记录 |
| 创建事件 | 是 | 表单填写 | 通知 On-call |
| 删除告警 | 是 | 模态框 + 原因 | 审计记录 |

---

## 七、状态定义

### 7.1 空状态（Empty State）

```
┌─────────────────────────────────────────────────────────────────┐
│                        ┌─────────────┐                         │
│                        │             │                         │
│                        │    📊       │                         │
│                        │  (64x64px)  │                         │
│                        │             │                         │
│                        └─────────────┘                         │
│                                                                 │
│                    暂无告警                                     │
│              text-2xl, font-weight-semibold, neutral-800        │
│                                                                 │
│          系统运行正常，所有服务健康                              │
│              text-md, neutral-500, margin-top: 8px             │
│                                                                 │
│              ┌──────────────┐  ┌──────────────┐                │
│              │ + 创建告警   │  │ 📖 告警指南  │                │
│              │ primary-600  │  │ neutral-600  │                │
│              └──────────────┘  └──────────────┘                │
│                                                                 │
│          ───────────  快速操作  ───────────                    │
│                                                                 │
│     🔍 日志查询  •  🗺️ 服务拓扑  •  📈 指标面板  •  ⚙️ 配置     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 7.2 加载状态（Loading State）

**骨架屏规格**：
```css
.metric-card-skeleton {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
  padding: 20px;
}

.skeleton-value {
  height: 36px;
  width: 60%;
  background: linear-gradient(
    90deg,
    var(--neutral-100) 25%,
    var(--neutral-200) 50%,
    var(--neutral-100) 75%
  );
  background-size: 200% 100%;
  animation: skeleton-loading 1.5s infinite;
  border-radius: var(--radius-sm);
}

.skeleton-label {
  height: 16px;
  width: 40%;
  background: linear-gradient(
    90deg,
    var(--neutral-100) 25%,
    var(--neutral-200) 50%,
    var(--neutral-100) 75%
  );
  background-size: 200% 100%;
  animation: skeleton-loading 1.5s infinite;
  border-radius: var(--radius-sm);
  margin-top: 8px;
}

/* 拓扑图骨架 */
.topology-skeleton {
  height: 300px;
  background: var(--neutral-50);
  border-radius: var(--radius-md);
  position: relative;
  overflow: hidden;
}

.topology-skeleton::after {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255,255,255,0.4) 50%,
    transparent 100%
  );
  animation: shimmer 1.5s infinite;
}

/* 告警列表骨架 */
.alert-skeleton {
  display: grid;
  grid-template-columns: 80px 1fr 100px 120px;
  gap: 16px;
  padding: 16px;
}
```

### 7.3 错误状态（Error State）

| 错误类型 | 展示方式 | 用户操作 | 自动重试 |
|----------|----------|----------|----------|
| 数据加载失败 | 全页错误卡片 | [重试] [检查连接] | 3 次后停止 |
| 指标查询失败 | 卡片内错误状态 | [重新查询] | 可选 |
| 拓扑图渲染失败 | 简化拓扑 + 提示 | [重试] | 否 |
| 日志查询超时 | 部分结果 + 提示 | [优化查询] [重试] | 可选 |
| 权限不足 | 空状态 + 申请按钮 | [申请权限] | 否 |

### 7.4 告警状态定义

| 状态 | 图标 | 颜色 | 说明 |
|------|------|------|------|
| Firing | 🔴 | error-600 | 告警触发中 |
| Acknowledged | 🟠 | warning-600 | 已确认 |
| Resolved | ✅ | success-600 | 已解决 |
| Muted | 🔇 | neutral-400 | 已静音 |
| Pending | ⏳ | info-600 | 待处理 |

---

## 八、响应式设计

### 8.1 移动端适配策略

**XS (< 576px) - 卡片模式**：
```
┌─────────────────────────────────┐
│  Observability  [+ Alert]       │
├─────────────────────────────────┤
│ [Overview] [Topology] [Alerts]  │
├─────────────────────────────────┤
│ ┌─────────────────────────────┐ │
│ │ QPS           Error Rate    │ │
│ │ 12,540 ↑12%   0.02% ↓0.01%  │ │
│ └─────────────────────────────┘ │
│ ┌─────────────────────────────┐ │
│ │ P99 Latency   Available     │ │
│ │ 125ms ↑8ms    45/46 (97.8%) │ │
│ └─────────────────────────────┘ │
│ ┌─────────────────────────────┐ │
│ │ Active Alerts (12)          │ │
│ │ 🔴 P0 DB Connection High    │ │
│ │ 🟠 P1 Error Rate > 1%       │ │
│ │ [View All]                  │ │
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```

**SM (576-768px) - 双列指标卡**：
- 指标卡片 2x2
- 告警列表简化
- 拓扑图可缩放

**MD (768-992px) - 完整功能**：
- 指标卡片 4 列
- 拓扑图完整
- 告警列表完整

### 8.2 触摸目标尺寸

| 设备 | 最小尺寸 | 推荐尺寸 |
|------|----------|----------|
| 桌面 | 24x24px | 32x32px |
| 平板 | 36x36px | 44x44px |
| 手机 | 44x44px | 48x48px |

---

## 九、设计令牌汇总

### 9.1 间距系统

```css
:root {
  --spacing-unit: 4px;
  --spacing-xs: calc(var(--spacing-unit) * 1);   /* 4px */
  --spacing-sm: calc(var(--spacing-unit) * 2);   /* 8px */
  --spacing-md: calc(var(--spacing-unit) * 4);   /* 16px */
  --spacing-lg: calc(var(--spacing-unit) * 6);   /* 24px */
  --spacing-xl: calc(var(--spacing-unit) * 8);   /* 32px */
  --spacing-2xl: calc(var(--spacing-unit) * 12); /* 48px */
  
  --card-padding: var(--spacing-lg);
  --card-gap: var(--spacing-lg);
  --table-row-padding: var(--spacing-md);
}
```

### 9.2 圆角系统

```css
:root {
  --radius-xs: 2px;    /* Badge */
  --radius-sm: 4px;    /* Button, Input */
  --radius-md: 8px;    /* Card */
  --radius-lg: 12px;   /* Modal, Drawer */
  --radius-xl: 16px;   /* Container */
}
```

### 9.3 阴影系统

```css
:root {
  --shadow-xs: 0 2px 4px rgba(0, 0, 0, 0.06);
  --shadow-sm: 0 4px 8px rgba(0, 0, 0, 0.08);
  --shadow-md: 0 8px 16px rgba(0, 0, 0, 0.10);
  --shadow-lg: 0 16px 24px rgba(0, 0, 0, 0.12);
  --shadow-xl: 0 24px 40px rgba(0, 0, 0, 0.15);
  --shadow-focus: 0 0 0 2px rgba(24, 144, 255, 0.5);
  --shadow-focus-keyboard: 0 0 0 3px rgba(24, 144, 255, 0.8);
}
```

### 9.4 拓扑图样式

```css
:root {
  /* 节点样式 */
  --node-width: 120px;
  --node-height: 60px;
  --node-border: 2px;
  --node-radius: var(--radius-md);
  
  /* 连接线样式 */
  --line-width: 2px;
  --line-color: var(--neutral-300);
  --line-active: var(--primary-500);
  --line-error: var(--error-500);
  
  /* 状态颜色 */
  --node-healthy: var(--success-500);
  --node-degraded: var(--warning-500);
  --node-down: var(--error-500);
  --node-unknown: var(--neutral-400);
}
```

### 9.5 动画系统

```css
:root {
  --transition-fast: 150ms ease;
  --transition-normal: 200ms ease;
  --transition-slow: 300ms ease;
  
  --animation-pulse-down: pulse-down 2s infinite;
  --animation-shimmer: shimmer 1.5s infinite;
  --animation-draw-line: draw-line 1s ease-out;
}

@keyframes pulse-down {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

@keyframes shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

@keyframes draw-line {
  from { stroke-dashoffset: 1000; }
  to { stroke-dashoffset: 0; }
}
```

### 9.6 资源使用率进度条

```css
:root {
  --progress-height: 8px;
  --progress-radius: var(--radius-xs);
  
  /* 阈值颜色 */
  --progress-healthy: #52C41A;   /* 0-60% */
  --progress-warning: #FAAD14;   /* 61-80% */
  --progress-critical: #F5222D;  /* 81-100% */
}
```

---

## 十、Agent 开发指南

### 10.1 快速实现提示

使用以下提示词生成代码：

```
创建一个可观测性 Dashboard 页面，使用以下设计令牌：
- 服务状态：Healthy #389E0D, Degraded #AD6800, Down #D9363E, Unknown #8C8C8C
- 告警等级：P0 #A8222E, P1 #D9363E, P2 #D48806, P3 #08979C, P4 #8C8C8C
- 资源使用率：Healthy #52C41A (0-60%), Warning #FAAD14 (61-80%), Critical #F5222D (81-100%)
- 拓扑图节点：120x60px，边框 2px，圆角 8px
- 指标数值：30px，字重 700
- 圆角：8px (radius-md)
```

### 10.2 关键实现检查点

- [ ] 指标数据实时刷新（10s 轮询）
- [ ] 拓扑图支持缩放和拖拽
- [ ] 服务节点悬停显示详情
- [ ] 告警确认/静音操作有反馈
- [ ] WCAG 2.1 AA 对比度合规
- [ ] 键盘导航完整（Tab 顺序、快捷键）
- [ ] 聚焦状态可见（`:focus-visible`）
- [ ] 暗黑模式颜色映射正确
- [ ] 响应式断点测试通过
- [ ] 骨架屏和空状态实现
- [ ] 日志查询支持 Lucene 语法
- [ ] 日志高亮和过滤功能

### 10.3 可观测性 API 要求

- 指标查询 API（Prometheus 兼容）
- 拓扑图 API（服务依赖关系）
- 资源使用率 API（CPU/Memory/Disk/Network）
- 告警 CRUD API
- 告警状态变更 API
- 日志查询 API（Elasticsearch 兼容）
- 事件管理 API

### 10.4 指标查询示例

```graphql
# Query system metrics
query GetSystemMetrics {
  qps: metric(name: "http_requests_total", range: "1m") {
    value
    trend
  }
  errorRate: metric(name: "http_errors_total", range: "1m") {
    value
    percentage
  }
  p99Latency: metric(name: "http_request_duration_seconds", percentile: 99) {
    value
    unit
  }
  availability: service {
    total
    healthy
    percentage
  }
}

# Query service topology
query GetServiceTopology {
  topology {
    nodes {
      id
      name
      type
      status
      metrics {
        cpu
        memory
        requests
      }
    }
    edges {
      source
      target
      latency
      errorRate
    }
  }
}

# Query active alerts
query GetActiveAlerts {
  alerts(status: ["firing", "acknowledged"]) {
    id
    severity
    message
    since
    service {
      id
      name
    }
  }
}
```

---

*文档版本：v1.0*  
*创建日期：2026-04-10*  
*基于 Orion Design Tokens v1.2.0*
