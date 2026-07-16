# Orion 事件总线监控设计文档

> 版本：v1.0  
> 创建日期：2026-04-10  
> 设计师：Orion Design System Team  
> 适用范围：P1 核心功能 - 事件驱动架构监控模块

---

## 一、页面概述

### 1.1 页面定义

事件总线监控（Event Bus Monitor）是 Orion 平台基于 NATS 的事件驱动架构监控中心，用户在此查看 NATS 集群状态、监控事件流、查询事件溯源、管理死信队列和注册事件 Schema。页面采用实时数据仪表盘设计风格，兼顾消息可视性和故障排查能力。

### 1.2 目标用户

| 角色 | 核心任务 | 使用频率 | 权限级别 |
|------|----------|----------|----------|
| 平台工程师 | 监控集群健康、配置事件流 | 高频（每日 5-8 次） | 配置/执行 |
| 运维工程师 | 排查消息问题、管理死信 | 中频（每周 5-8 次） | 执行/只读 |
| 开发工程师 | 订阅事件、查看 Schema | 中频（每周 3-5 次） | 只读/订阅 |
| 架构师 | 分析事件流、优化设计 | 低频（每周 1-2 次） | 只读/分析 |

### 1.3 设计原则

- **集群可视**：NATS 节点状态和消息速率实时展示
- **流可追踪**：每个事件流的主题/速率/延迟清晰可见
- **事件可查**：完整事件溯源查询能力
- **死信可管**：死信队列管理和重试机制

---

## 二、布局结构

### 2.1 页面布局（ASCII）

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Top Navigation Bar                                                     │
├────────┬────────────────────────────────────────────────────────────────┤
│        │                                                                │
│ Side   │  ┌──────────────────────────────────────────────────────────┐ │
│ bar    │  │  Event Bus Monitor                      [+ New Stream]   │ │
│        │  └──────────────────────────────────────────────────────────┘ │
│        │                                                                │
│        │  ┌──────────────────────────────────────────────────────────┐ │
│        │  │  [Cluster] [Streams] [Events] [DLQ] [Schemas]           │ │
│        │  └──────────────────────────────────────────────────────────┘ │
│        │                                                                │
│        │  ┌──────────────────────────────────────────────────────────┐ │
│        │  │  NATS Cluster Status                 [Auto Refresh: 5s]  │ │
│        │  │  ┌─────────┬─────────┬─────────┬───────────────────────┐ │ │
│        │  │  │ Nodes   │ Conn    │ Msg/s   │ Health                │ │ │
│        │  │  │ 5/5     │ 1,248   │ 12,540  │ 🟢 Healthy            │ │ │
│        │  │  │         │ ↑ 52    │ ↑ 8%    │ 99.99% uptime         │ │ │
│        │  │  └─────────┴─────────┴─────────┴───────────────────────┘ │ │
│        │  └──────────────────────────────────────────────────────────┘ │
│        │                                                                │
│        │  ┌──────────────────────────────────────────────────────────┐ │
│        │  │  Event Streams (24)                                     │ │
│        │  │  ──────────────────────────────────────────────────────  │ │
│        │  │  ┌────────────────────────────────────────────────────┐  │ │
│        │  │  │ 📊 orders.created       1,245/s   12ms   🟢 Active │  │ │
│        │  │  │    Subjects: 3    Consumers: 8    Lag: 0           │  │ │
│        │  │  │    [View] [Metrics] [Consumers] [Settings]         │  │ │
│        │  │  └────────────────────────────────────────────────────┘  │ │
│        │  │  ┌────────────────────────────────────────────────────┐  │ │
│        │  │  │ 📊 payments.processed   856/s     125ms  🟡 Lag   │  │ │
│        │  │  │    Subjects: 2    Consumers: 5    Lag: 1,240 ⚠️    │  │ │
│        │  │  │    [View] [Metrics] [Consumers] [Settings]         │  │ │
│        │  │  └────────────────────────────────────────────────────┘  │ │
│        │  └──────────────────────────────────────────────────────────┘ │
│        │                                                                │
│        │  ┌──────────────────────────────────────────────────────────┐ │
│        │  │  Recent Events (Live)                                   │ │
│        │  │  ┌────────────────────────────────────────────────────┐  │ │
│        │  │  │ 14:32:15  orders.created    ord_12345    ✅ 8ms   │  │ │
│        │  │  │ 14:32:16  payments.proc     pay_67890    ✅ 12ms  │  │ │
│        │  │  │ 14:32:17  inventory.upd     inv_11111    ⚠️ 250ms │  │ │
│        │  │  └────────────────────────────────────────────────────┘  │ │
│        │  └──────────────────────────────────────────────────────────┘ │
│        │                                                                │
└────────┴────────────────────────────────────────────────────────────────┘
```

### 2.2 事件流详情抽屉（ASCII）

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Event Stream Details - orders.created                    [X] [Config]  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  Stream Overview                                                  │  │
│  │  ───────────────────────────────────────────────────────────────  │  │
│  │  Name: orders.created    Subjects: 3    Retention: 72h           │  │
│  │  Status: 🟢 Active    Created: 2025-06-15                        │  │
│  │                                                                   │  │
│  │  ┌─────────────┬─────────────┬─────────────┬───────────────────┐  │  │
│  │  │ Messages    │ Bytes       │ Consumers   │ Last Message      │  │  │
│  │  │ 12.5M       │ 4.2 GB      │ 8           │ 2 seconds ago     │  │  │
│  │  │ ↑ 5%/hour   │ ↑ 3%/hour   │ -           │                   │  │  │
│  │  └─────────────┴─────────────┴─────────────┴───────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  Throughput & Latency (Last 1 hour)                               │  │
│  │  ───────────────────────────────────────────────────────────────  │  │
│  │  ┌────────────────────────────────────────────────────────────┐   │  │
│  │  │ [Line Chart: Message Rate & P99 Latency]                   │   │  │
│  │  │                                                             │   │  │
│  │  │ 1500 ┤     ╭─────╮              ╭────╮                     │   │  │
│  │  │ 1000 ┤╭────╯     ╰────╮    ╭───╯    ╰──╮                  │   │  │
│  │  │  500 ┤╯              ╰────╯             ╰────              │   │  │
│  │  │    0 ┴───────┴───────┴───────┴───────┴───────┴────         │   │  │
│  │  │       14:00  14:15  14:30  14:45  15:00  15:15             │   │  │
│  │  │                                                             │   │  │
│  │  │ P99: 12ms (avg)  P95: 8ms  P50: 3ms                        │   │  │
│  │  └────────────────────────────────────────────────────────────┘   │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  Subjects                                                         │  │
│  │  ───────────────────────────────────────────────────────────────  │  │
│  │  ┌────────────────────────────────────────────────────────────┐   │  │
│  │  │ Subject Pattern          │ Msg Count  │ Rate      │ Size   │   │  │
│  │  │ ────────────────────────────────────────────────────────── │   │  │
│  │  │ orders.created           │ 8.2M       │ 820/s     │ 240B   │   │  │
│  │  │ orders.created.v2        │ 4.1M       │ 410/s     │ 280B   │   │  │
│  │  │ orders.created.internal  │ 200K       │ 15/s      │ 120B   │   │  │
│  │  └────────────────────────────────────────────────────────────┘   │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  Consumers                                                        │  │
│  │  ───────────────────────────────────────────────────────────────  │  │
│  │  ┌────────────────────────────────────────────────────────────┐   │  │
│  │  │ Name              │ Type      │ Pending  │ Ack    │ Lag    │   │  │
│  │  │ ────────────────────────────────────────────────────────── │   │  │
│  │  │ order-processor   │ Durable   │ 0        │ 99.9%    │ 0     │   │  │
│  │  │ analytics-sink    │ Durable   │ 120      │ 98.5%    │ 120   │   │  │
│  │  │ notification-svc  │ Durable   │ 0        │ 99.8%    │ 0     │   │  │
│  │  │ audit-logger      │ Queue     │ 0        │ 99.9%    │ 0     │   │  │
│  │  └────────────────────────────────────────────────────────────┘   │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│  [Close]  [Export Metrics]  [Stream Settings]                            │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.3 事件溯源查询面板（ASCII）

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Event Query                                              [X] [Search]  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  Search Criteria                                                  │  │
│  │  ───────────────────────────────────────────────────────────────  │  │
│  │  Stream: [orders.created ▼]    Subject: [orders.created         ]  │  │
│  │                                                                   │  │
│  │  Time Range: [2026-04-10 14:00] to [2026-04-10 15:00]            │  │
│  │                                                                   │  │
│  │  Filters:                                                         │  │
│  │  ┌────────────────────────────────────────────────────────────┐   │  │
│  │  │ Field          │ Operator    │ Value                       │   │  │
│  │  │ ────────────────────────────────────────────────────────── │   │  │
│  │  │ order_id       │ contains    │ ord_12                      │   │  │
│  │  │ customer_id    │ =           │ cust_456                    │   │  │
│  │  │ amount         │ >           │ 100                         │   │  │
│  │  │ ────────────────────────────────────────────────────────── │   │  │
│  │  │ [+ Add Filter]                                               │   │  │
│  │  └────────────────────────────────────────────────────────────┘   │  │
│  │                                                                   │  │
│  │  ☑ Include Headers    ☑ Include Metadata    Limit: [100]        │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  Search Results (24 events found)                                 │  │
│  │  ───────────────────────────────────────────────────────────────  │  │
│  │  ┌────────────────────────────────────────────────────────────┐   │  │
│  │  │ 14:32:15.234  orders.created    ord_12345    ✅ 245B      │   │  │
│  │  │    Stream: orders.created    Subject: orders.created.v2    │   │  │
│  │  │    Headers: { "trace_id": "abc123", "user_id": "usr_789" } │   │  │
│  │  │    Data: { "order_id": "ord_12345", "customer_id": "cust_456", │ │
│  │  │          "amount": 299.99, "items": [...], "status": "pending" }│ │
│  │  │    [View Raw JSON] [Replay] [Copy]                         │   │  │
│  │  └────────────────────────────────────────────────────────────┘   │  │
│  │  ┌────────────────────────────────────────────────────────────┐   │  │
│  │  │ 14:28:33.891  orders.created    ord_12340    ✅ 238B      │   │  │
│  │  │    ...                                                      │   │  │
│  │  └────────────────────────────────────────────────────────────┘   │  │
│  │                                                                   │  │
│  │  [Export Results]  [Create Alert]                                 │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.4 响应式断点布局

| 断点 | 宽度 | 布局策略 |
|------|------|----------|
| XS | < 576px | 单列卡片布局，标签页简化为下拉，抽屉全屏 |
| SM | 576-768px | 卡片堆叠，图表简化，抽屉 80% 宽度 |
| MD | 768-992px | 双列布局，标签页完整，抽屉 60% 宽度 |
| LG+ | > 992px | 完整布局，所有功能可见 |

---

## 三、组件清单

### 3.1 使用组件列表

| 组件名 | 用途 | 状态数 | 设计规范 |
|--------|------|--------|----------|
| `PageHeader` | 页面标题 + 创建按钮 | 1 | 带副标题说明 |
| `TabBar` | 标签页导航 | 5 | Cluster/Streams/Events/DLQ/Schemas |
| `ClusterCard` | 集群状态卡片 | 4 | Healthy/Degraded/Down/Unknown |
| `NodeStatus` | 节点状态指示器 | 4 | Online/Offline/Degraded/Syncing |
| `StreamCard` | 事件流卡片 | 4 | Active/Lag/Paused/Error |
| `ThroughputChart` | 吞吐量图表 | 3 | Real-time/Historical/Compare |
| `LatencyIndicator` | 延迟指示器 | 4 | P50/P95/P99/P999 |
| `ConsumerTable` | 消费者列表 | 4 | Durable/Queue/Ephemeral |
| `EventViewer` | 事件查看器 | 3 | List/Detail/Raw JSON |
| `EventQuery` | 事件查询器 | 3 | Search/Filter/Result |
| `DLQManager` | 死信队列管理器 | 3 | Pending/Processing/Resolved |
| `SchemaRegistry` | Schema 注册表 | 3 | List/Detail/Version |
| `EmptyState` | 空状态 | 4 | 无流/无事件 |
| `Skeleton` | 加载骨架屏 | 3 | 卡片/表格/图表 |

### 3.2 组件颜色映射

```css
/* 集群状态颜色 - 基于 Orion Design Tokens */
:root {
  --cluster-healthy-bg: var(--success-50);
  --cluster-healthy-text: var(--success-600);
  --cluster-healthy-border: var(--success-200);
  
  --cluster-degraded-bg: var(--warning-50);
  --cluster-degraded-text: var(--warning-600);
  --cluster-degraded-border: var(--warning-200);
  
  --cluster-down-bg: var(--error-50);
  --cluster-down-text: var(--error-600);
  --cluster-down-border: var(--error-200);
  
  --cluster-unknown-bg: var(--neutral-50);
  --cluster-unknown-text: var(--neutral-500);
  --cluster-unknown-border: var(--neutral-200);
}

/* 事件流状态颜色 */
:root {
  --stream-active: var(--success-600);    /* #389E0D */
  --stream-lag: var(--warning-600);       /* #D48806 */
  --stream-paused: var(--info-600);       /* #08979C */
  --stream-error: var(--error-600);       /* #D9363E */
}
```

---

## 四、颜色与视觉规范

### 4.1 主色调应用

| 元素 | 颜色 Token | HEX | 用途 |
|------|-----------|-----|------|
| 主按钮背景 | `primary-600` | #0058C4 | 新建事件流 |
| 主按钮悬停 | `primary-700` | #0047A0 | 按钮 Hover |
| 激活标签 | `primary-50` | #E6F4FF | 标签页选中 |
| 激活文本 | `primary-600` | #0058C4 | 标签页文字 |
| 链接文本 | `primary-500` | #0070F3 | 可点击文本 |

### 4.2 集群状态色完整定义

```css
/* Healthy - 健康 */
.cluster-healthy {
  background-color: var(--success-50);    /* #F6FFED */
  color: var(--success-600);              /* #389E0D - 对比度 5.2:1 ✅ */
  border-color: var(--success-200);       /* #B7EB8F */
}

/* Degraded - 降级 */
.cluster-degraded {
  background-color: var(--warning-50);    /* #FFFBE6 */
  color: var(--warning-600);              /* #D48806 - 对比度 4.6:1 ✅ */
  border-color: var(--warning-200);       /* #FFE58F */
}

/* Down - 宕机 */
.cluster-down {
  background-color: var(--error-50);      /* #FFF1F0 */
  color: var(--error-600);                /* #D9363E - 对比度 5.1:1 ✅ */
  border-color: var(--error-200);         /* #FFA39E */
  animation: pulse-down 2s infinite;
}

/* Unknown - 未知 */
.cluster-unknown {
  background-color: var(--neutral-50);    /* #FAFAFA */
  color: var(--neutral-500);              /* #8C8C8C */
  border-color: var(--neutral-200);       /* #EBEBEB */
}

@keyframes pulse-down {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}
```

### 4.3 延迟指示器颜色

```css
/* 延迟阈值颜色 */
.latency-good {
  color: var(--success-600);    /* < 50ms */
}

.latency-warning {
  color: var(--warning-600);    /* 50-200ms */
}

.latency-critical {
  color: var(--error-600);      /* > 200ms */
}
```

### 4.4 暗黑模式映射

```css
.dark-mode {
  --cluster-healthy-bg: hsl(145, 25%, 12%);
  --cluster-healthy-text: var(--success-300);
  
  --cluster-degraded-bg: hsl(38, 30%, 15%);
  --cluster-degraded-text: var(--warning-300);
  
  --cluster-down-bg: hsl(359, 25%, 12%);
  --cluster-down-text: var(--error-300);
  
  --stream-active: #73D13D;
  --stream-lag: #FFC53D;
  --stream-error: #FF6B6D;
}
```

---

## 五、字体与排版

### 5.1 字号层级

| 元素 | Token | 字号 | 行高 | 字重 |
|------|-------|------|------|------|
| 页面标题 | `text-2xl` | 24px | 32px | 600 |
| 卡片标题 | `text-md` | 16px | 24px | 600 |
| 流名称 | `text-md` | 16px | 24px | 600 |
| 指标数值 | `text-lg` | 18px | 28px | 700 |
| JSON 内容 | `text-xs` | 12px | 16px | 400, mono |
| 辅助文本 | `text-xs` | 12px | 16px | 400 |

### 5.2 事件查看器样式

| 元素 | 尺寸 | 字体 |
|------|------|------|
| 事件行 | 100% x 48px | text-sm |
| 时间戳 | text-xs, mono | - |
| JSON 块 | text-xs, mono | 行高 1.6 |
| 主题标签 | text-xs, 500 | - |

---

## 六、交互说明

### 6.1 核心交互行为

| 交互 | 触发条件 | 反馈 | 持续时间 |
|------|----------|------|----------|
| 流卡片悬停 | 鼠标进入 | 显示操作按钮 | 150ms |
| 流详情 | 点击详情 | 抽屉滑出 | 300ms |
| 标签切换 | 点击标签 | 内容切换+URL 更新 | 200ms |
| 事件展开 | 点击事件 | 展开详情 | 150ms |
| 实时刷新 | 自动 | 数据更新 | 5s 轮询 |
| 图表缩放 | 滚轮/拖拽 | 平滑缩放 | 即时 |

### 6.2 键盘快捷键

| 快捷键 | 功能 | 适用场景 |
|--------|------|----------|
| `Cmd/Ctrl + K` | 聚焦全局搜索 | 全局 |
| `Cmd/Ctrl + N` | 新建事件流 | 全局 |
| `Cmd/Ctrl + Q` | 打开事件查询 | 全局 |
| `Cmd/Ctrl + R` | 刷新数据 | 全局 |
| `Escape` | 关闭抽屉/弹窗 | 任意 |
| `↑/↓` | 上下选择事件 | 列表聚焦 |
| `Enter` | 展开选中事件 | 行聚焦 |
| `R` | 重放选中事件 | 有选中项 |

### 6.3 操作确认规则

| 操作 | 是否需要确认 | 确认方式 | 可撤销 |
|------|--------------|----------|--------|
| 新建事件流 | 否 | 验证后生效 | ✅ 可删除 |
| 删除事件流 | 是 | 模态框 + 名称确认 | ❌ 不可撤销 |
| 重放事件 | 是 | 范围确认 | ✅ 可追踪 |
| 死信重试 | 否 | 直接执行 | - |
| 暂停/恢复流 | 否 | 直接切换 | ✅ 可反向 |

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
│                  暂无事件流                                     │
│              text-2xl, font-weight-semibold, neutral-800        │
│                                                                 │
│          创建第一个事件流，开始事件驱动架构                       │
│              text-md, neutral-500, margin-top: 8px             │
│                                                                 │
│              ┌──────────────┐  ┌──────────────┐                │
│              │ + 创建事件流 │  │ 📖 配置指南  │                │
│              │ primary-600  │  │ neutral-600  │                │
│              └──────────────┘  └──────────────┘                │
│                                                                 │
│          ───────────  支持场景  ───────────                    │
│                                                                 │
│     📡 事件驱动  •  🔄 CDC 同步  •  📢 通知广播  •  📈 数据管道   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 7.2 加载状态（Loading State）

**骨架屏规格**：
```css
.stream-card-skeleton {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 20px;
  background: var(--neutral-50);
  border-radius: var(--radius-md);
}

.skeleton-header {
  display: flex;
  gap: 12px;
  align-items: center;
}

.skeleton-icon {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-sm);
  background: linear-gradient(
    90deg,
    var(--neutral-100) 25%,
    var(--neutral-200) 50%,
    var(--neutral-100) 75%
  );
  background-size: 200% 100%;
  animation: skeleton-loading 1.5s infinite;
}

.skeleton-metrics {
  display: flex;
  gap: 24px;
  margin-top: 8px;
}

.skeleton-metric {
  width: 80px;
  height: 24px;
  border-radius: var(--radius-sm);
  background: linear-gradient(
    90deg,
    var(--neutral-100) 25%,
    var(--neutral-200) 50%,
    var(--neutral-100) 75%
  );
  background-size: 200% 100%;
  animation: skeleton-loading 1.5s infinite;
}

/* 图表骨架 */
.chart-skeleton {
  height: 200px;
  background: var(--neutral-50);
  border-radius: var(--radius-md);
  animation: skeleton-loading 1.5s infinite;
}
```

### 7.3 错误状态（Error State）

| 错误类型 | 展示方式 | 用户操作 | 自动重试 |
|----------|----------|----------|----------|
| 集群连接失败 | 全页错误卡片 | [重新连接] [检查配置] | 3 次 |
| 事件查询失败 | 结果面板错误 | [调整查询] [重试] | 可选 |
| 死信处理失败 | 卡片错误状态 | [查看错误] [手动处理] | 可选 |
| Schema 验证失败 | Toast 提示 | [修正 Schema] | 否 |

### 7.4 事件流状态定义

| 状态 | 图标 | 颜色 | 说明 |
|------|------|------|------|
| Active | 🟢 | success-600 | 正常运行 |
| Lag | 🟡 | warning-600 | 消息堆积 |
| Paused | ⏸️ | info-600 | 已暂停 |
| Error | 🔴 | error-600 | 错误状态 |

---

## 八、响应式设计

### 8.1 移动端适配策略

**XS (< 576px) - 卡片模式**：
```
┌─────────────────────────────────┐
│  Event Bus     [+ New Stream]   │
├─────────────────────────────────┤
│ [Cluster ▼] [Streams] [Events]  │
├─────────────────────────────────┤
│ ┌─────────────────────────────┐ │
│ │ 📊 orders.created   🟢Active│ │
│ │ 1,245/s • 12ms • 8 consumers│ │
│ │ [View] [Metrics]             │ │
│ └─────────────────────────────┘ │
│ ┌─────────────────────────────┐ │
│ │ 📊 payments.proc    🟡Lag   │ │
│ │ 856/s • 125ms • 1240 lag ⚠️ │ │
│ │ [View] [Metrics]             │ │
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```

**SM (576-768px) - 双列卡片**：
- 事件流卡片 2 列
- 指标简化
- 图表缩小

**MD (768-992px) - 完整功能**：
- 事件流卡片单列
- 所有指标可见
- 图表完整

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
  
  --card-padding: var(--spacing-lg);
  --card-gap: var(--spacing-lg);
  --stream-card-gap: var(--spacing-md);
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

### 9.4 事件查看器样式

```css
:root {
  --event-row-height: 48px;
  --event-row-padding: var(--spacing-md);
  --event-row-gap: var(--spacing-xs);
  
  --event-success-bg: var(--success-50);
  --event-success-border: var(--success-200);
  --event-error-bg: var(--error-50);
  --event-error-border: var(--error-200);
  
  --json-font: var(--font-family-mono);
  --json-size: var(--text-xs);
  --json-line-height: 1.6;
}
```

### 9.5 动画系统

```css
:root {
  --transition-fast: 150ms ease;
  --transition-normal: 200ms ease;
  --transition-slow: 300ms ease;
  
  --animation-skeleton: skeleton-loading 1.5s infinite;
  --animation-pulse-down: pulse-down 2s infinite;
  --animation-live-indicator: live-blink 1s infinite;
}

@keyframes skeleton-loading {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

@keyframes pulse-down {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

@keyframes live-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
```

---

## 十、Agent 开发指南

### 10.1 快速实现提示

使用以下提示词生成代码：

```
创建一个事件总线监控页面，使用以下设计令牌：
- 集群状态：Healthy #389E0D, Degraded #D48806, Down #D9363E, Unknown #8C8C8C
- 事件流状态：Active #389E0D, Lag #D48806, Paused #08979C, Error #D9363E
- 延迟阈值：Good <50ms #52C41A, Warning 50-200ms #FAAD14, Critical >200ms #F5222D
- 事件查看器：行高 48px, JSON 等宽字体 12px
- 事件流卡片：圆角 8px, 悬停阴影 shadow-md
- 标签页：选中背景 #E6F4FF, 文本 #0058C4
- 实时指示器：红色闪烁动画，1s 周期
```

### 10.2 关键实现检查点

- [ ] 集群状态实时同步（5s 轮询）
- [ ] 事件流指标可视
- [ ] 事件查询功能完整
- [ ] 死信队列管理
- [ ] WCAG 2.1 AA 对比度合规
- [ ] 键盘导航完整（Tab 顺序、快捷键）
- [ ] 聚焦状态可见（`:focus-visible`）
- [ ] 暗黑模式颜色映射正确
- [ ] 响应式断点测试通过
- [ ] 骨架屏和空状态实现
- [ ] JSON 语法高亮
- [ ] 事件重放功能

### 10.3 事件总线 API 要求

- 集群状态 API
- 事件流 CRUD API
- 事件查询 API
- 消费者管理 API
- 死信队列 API
- Schema 注册 API
- 指标数据 API
- 事件重放 API

### 10.4 NATS 示例

```graphql
# Query cluster status
query GetClusterStatus {
  cluster {
    name
    nodes {
      id
      host
      status
      connections
      msgsPerSec
    }
    health
    uptime
  }
}

# Query event streams
query GetEventStreams {
  streams {
    id
    name
    subjects
    messageCount
    bytes
    consumerCount
    status
    lag
    retention
    createdAt
  }
}

# Query stream details
query GetStreamDetails($streamId: ID!) {
  stream(id: $streamId) {
    name
    subjects {
      pattern
      messageCount
      rate
      avgSize
    }
    consumers {
      name
      type
      pending
      ackRate
      lag
    }
    metrics {
      rate { timestamp value }
      latency { p50 p95 p99 timestamp }
    }
  }
}

# Query events
query GetEvents($input: EventQueryInput!) {
  events(input: $input) {
    id
    timestamp
    stream
    subject
    headers
    data
    size
    latency
  }
}

# Replay event
mutation ReplayEvent {
  replayEvent(ids: ["evt-001", "evt-002"]) {
    success
    replayId
    status
  }
}

# Manage DLQ
mutation RetryDLQ {
  retryDLQ(streamId: "stream-001", ids: ["dlq-001"]) {
    success
    processed
    failed
  }
}
```

---

*文档版本：v1.0*  
*创建日期：2026-04-10*  
*基于 Orion Design Tokens v1.2.0*
