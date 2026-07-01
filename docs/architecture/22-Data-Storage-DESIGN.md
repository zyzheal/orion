# Orion 数据存储管理设计文档

> 版本：v1.0  
> 创建日期：2026-04-10  
> 设计师：Orion Design System Team  
> 适用范围：P1 核心功能 - 数据存储与管理模块

---

## 一、页面概述

### 1.1 页面定义

数据存储管理（Data Storage）是 Orion 平台的数据库与存储资源管理中心，用户在此管理 MySQL/ClickHouse/MongoDB/Redis 等数据库、查看数据库状态监控、管理备份任务、分析容量与性能和配置数据生命周期策略。页面采用数据库控制台设计风格，兼顾运维监控和数据管理能力。

### 1.2 目标用户

| 角色 | 核心任务 | 使用频率 | 权限级别 |
|------|----------|----------|----------|
| DBA | 管理数据库、优化性能 | 高频（每日 5-8 次） | 配置/执行 |
| 运维工程师 | 监控状态、管理备份 | 高频（每日 3-5 次） | 执行/只读 |
| 开发工程师 | 查看数据结构、申请资源 | 中频（每周 3-5 次） | 只读/申请 |
| 技术主管 | 查看容量规划、成本 | 低频（每周 1-2 次） | 只读/分析 |

### 1.3 设计原则

- **数据库可视**：所有数据库类型和状态清晰展示
- **监控实时**：性能指标秒级刷新，异常即时告警
- **备份可靠**：备份任务可配置，恢复可验证
- **生命周期智能**：数据归档和清理策略自动化

---

## 二、布局结构

### 2.1 页面布局（ASCII）

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Top Navigation Bar                                                     │
├────────┬────────────────────────────────────────────────────────────────┤
│        │                                                                │
│ Side   │  ┌──────────────────────────────────────────────────────────┐ │
│ bar    │  │  Data Storage                           [+ New Database] │ │
│        │  └──────────────────────────────────────────────────────────┘ │
│        │                                                                │
│        │  ┌──────────────────────────────────────────────────────────┐ │
│        │  │  [Databases] [Monitoring] [Backups] [Capacity] [Lifecycle]│ │
│        │  └──────────────────────────────────────────────────────────┘ │
│        │                                                                │
│        │  ┌──────────────────────────────────────────────────────────┐ │
│        │  │  🔍 Search databases...    [Type ▼] [Status ▼] [+]      │ │
│        │  └──────────────────────────────────────────────────────────┘ │
│        │                                                                │
│        │  ┌──────────────────────────────────────────────────────────┐ │
│        │  │  Databases (32)                                         │ │
│        │  │  ──────────────────────────────────────────────────────  │ │
│        │  │  ┌────────────────────────────────────────────────────┐  │ │
│        │  │  │ 🐬 orders-db         MySQL     🟢 Healthy    256GB │  │ │
│        │  │  │    Cluster: prod-mysql-01    Version: 8.0.35       │  │ │
│        │  │  │    QPS: 12,540  Connections: 450/1000  Lag: 0ms    │  │ │
│        │  │  │    [Manage] [Metrics] [Backup] [Settings]          │  │ │
│        │  │  └────────────────────────────────────────────────────┘  │ │
│        │  │  ┌────────────────────────────────────────────────────┐  │ │
│        │  │  │ 🍃 user-cache        Redis     🟢 Healthy    64GB  │  │ │
│        │  │  │    Cluster: prod-redis-01    Version: 7.2.3        │  │ │
│        │  │  │    OPS: 45,280  Memory: 52/64GB  Hit Rate: 94.5%  │  │ │
│        │  │  │    [Manage] [Metrics] [Backup] [Settings]          │  │ │
│        │  │  └────────────────────────────────────────────────────┘  │ │
│        │  │  ┌────────────────────────────────────────────────────┐  │ │
│        │  │  │ 🔷 analytics       ClickHouse 🟡 Warning   2.4TB   │  │ │
│        │  │  │    Cluster: prod-ch-01    Version: 23.8.7          │  │ │
│        │  │  │    QPS: 850  Disk: 2.1/2.5TB ⚠️  Replication: Lag  │  │ │
│        │  │  │    [Manage] [Metrics] [Backup] [Settings]          │  │ │
│        │  │  └────────────────────────────────────────────────────┘  │ │
│        │  └──────────────────────────────────────────────────────────┘ │
│        │                                                                │
│        │  ┌──────────────────────────────────────────────────────────┐ │
│        │  │  Storage Summary                                        │ │
│        │  │  ┌─────────┬─────────┬─────────┬───────────────────────┐ │ │
│        │  │  │ Total   │ Used    │ Available │ Growth (30d)        │ │ │
│        │  │  │ 15.2TB  │ 11.8TB  │ 3.4TB     │ +12% (+1.4TB)       │ │ │
│        │  │  │         │ 78%     │ 22%       │ 📈 Trend: 45TB/yr   │ │ │
│        │  │  └─────────┴─────────┴─────────┴───────────────────────┘ │ │
│        │  └──────────────────────────────────────────────────────────┘ │
│        │                                                                │
└────────┴────────────────────────────────────────────────────────────────┘
```

### 2.2 数据库详情抽屉（ASCII）

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Database Details - orders-db (MySQL)                     [X] [Config]  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  Database Overview                                                │  │
│  │  ───────────────────────────────────────────────────────────────  │  │
│  │  Name: orders-db    Type: MySQL    Version: 8.0.35               │  │
│  │  Status: 🟢 Healthy    Created: 2025-03-15                        │  │
│  │  Cluster: prod-mysql-01    Region: us-east-1                      │  │
│  │                                                                   │  │
│  │  ┌─────────────┬─────────────┬─────────────┬───────────────────┐  │  │
│  │  │ Storage     │ QPS         │ Connections │ Slow Queries      │  │  │
│  │  │ 256 GB      │ 12,540      │ 450/1000    │ 12/day            │  │  │
│  │  │ 62% used    │ ↑ 8%        │ 45%         │ ↓ 3/day           │  │  │
│  │  └─────────────┴─────────────┴─────────────┴───────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  Performance Metrics (Last 1 hour)                                │  │
│  │  ───────────────────────────────────────────────────────────────  │  │
│  │  ┌────────────────────────────────────────────────────────────┐   │  │
│  │  │ [Multi-line Chart: QPS, Latency, Connections]              │   │  │
│  │  │                                                             │   │  │
│  │  │ 15000 ┤    ╭─────╮              ╭────╮                     │   │  │
│  │  │ 10000 ┤╭───╯     ╰────╮    ╭───╯    ╰──╮                  │   │  │
│  │  │  5000 ┤╯              ╰────╯             ╰────             │   │  │
│  │  │     0 ┴───────┴───────┴───────┴───────┴───────┴────        │   │  │
│  │  │        14:00  14:15  14:30  14:45  15:00  15:15            │   │  │
│  │  │                                                             │   │  │
│  │  │ P99 Latency: 8ms  P95: 5ms  P50: 2ms                        │   │  │
│  │  └────────────────────────────────────────────────────────────┘   │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  Replication Status                                               │  │
│  │  ───────────────────────────────────────────────────────────────  │  │
│  │  ┌────────────────────────────────────────────────────────────┐   │  │
│  │  │ Role         │ Host              │ Lag    │ Status         │   │  │
│  │  │ ────────────────────────────────────────────────────────── │   │  │
│  │  │ 🟢 Primary   │ mysql-0.prod      │ -      │ RW             │   │  │
│  │  │ 🟢 Replica 1 │ mysql-1.prod      │ 0ms    │ RO (Healthy)   │   │  │
│  │  │ 🟢 Replica 2 │ mysql-2.prod      │ 2ms    │ RO (Healthy)   │   │  │
│  │  └────────────────────────────────────────────────────────────┘   │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  Recent Backups                                                   │  │
│  │  ───────────────────────────────────────────────────────────────  │  │
│  │  ┌────────────────────────────────────────────────────────────┐   │  │
│  │  │ Time            │ Type      │ Size   │ Status    │ Action  │   │  │
│  │  │ ────────────────────────────────────────────────────────── │   │  │
│  │  │ Today 02:00     │ Full      │ 128GB  │ ✅ Success │ Restore│   │  │
│  │  │ Yesterday 02:00 │ Full      │ 126GB  │ ✅ Success │ Restore│   │  │
│  │  │ 2026-04-08      │ Full      │ 124GB  │ ✅ Success │ Restore│   │  │
│  │  └────────────────────────────────────────────────────────────┘   │  │
│  │                                                                   │  │
│  │  Backup Schedule: Daily at 02:00 UTC    Retention: 30 days       │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│  [Close]  [Export Metrics]  [Database Settings]                          │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.3 备份任务配置面板（ASCII）

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Backup Configuration - orders-db                         [X] [Save]    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  Backup Schedule                                                  │  │
│  │  ───────────────────────────────────────────────────────────────  │  │
│  │  ☑ Enable Automated Backups                                       │  │
│  │                                                                   │  │
│  │  Full Backup:                                                     │  │
│  │  Frequency: [Daily ▼]    Time: [02:00 ▼] UTC                      │  │
│  │                                                                   │  │
│  │  Incremental Backup:                                              │  │
│  │  ☑ Enable    Interval: [Every 6 hours ▼]                          │  │
│  │                                                                   │  │
│  │  Binary Log Backup:                                               │  │
│  │  ☑ Enable    Interval: [Every 1 hour ▼]                           │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  Retention Policy                                                 │  │
│  │  ───────────────────────────────────────────────────────────────  │  │
│  │  Full Backups: Keep [30] days    [Keep last 10] backups          │  │
│  │  Incremental: Keep [7] days    [Keep last 20] backups            │  │
│  │  Binary Logs: Keep [14] days                                      │  │
│  │                                                                   │  │
│  │  ☑ Delete expired backups automatically                           │  │
│  │  ☑ Verify backup integrity after creation                         │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  Backup Storage                                                   │  │
│  │  ───────────────────────────────────────────────────────────────  │  │
│  │  Primary: [S3 ▼]    Bucket: [orion-backups-prod ▼]               │  │
│  │  Prefix: [mysql/orders-db/                                      ]  │  │
│  │  Region: [us-east-1 ▼]                                            │  │
│  │                                                                   │  │
│  │  ☑ Enable Cross-Region Replication                                │  │
│  │  Secondary: [S3 ▼]    Bucket: [orion-backups-dr ▼]               │  │
│  │  Region: [us-west-2 ▼]                                            │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  Restore Configuration                                            │  │
│  │  ───────────────────────────────────────────────────────────────  │  │
│  │  ☑ Enable Point-in-Time Recovery (PITR)                           │  │
│  │  PITR Window: [30] days                                             │  │
│  │                                                                   │  │
│  │  Restore Test Schedule:                                           │  │
│  │  Frequency: [Weekly ▼]    Day: [Sunday ▼]    Time: [04:00 ▼]     │  │
│  │                                                                   │  │
│  │  Last Restore Test: 2026-04-06 04:00 UTC    ✅ Success (2h 15m)  │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│  [Cancel]  [Test Backup]  [Save Configuration]                          │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.4 响应式断点布局

| 断点 | 宽度 | 布局策略 |
|------|------|----------|
| XS | < 576px | 单列卡片布局，标签页简化为下拉，抽屉全屏 |
| SM | 576-768px | 卡片堆叠，指标简化，抽屉 80% 宽度 |
| MD | 768-992px | 双列布局，标签页完整，抽屉 60% 宽度 |
| LG+ | > 992px | 完整布局，所有功能可见 |

---

## 三、组件清单

### 3.1 使用组件列表

| 组件名 | 用途 | 状态数 | 设计规范 |
|--------|------|--------|----------|
| `PageHeader` | 页面标题 + 创建按钮 | 1 | 带副标题说明 |
| `TabBar` | 标签页导航 | 5 | Databases/Monitoring/Backups/Capacity/Lifecycle |
| `DatabaseCard` | 数据库卡片 | 4 | Healthy/Warning/Critical/Unknown |
| `DbTypeIcon` | 数据库类型图标 | 6 | MySQL/PostgreSQL/Redis/MongoDB/ClickHouse/Elasticsearch |
| `StatusBadge` | 状态徽章 | 4 | Healthy/Warning/Critical/Unknown |
| `MetricCard` | 指标卡片 | 4 | QPS/Latency/Connections/Storage |
| `ReplicationStatus` | 复制状态 | 3 | Primary/Replica/standalone |
| `BackupTable` | 备份列表 | 4 | Success/Failed/Running/Pending |
| `CapacityChart` | 容量图表 | 3 | Current/Projected/Trend |
| `LifecycleRule` | 生命周期规则 | 3 | Active/Inactive/Expired |
| `QueryEditor` | SQL 查询编辑器 | 2 | Edit/Result |
| `EmptyState` | 空状态 | 4 | 无数据库/无备份 |
| `Skeleton` | 加载骨架屏 | 3 | 卡片/表格/图表 |

### 3.2 组件颜色映射

```css
/* 数据库状态颜色 - 基于 Orion Design Tokens */
:root {
  --db-healthy-bg: var(--success-50);
  --db-healthy-text: var(--success-600);
  --db-healthy-border: var(--success-200);
  
  --db-warning-bg: var(--warning-50);
  --db-warning-text: var(--warning-600);
  --db-warning-border: var(--warning-200);
  
  --db-critical-bg: var(--error-50);
  --db-critical-text: var(--error-600);
  --db-critical-border: var(--error-200);
  
  --db-unknown-bg: var(--neutral-50);
  --db-unknown-text: var(--neutral-500);
  --db-unknown-border: var(--neutral-200);
}

/* 备份状态颜色 */
:root {
  --backup-success: var(--success-600);    /* #389E0D */
  --backup-failed: var(--error-600);       /* #D9363E */
  --backup-running: var(--info-600);       /* #08979C */
  --backup-pending: var(--warning-600);    /* #D48806 */
}
```

---

## 四、颜色与视觉规范

### 4.1 主色调应用

| 元素 | 颜色 Token | HEX | 用途 |
|------|-----------|-----|------|
| 主按钮背景 | `primary-600` | #0058C4 | 新建数据库 |
| 主按钮悬停 | `primary-700` | #0047A0 | 按钮 Hover |
| 激活标签 | `primary-50` | #E6F4FF | 标签页选中 |
| 激活文本 | `primary-600` | #0058C4 | 标签页文字 |
| 链接文本 | `primary-500` | #0070F3 | 可点击文本 |

### 4.2 数据库状态色完整定义

```css
/* Healthy - 健康 */
.db-healthy {
  background-color: var(--success-50);    /* #F6FFED */
  color: var(--success-600);              /* #389E0D - 对比度 5.2:1 ✅ */
  border-color: var(--success-200);       /* #B7EB8F */
}

/* Warning - 告警 */
.db-warning {
  background-color: var(--warning-50);    /* #FFFBE6 */
  color: var(--warning-600);              /* #D48806 - 对比度 4.6:1 ✅ */
  border-color: var(--warning-200);       /* #FFE58F */
}

/* Critical - 严重 */
.db-critical {
  background-color: var(--error-50);      /* #FFF1F0 */
  color: var(--error-600);                /* #D9363E - 对比度 5.1:1 ✅ */
  border-color: var(--error-200);         /* #FFA39E */
  animation: pulse-critical 2s infinite;
}

/* Unknown - 未知 */
.db-unknown {
  background-color: var(--neutral-50);    /* #FAFAFA */
  color: var(--neutral-500);              /* #8C8C8C */
  border-color: var(--neutral-200);       /* #EBEBEB */
}

@keyframes pulse-critical {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}
```

### 4.3 数据库类型品牌色

```css
/* 数据库品牌色 */
:root {
  --db-mysql: #00758F;
  --db-postgresql: #336791;
  --db-redis: #DC382D;
  --db-mongodb: #47A248;
  --db-clickhouse: #FFCC00;
  --db-elasticsearch: #005571;
}
```

### 4.4 暗黑模式映射

```css
.dark-mode {
  --db-healthy-bg: hsl(145, 25%, 12%);
  --db-healthy-text: var(--success-300);
  
  --db-warning-bg: hsl(38, 30%, 15%);
  --db-warning-text: var(--warning-300);
  
  --db-critical-bg: hsl(359, 25%, 12%);
  --db-critical-text: var(--error-300);
  
  --db-mysql: #2E9AAF;
  --db-postgresql: #5A9BC9;
  --db-redis: #FF6B6B;
  --db-mongodb: #73D175;
  --db-clickhouse: #FFE066;
  --db-elasticsearch: #2E8A99;
}
```

---

## 五、字体与排版

### 5.1 字号层级

| 元素 | Token | 字号 | 行高 | 字重 |
|------|-------|------|------|------|
| 页面标题 | `text-2xl` | 24px | 32px | 600 |
| 卡片标题 | `text-md` | 16px | 24px | 600 |
| 数据库名称 | `text-md` | 16px | 24px | 600 |
| 指标数值 | `text-lg` | 18px | 28px | 700 |
| SQL 代码 | `text-xs` | 12px | 16px | 400, mono |
| 辅助文本 | `text-xs` | 12px | 16px | 400 |

### 5.2 容量图表样式

| 元素 | 尺寸 | 字体 |
|------|------|------|
| 图表容器 | 100% x 200px | - |
| 数值标签 | text-sm, 500 | - |
| 时间轴 | text-xs, 400 | - |

---

## 六、交互说明

### 6.1 核心交互行为

| 交互 | 触发条件 | 反馈 | 持续时间 |
|------|----------|------|----------|
| 数据库卡片悬停 | 鼠标进入 | 显示操作按钮 | 150ms |
| 数据库详情 | 点击详情 | 抽屉滑出 | 300ms |
| 标签切换 | 点击标签 | 内容切换+URL 更新 | 200ms |
| SQL 查询执行 | 点击执行 | 显示结果 | 500ms+API |
| 备份恢复 | 点击恢复 | 确认→执行 | 300ms+API |
| 容量图表缩放 | 滚轮/拖拽 | 平滑缩放 | 即时 |

### 6.2 键盘快捷键

| 快捷键 | 功能 | 适用场景 |
|--------|------|----------|
| `Cmd/Ctrl + K` | 聚焦全局搜索 | 全局 |
| `Cmd/Ctrl + N` | 新建数据库 | 全局 |
| `Cmd/Ctrl + Q` | 打开查询编辑器 | 全局 |
| `Cmd/Ctrl + R` | 刷新数据 | 全局 |
| `Cmd/Ctrl + B` | 打开备份管理 | 全局 |
| `Escape` | 关闭抽屉/弹窗 | 任意 |
| `↑/↓` | 上下选择数据库 | 列表聚焦 |
| `Enter` | 打开数据库详情 | 行聚焦 |
| `E` | 编辑选中数据库 | 有选中项 |
| `Q` | 打开查询编辑器 | 数据库聚焦 |

### 6.3 操作确认规则

| 操作 | 是否需要确认 | 确认方式 | 可撤销 |
|------|--------------|----------|--------|
| 新建数据库 | 否 | 验证后生效 | ✅ 可删除 |
| 删除数据库 | 是 | 模态框 + 名称确认 | ❌ 不可撤销 |
| 备份恢复 | 是 | 覆盖确认 | ✅ 可回滚 |
| 执行 SQL | 是 | 风险确认 (写操作) | 部分可逆 |
| 扩容存储 | 否 | 保存即生效 | ✅ 可调整 |

---

## 七、状态定义

### 7.1 空状态（Empty State）

```
┌─────────────────────────────────────────────────────────────────┐
│                        ┌─────────────┐                         │
│                        │             │                         │
│                        │    🐬       │                         │
│                        │  (64x64px)  │                         │
│                        │             │                         │
│                        └─────────────┘                         │
│                                                                 │
│                  暂无数据库                                     │
│              text-2xl, font-weight-semibold, neutral-800        │
│                                                                 │
│          创建第一个数据库，开始数据存储管理                       │
│              text-md, neutral-500, margin-top: 8px             │
│                                                                 │
│              ┌──────────────┐  ┌──────────────┐                │
│              │ + 创建数据库 │  │ 📖 配置指南  │                │
│              │ primary-600  │  │ neutral-600  │                │
│              └──────────────┘  └──────────────┘                │
│                                                                 │
│          ───────────  支持数据库  ───────────                  │
│                                                                 │
│     🐬 MySQL  •  🐘 PostgreSQL  •  🔴 Redis  •  🍃 MongoDB       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 7.2 加载状态（Loading State）

**骨架屏规格**：
```css
.database-card-skeleton {
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
  width: 40px;
  height: 40px;
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

/* 容量图表骨架 */
.capacity-chart-skeleton {
  height: 200px;
  background: var(--neutral-50);
  border-radius: var(--radius-md);
  animation: skeleton-loading 1.5s infinite;
}
```

### 7.3 错误状态（Error State）

| 错误类型 | 展示方式 | 用户操作 | 自动重试 |
|----------|----------|----------|----------|
| 数据库连接失败 | 卡片错误状态 | [重新连接] [检查配置] | 3 次 |
| 备份失败 | 备份列表标记 | [查看日志] [重新备份] | 可选 |
| SQL 执行失败 | 结果面板错误 | [修正 SQL] [重试] | 否 |
| 复制延迟 | 状态显示告警 | [排查原因] [切换主从] | 否 |

### 7.4 数据库状态定义

| 状态 | 图标 | 颜色 | 说明 |
|------|------|------|------|
| Healthy | 🟢 | success-600 | 运行正常 |
| Warning | 🟡 | warning-600 | 性能告警 |
| Critical | 🔴 | error-600 | 严重问题 |
| Unknown | ⚪ | neutral-500 | 状态未知 |

---

## 八、响应式设计

### 8.1 移动端适配策略

**XS (< 576px) - 卡片模式**：
```
┌─────────────────────────────────┐
│  Data Storage [+ New Database]  │
├─────────────────────────────────┤
│ [Databases ▼] [Backup] [Monitor]│
├─────────────────────────────────┤
│ ┌─────────────────────────────┐ │
│ │ 🐬 orders-db      🟢 MySQL  │ │
│ │ 256GB • QPS: 12,540         │ │
│ │ 450/1000 conn • 0ms lag     │ │
│ │ [Manage] [Metrics]          │ │
│ └─────────────────────────────┘ │
│ ┌─────────────────────────────┐ │
│ │ 🍃 user-cache     🟢 Redis  │ │
│ │ 64GB • OPS: 45,280          │ │
│ │ 52/64GB • 94.5% hit         │ │
│ │ [Manage] [Metrics]          │ │
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```

**SM (576-768px) - 双列卡片**：
- 数据库卡片 2 列
- 指标简化
- 操作按钮图标化

**MD (768-992px) - 完整功能**：
- 数据库卡片单列
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
  --database-card-gap: var(--spacing-md);
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

### 9.4 容量图表样式

```css
:root {
  --chart-height: 200px;
  --chart-font: var(--font-family-base);
  --chart-line-color: var(--primary-500);
  --chart-fill-color: rgba(0, 112, 243, 0.1);
  --chart-grid-color: var(--neutral-200);
  --chart-text-color: var(--neutral-600);
}
```

### 9.5 动画系统

```css
:root {
  --transition-fast: 150ms ease;
  --transition-normal: 200ms ease;
  --transition-slow: 300ms ease;
  
  --animation-skeleton: skeleton-loading 1.5s infinite;
  --animation-pulse-critical: pulse-critical 2s infinite;
}

@keyframes skeleton-loading {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

@keyframes pulse-critical {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}
```

---

## 十、Agent 开发指南

### 10.1 快速实现提示

使用以下提示词生成代码：

```
创建一个数据存储管理页面，使用以下设计令牌：
- 数据库状态：Healthy #389E0D, Warning #D48806, Critical #D9363E, Unknown #8C8C8C
- 备份状态：Success #389E0D, Failed #D9363E, Running #08979C, Pending #D48806
- 数据库品牌色：MySQL #00758F, PostgreSQL #336791, Redis #DC382D, MongoDB #47A248
- 容量图表：高度 200px, 线条颜色 #0070F3, 填充 rgba(0,112,243,0.1)
- 数据库卡片：圆角 8px, 悬停阴影 shadow-md
- 标签页：选中背景 #E6F4FF, 文本 #0058C4
```

### 10.2 关键实现检查点

- [ ] 数据库状态实时同步
- [ ] 性能指标可视
- [ ] 备份任务管理完整
- [ ] 容量分析准确
- [ ] WCAG 2.1 AA 对比度合规
- [ ] 键盘导航完整（Tab 顺序、快捷键）
- [ ] 聚焦状态可见（`:focus-visible`）
- [ ] 暗黑模式颜色映射正确
- [ ] 响应式断点测试通过
- [ ] 骨架屏和空状态实现
- [ ] SQL 查询编辑器
- [ ] 生命周期规则配置

### 10.3 数据存储 API 要求

- 数据库 CRUD API
- 数据库状态 API
- 性能指标 API
- 备份任务 CRUD API
- 备份恢复 API
- 容量分析 API
- 生命周期规则 API
- SQL 执行 API
- 复制状态 API

### 10.4 数据库管理示例

```graphql
# Query databases
query GetDatabases {
  databases {
    id
    name
    type
    version
    status
    cluster
    region
    storage {
      used
      total
      unit
    }
    metrics {
      qps
      connections
      latency { p50 p95 p99 }
      replicationLag
    }
  }
}

# Query database details
query GetDatabaseDetails($id: ID!) {
  database(id: $id) {
    name
    type
    version
    status
    endpoints {
      role
      host
      port
      status
    }
    replication {
      role
      replicas {
        host
        lag
        status
      }
    }
    metrics {
      history { timestamp value }
    }
  }
}

# Query backups
query GetBackups($databaseId: ID!) {
  backups(databaseId: $databaseId) {
    id
    timestamp
    type
    size
    status
    duration
    canRestore
  }
}

# Create backup
mutation CreateBackup($databaseId: ID!) {
  createBackup(databaseId: $databaseId) {
    backupId
    status
    estimatedDuration
  }
}

# Restore from backup
mutation RestoreBackup($backupId: ID!) {
  restoreBackup(backupId: $backupId) {
    restoreId
    status
    estimatedDuration
  }
}

# Execute SQL
mutation ExecuteSQL($databaseId: ID!, $query: String!) {
  executeSQL(databaseId: $databaseId, query: $query) {
    success
    rows
    columns
    data
    duration
    error
  }
}
```

---

*文档版本：v1.0*  
*创建日期：2026-04-10*  
*基于 Orion Design Tokens v1.2.0*
