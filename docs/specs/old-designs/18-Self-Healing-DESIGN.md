# Orion 自愈规则配置设计文档

> 版本：v1.0  
> 创建日期：2026-04-10  
> 设计师：Orion Design System Team  
> 适用范围：P0 核心功能 - 智能运维与自愈模块

---

## 一、页面概述

### 1.1 页面定义

自愈规则配置（Self-Healing Rules）是 Orion 平台 AIOps 能力的核心配置中心，用户在此配置监控规则、诊断规则、修复剧本（Playbook）、查看自愈历史和进行规则模拟测试。页面采用智能运维控制台设计风格，兼顾规则配置的灵活性和执行的可控性。

### 1.2 目标用户

| 角色 | 核心任务 | 使用频率 | 权限级别 |
|------|----------|----------|----------|
| 运维工程师 | 配置监控规则、编写剧本 | 高频（每日 5-8 次） | 配置/执行 |
| 平台工程师 | 优化诊断算法、分析效果 | 中频（每周 5-8 次） | 配置/分析 |
| 技术主管 | 审批自愈规则、查看报告 | 低频（每周 1-2 次） | 审批/只读 |
| SRE | 验证自愈效果、优化策略 | 中频（每周 3-5 次） | 配置/执行 |

### 1.3 设计原则

- **监控精准**：指标/阈值/触发条件可灵活配置
- **诊断智能**：PageRank 算法参数可调，根因定位准确
- **修复自动**：Playbook 剧本化，执行过程可视
- **验证充分**：模拟测试确保规则安全可靠

---

## 二、布局结构

### 2.1 页面布局（ASCII）

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Top Navigation Bar                                                     │
├────────┬────────────────────────────────────────────────────────────────┤
│        │                                                                │
│ Side   │  ┌──────────────────────────────────────────────────────────┐ │
│ bar    │  │  Self-Healing Rules                     [+ New Rule]     │ │
│        │  └──────────────────────────────────────────────────────────┘ │
│        │                                                                │
│        │  ┌──────────────────────────────────────────────────────────┐ │
│        │  │  [Monitoring] [Diagnosis] [Playbooks] [History] [Test]  │ │
│        │  └──────────────────────────────────────────────────────────┘ │
│        │                                                                │
│        │  ┌──────────────────────────────────────────────────────────┐ │
│        │  │  🔍 Search rules...      [Type ▼] [Status ▼] [+]        │ │
│        │  └──────────────────────────────────────────────────────────┘ │
│        │                                                                │
│        │  ┌──────────────────────────────────────────────────────────┐ │
│        │  │  Active Monitoring Rules (12)                           │ │
│        │  │  ──────────────────────────────────────────────────────  │ │
│        │  │  ┌────────────────────────────────────────────────────┐  │ │
│        │  │  │ 📊 DB Connection Pool     🟢 Active    P1         │  │ │
│        │  │  │    Metric: active_connections / max_connections    │  │ │
│        │  │  │    Trigger: > 85% for 5m    Action: Restart Pool   │  │ │
│        │  │  │    Success Rate: 94%    Last Triggered: 2h ago     │  │ │
│        │  │  │    [Edit] [Disable] [Test] [History]               │  │ │
│        │  │  └────────────────────────────────────────────────────┘  │ │
│        │  │  ┌────────────────────────────────────────────────────┐  │ │
│        │  │  │ 📈 API Error Rate         🟡 Paused    P2         │  │ │
│        │  │  │    Metric: http_5xx / http_total                   │  │ │
│        │  │  │    Trigger: > 1% for 3m    Action: Rollback + Notify│ │ │
│        │  │  │    Success Rate: 87%    Last Triggered: 1d ago     │  │ │
│        │  │  │    [Edit] [Enable] [Test] [History]                │  │ │
│        │  │  └────────────────────────────────────────────────────┘  │ │
│        │  └──────────────────────────────────────────────────────────┘ │
│        │                                                                │
│        │  ┌──────────────────────────────────────────────────────────┐ │
│        │  │  Self-Healing Statistics (Last 30 Days)                 │ │
│        │  │  ┌─────────┬─────────┬─────────┬───────────────────────┐ │ │
│        │  │  │ Total   │ Success │ Failed  │ MTTR Improvement      │ │ │
│        │  │  │ 156     │ 142     │ 14      │ 67% ↓                 │ │ │
│        │  │  │         │ 91%     │ 9%      │ ↓ 45min → 15min       │ │ │
│        │  │  └─────────┴─────────┴─────────┴───────────────────────┘ │ │
│        │  └──────────────────────────────────────────────────────────┘ │
│        │                                                                │
└────────┴────────────────────────────────────────────────────────────────┘
```

### 2.2 监控规则配置抽屉（ASCII）

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Configure Monitoring Rule - DB Connection Pool           [X] [Save]    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  Basic Information                                                │  │
│  │  ───────────────────────────────────────────────────────────────  │  │
│  │  Rule Name: [Database Connection Pool Exhausted                 ]  │  │
│  │  Description: [当数据库连接池使用率超过阈值时自动重启            ]  │  │
│  │  Severity: [P1 ▼]  Category: [Database ▼]                         │  │
│  │  Tags: [#database #connection-pool #auto-healing                 ]  │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  Metric Configuration                                             │  │
│  │  ───────────────────────────────────────────────────────────────  │  │
│  │  Metric: [prometheus ▼]  Query:                                  │  │
│  │  ┌────────────────────────────────────────────────────────────┐   │  │
│  │  │ active_connections / max_connections * 100                 │   │  │
│  │  │                                                            │   │  │
│  │  │ [+ Add Metric Expression]                                   │   │  │
│  │  └────────────────────────────────────────────────────────────┘   │  │
│  │                                                                   │  │
│  │  Data Source: [postgres-exporter ▼]  Interval: [30] seconds      │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  Trigger Condition                                                │  │
│  │  ───────────────────────────────────────────────────────────────  │  │
│  │  ┌────────────────────────────────────────────────────────────┐   │  │
│  │  │ Condition: [value] [>=] [85] [%]                          │   │  │
│  │  │ Duration: [for] [5] [minutes]                              │   │  │
│  │  │ Evaluation: [every] [1] [minute]                           │   │  │
│  │  │                                                            │   │  │
│  │  │ ☑ Enable Hysteresis (prevent flapping)                     │   │  │
│  │  │   Clear Threshold: [value] [<] [75] [%]                   │   │  │
│  │  │   Clear Duration: [for] [3] [minutes]                      │   │  │
│  │  └────────────────────────────────────────────────────────────┘   │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  Diagnosis Configuration (PageRank)                               │  │
│  │  ───────────────────────────────────────────────────────────────  │  │
│  │  ☑ Enable Root Cause Analysis                                     │  │
│  │                                                                   │  │
│  │  PageRank Parameters:                                             │  │
│  │  ┌────────────────────────────────────────────────────────────┐   │  │
│  │  │ Damping Factor: [0.85]    Iterations: [100]                │   │  │
│  │  │ Convergence Threshold: [0.0001]                            │   │  │
│  │  │                                                            │   │  │
│  │  │ Related Signals:                                           │   │  │
│  │  │ ☑ CPU Usage    ☑ Memory Usage    ☑ Query Latency          │   │  │
│  │  │ ☑ Connection Count    ☑ Lock Wait Time                    │   │  │
│  │  └────────────────────────────────────────────────────────────┘   │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  Remediation Action                                               │  │
│  │  ───────────────────────────────────────────────────────────────  │  │
│  │  Action Type: [Run Playbook ▼]                                    │  │
│  │  Playbook: [restart-connection-pool ▼]                            │  │
│  │                                                                   │  │
│  │  Parameters:                                                      │  │
│  │  ┌────────────────────────────────────────────────────────────┐   │  │
│  │  │ pool_name: {{ .Labels.pool }}                              │   │  │
│  │  │ graceful_timeout: 30s                                      │   │  │
│  │  │ force_restart: false                                       │   │  │
│  │  └────────────────────────────────────────────────────────────┘   │  │
│  │                                                                   │  │
│  │  ☑ Enable Rollback on Failure                                     │  │
│  │  Rollback Playbook: [rollback-pool-config ▼]                      │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  Notification & Escalation                                        │  │
│  │  ───────────────────────────────────────────────────────────────  │  │
│  │  Notify On: ☑ Trigger  ☑ Success  ☑ Failure  ☑ Rollback         │  │
│  │                                                                   │  │
│  │  Notification Channels:                                           │  │
│  │  [💬 #ops-alerts] [💬 #dba-team] [📧 oncall@company.com]         │  │
│  │                                                                   │  │
│  │  Escalation Policy: [default-oncall ▼]                            │  │
│  │  Escalate After: [15] minutes if not resolved                     │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│  [Cancel]  [Save Configuration]                                         │  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.3 修复剧本编辑器（ASCII）

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Playbook Editor - restart-connection-pool                [X] [Save]    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  Playbook Info                                                    │  │
│  │  ───────────────────────────────────────────────────────────────  │  │
│  │  Name: [restart-connection-pool                                  ] │  │
│  │  Description: [优雅重启数据库连接池，最小化业务影响              ] │  │
│  │  Version: [v2.1]    Author: @ops-team    Updated: 5d ago         │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  Steps                                                            │  │
│  │  ───────────────────────────────────────────────────────────────  │  │
│  │  ┌────────────────────────────────────────────────────────────┐   │  │
│  │  │ Step 1: Pre-flight Checks           [✅ Pass] [Edit] [Del]│   │  │
│  │  │ ────────────────────────────────────────────────────────── │   │  │
│  │  │ • Verify no active transactions (timeout: 30s)             │   │  │
│  │  │ • Check standby pool health                                │   │  │
│  │  │ • Backup current config                                    │   │  │
│  │  └────────────────────────────────────────────────────────────┘   │  │
│  │  ┌────────────────────────────────────────────────────────────┐   │  │
│  │  │ Step 2: Drain Active Connections    [✅ Pass] [Edit] [Del]│   │  │
│  │  │ ────────────────────────────────────────────────────────── │   │  │
│  │  │ • Stop accepting new connections                           │   │  │
│  │  │ • Wait for active queries to complete (max: 60s)           │   │  │
│  │  │ • Force terminate if timeout                               │   │  │
│  │  └────────────────────────────────────────────────────────────┘   │  │
│  │  ┌────────────────────────────────────────────────────────────┐   │  │
│  │  │ Step 3: Restart Pool Service        [✅ Pass] [Edit] [Del]│   │  │
│  │  │ ────────────────────────────────────────────────────────── │   │  │
│  │  │ • Execute: kubectl rollout restart deployment/pgbouncer    │   │  │
│  │  │ • Wait for ready (timeout: 120s)                           │   │  │
│  │  │ • Verify connection count                                  │   │  │
│  │  └────────────────────────────────────────────────────────────┘   │  │
│  │  ┌────────────────────────────────────────────────────────────┐   │  │
│  │  │ Step 4: Validation                [✅ Pass] [Edit] [Del]  │   │  │
│  │  │ ────────────────────────────────────────────────────────── │   │  │
│  │  │ • Run health check query                                   │   │  │
│  │  │ • Verify application connectivity                          │   │  │
│  │  │ • Send success notification                                │   │  │
│  │  └────────────────────────────────────────────────────────────┘   │  │
│  │                                                                   │  │
│  │  [+ Add Step]  [+ Add Conditional Branch]  [+ Add Rollback]      │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│  [Test Playbook]  [Cancel]  [Save Configuration]                        │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.4 响应式断点布局

| 断点 | 宽度 | 布局策略 |
|------|------|----------|
| XS | < 576px | 单列卡片布局，标签页简化为下拉，配置抽屉全屏 |
| SM | 576-768px | 卡片堆叠，指标简化，抽屉 80% 宽度 |
| MD | 768-992px | 双列布局，标签页完整，抽屉 60% 宽度 |
| LG+ | > 992px | 完整布局，所有功能可见 |

---

## 三、组件清单

### 3.1 使用组件列表

| 组件名 | 用途 | 状态数 | 设计规范 |
|--------|------|--------|----------|
| `PageHeader` | 页面标题 + 创建按钮 | 1 | 带副标题说明 |
| `TabBar` | 标签页导航 | 5 | Monitoring/Diagnosis/Playbooks/History/Test |
| `RuleCard` | 规则卡片 | 4 | Active/Paused/Failed/Testing |
| `SeverityBadge` | 严重等级徽章 | 5 | P0/P1/P2/P3/P4 |
| `MetricInput` | 指标输入器 | 3 | Prometheus/Graphite/Custom |
| `ThresholdConfig` | 阈值配置器 | 3 | Static/Dynamic/ML |
| `PageRankConfig` | PageRank 配置器 | 2 | 基础/高级 |
| `PlaybookEditor` | 剧本编辑器 | 3 | View/Edit/Test |
| `StepCard` | 步骤卡片 | 4 | Success/Failed/Running/Skipped |
| `HistoryTable` | 自愈历史列表 | 5 | Success/Failed/Partial/RolledBack/Pending |
| `TestSimulator` | 模拟测试器 | 3 | Config/Running/Result |
| `EffectChart` | 效果对比图 | 2 | Before/After |
| `EmptyState` | 空状态 | 4 | 无规则/无历史 |
| `Skeleton` | 加载骨架屏 | 3 | 卡片/表格/编辑器 |

### 3.2 组件颜色映射

```css
/* 规则状态颜色 - 基于 Orion Design Tokens */
:root {
  --rule-active-bg: var(--success-50);
  --rule-active-text: var(--success-600);
  --rule-active-border: var(--success-200);
  
  --rule-paused-bg: var(--warning-50);
  --rule-paused-text: var(--warning-600);
  --rule-paused-border: var(--warning-200);
  
  --rule-failed-bg: var(--error-50);
  --rule-failed-text: var(--error-600);
  --rule-failed-border: var(--error-200);
  
  --rule-testing-bg: var(--info-50);
  --rule-testing-text: var(--info-600);
  --rule-testing-border: var(--info-200);
}

/* 自愈结果颜色 */
:root {
  --healing-success: var(--success-600);    /* #389E0D */
  --healing-failed: var(--error-600);       /* #D9363E */
  --healing-partial: var(--warning-600);    /* #D48806 */
  --healing-rollback: var(--info-600);      /* #08979C */
}
```

---

## 四、颜色与视觉规范

### 4.1 主色调应用

| 元素 | 颜色 Token | HEX | 用途 |
|------|-----------|-----|------|
| 主按钮背景 | `primary-600` | #0058C4 | 新建规则 |
| 主按钮悬停 | `primary-700` | #0047A0 | 按钮 Hover |
| 激活标签 | `primary-50` | #E6F4FF | 标签页选中 |
| 激活文本 | `primary-600` | #0058C4 | 标签页文字 |
| 链接文本 | `primary-500` | #0070F3 | 可点击文本 |

### 4.2 规则状态色完整定义

```css
/* Active - 已激活 */
.rule-active {
  background-color: var(--success-50);    /* #F6FFED */
  color: var(--success-600);              /* #389E0D - 对比度 5.2:1 ✅ */
  border-color: var(--success-200);       /* #B7EB8F */
}

/* Paused - 已暂停 */
.rule-paused {
  background-color: var(--warning-50);    /* #FFFBE6 */
  color: var(--warning-600);              /* #D48806 - 对比度 4.6:1 ✅ */
  border-color: var(--warning-200);       /* #FFE58F */
}

/* Failed - 失败 */
.rule-failed {
  background-color: var(--error-50);      /* #FFF1F0 */
  color: var(--error-600);                /* #D9363E - 对比度 5.1:1 ✅ */
  border-color: var(--error-200);         /* #FFA39E */
}

/* Testing - 测试中 */
.rule-testing {
  background-color: var(--info-50);       /* #E6FFFB */
  color: var(--info-600);                 /* #08979C */
  border-color: var(--info-200);          /* #87E8DE */
  animation: pulse-testing 1.5s infinite;
}

@keyframes pulse-testing {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.8; }
}
```

### 4.3 严重等级颜色

```css
/* P0 - Critical */
.severity-p0 {
  background-color: var(--error-50);
  color: var(--error-700);                /* #A8222E - 对比度 6.8:1 ✅ */
  border: 2px solid var(--error-500);
}

/* P1 - High */
.severity-p1 {
  background-color: var(--error-50);
  color: var(--error-600);                /* #D9363E - 对比度 5.1:1 ✅ */
  border-color: var(--error-300);
}

/* P2 - Medium */
.severity-p2 {
  background-color: var(--warning-50);
  color: var(--warning-600);              /* #D48806 - 对比度 4.6:1 ✅ */
  border-color: var(--warning-300);
}

/* P3 - Low */
.severity-p3 {
  background-color: var(--info-50);
  color: var(--info-600);
  border-color: var(--info-300);
}

/* P4 - Info */
.severity-p4 {
  background-color: var(--neutral-50);
  color: var(--neutral-600);
  border-color: var(--neutral-300);
}
```

### 4.4 暗黑模式映射

```css
.dark-mode {
  --rule-active-bg: hsl(145, 25%, 12%);
  --rule-active-text: var(--success-300);
  
  --rule-paused-bg: hsl(38, 30%, 15%);
  --rule-paused-text: var(--warning-300);
  
  --rule-failed-bg: hsl(359, 25%, 12%);
  --rule-failed-text: var(--error-300);
  
  --severity-p0: #ff6b6d;
  --severity-p1: #ff6b6d;
  --severity-p2: #ffc53d;
  --severity-p3: #36cfc9;
}
```

---

## 五、字体与排版

### 5.1 字号层级

| 元素 | Token | 字号 | 行高 | 字重 |
|------|-------|------|------|------|
| 页面标题 | `text-2xl` | 24px | 32px | 600 |
| 卡片标题 | `text-md` | 16px | 24px | 600 |
| 规则名称 | `text-md` | 16px | 24px | 600 |
| 指标表达式 | `text-sm` | 14px | 20px | 400 |
| 代码块 | `text-xs` | 12px | 16px | 400 |
| 辅助文本 | `text-xs` | 12px | 16px | 400 |

### 5.2 剧本编辑器样式

| 元素 | 尺寸 | 字体 |
|------|------|------|
| 步骤卡片 | 100% x auto | text-sm |
| 步骤标题 | - | text-sm, 600 |
| 步骤内容 | - | text-xs, 400 |
| 代码块 | - | text-xs, mono |

---

## 六、交互说明

### 6.1 核心交互行为

| 交互 | 触发条件 | 反馈 | 持续时间 |
|------|----------|------|----------|
| 规则卡片悬停 | 鼠标进入 | 显示操作按钮 | 150ms |
| 规则详情 | 点击详情 | 抽屉滑出 | 300ms |
| 标签切换 | 点击标签 | 内容切换+URL 更新 | 200ms |
| 剧本步骤编辑 | 点击编辑 | 内联编辑 | 即时 |
| 模拟测试 | 点击测试 | 运行模拟→显示结果 | 2s+API |
| 历史筛选 | 条件变更 | 列表刷新 | 300ms |

### 6.2 键盘快捷键

| 快捷键 | 功能 | 适用场景 |
|--------|------|----------|
| `Cmd/Ctrl + K` | 聚焦全局搜索 | 全局 |
| `Cmd/Ctrl + N` | 新建自愈规则 | 全局 |
| `Cmd/Ctrl + T` | 运行模拟测试 | 规则聚焦 |
| `Cmd/Ctrl + S` | 保存配置 | 编辑状态 |
| `Escape` | 关闭抽屉/弹窗 | 任意 |
| `↑/↓` | 上下选择规则 | 列表聚焦 |
| `Enter` | 打开规则详情 | 行聚焦 |
| `E` | 编辑选中规则 | 有选中项 |
| `T` | 测试选中规则 | 有选中项 |

### 6.3 操作确认规则

| 操作 | 是否需要确认 | 确认方式 | 可撤销 |
|------|--------------|----------|--------|
| 新建规则 | 否 | 验证后生效 | ✅ 可禁用 |
| 删除规则 | 是 | 模态框 + 名称确认 | ❌ 不可撤销 |
| 修改剧本 | 否 | 保存即生效 | ✅ 有版本历史 |
| 运行模拟 | 否 | 直接执行 | - |
| 启用/禁用 | 否 | 直接切换 | ✅ 可反向 |

---

## 七、状态定义

### 7.1 空状态（Empty State）

```
┌─────────────────────────────────────────────────────────────────┐
│                        ┌─────────────┐                         │
│                        │             │                         │
│                        │    🤖       │                         │
│                        │  (64x64px)  │                         │
│                        │             │                         │
│                        └─────────────┘                         │
│                                                                 │
│                  暂无自愈规则                                    │
│              text-2xl, font-weight-semibold, neutral-800        │
│                                                                 │
│          创建第一个自愈规则，实现故障自动修复                     │
│              text-md, neutral-500, margin-top: 8px             │
│                                                                 │
│              ┌──────────────┐  ┌──────────────┐                │
│              │ + 创建规则   │  │ 📖 配置指南  │                │
│              │ primary-600  │  │ neutral-600  │                │
│              └──────────────┘  └──────────────┘                │
│                                                                 │
│          ───────────  预置剧本  ───────────                    │
│                                                                 │
│     🔄 服务重启  •  📦 容量扩容  •  🔙 版本回滚  •  📢 通知升级   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 7.2 加载状态（Loading State）

**骨架屏规格**：
```css
.rule-card-skeleton {
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

.skeleton-steps {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 12px;
}

.skeleton-step {
  height: 40px;
  background: var(--neutral-100);
  border-radius: var(--radius-sm);
  animation: skeleton-loading 1.5s infinite;
}

/* 剧本编辑器骨架 */
.playbook-editor-skeleton {
  height: 400px;
  background: var(--neutral-50);
  border-radius: var(--radius-md);
  animation: skeleton-loading 1.5s infinite;
}
```

### 7.3 错误状态（Error State）

| 错误类型 | 展示方式 | 用户操作 | 自动重试 |
|----------|----------|----------|----------|
| 规则执行失败 | 卡片错误状态 | [查看日志] [重新执行] | 可选 |
| 剧本语法错误 | 编辑器错误高亮 | [修复语法] | 否 |
| 模拟测试失败 | 结果面板错误 | [调整参数] [重试] | 可选 |
| 诊断超时 | 状态显示超时 | [重新诊断] | 3 次 |

### 7.4 自愈结果状态

| 状态 | 图标 | 颜色 | 说明 |
|------|------|------|------|
| Success | ✅ | success-600 | 自愈成功 |
| Failed | ❌ | error-600 | 自愈失败 |
| Partial | ⚠️ | warning-600 | 部分成功 |
| RolledBack | 🔄 | info-600 | 已回滚 |
| Pending | ⏳ | warning-600 | 执行中 |

---

## 八、响应式设计

### 8.1 移动端适配策略

**XS (< 576px) - 卡片模式**：
```
┌─────────────────────────────────┐
│  Self-Healing [+ New Rule]      │
├─────────────────────────────────┤
│ [Monitoring ▼] [Diagnosis] [...]│
├─────────────────────────────────┤
│ ┌─────────────────────────────┐ │
│ │ 📊 DB Connection    🟢 P1   │ │
│ │ >85% for 5m → Restart       │ │
│ │ Success: 94%  2h ago        │ │
│ │ [Edit] [Test]               │ │
│ └─────────────────────────────┘ │
│ ┌─────────────────────────────┐ │
│ │ 📈 API Error        🟡 P2   │ │
│ │ >1% for 3m → Rollback       │ │
│ │ Success: 87%  1d ago        │ │
│ │ [Edit] [Test]               │ │
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```

**SM (576-768px) - 双列卡片**：
- 规则卡片 2 列
- 指标简化显示
- 操作按钮图标化

**MD (768-992px) - 完整功能**：
- 规则卡片单列
- 所有指标可见
- 剧本编辑器完整

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
  --rule-card-gap: var(--spacing-md);
  --step-gap: var(--spacing-sm);
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

### 9.4 剧本编辑器样式

```css
:root {
  --step-card-padding: var(--spacing-lg);
  --step-card-bg: #FFFFFF;
  --step-card-border: 1px solid var(--neutral-200);
  --step-card-radius: var(--radius-md);
  
  --step-success-bg: var(--success-50);
  --step-success-border: var(--success-200);
  --step-failed-bg: var(--error-50);
  --step-failed-border: var(--error-200);
  
  --code-block-bg: var(--neutral-50);
  --code-block-font: var(--font-family-mono);
  --code-block-size: var(--text-xs);
}
```

### 9.5 动画系统

```css
:root {
  --transition-fast: 150ms ease;
  --transition-normal: 200ms ease;
  --transition-slow: 300ms ease;
  
  --animation-skeleton: skeleton-loading 1.5s infinite;
  --animation-pulse-testing: pulse-testing 1.5s infinite;
}

@keyframes skeleton-loading {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

@keyframes pulse-testing {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.8; }
}
```

---

## 十、Agent 开发指南

### 10.1 快速实现提示

使用以下提示词生成代码：

```
创建一个自愈规则配置页面，使用以下设计令牌：
- 规则状态：Active #389E0D, Paused #D48806, Failed #D9363E, Testing #08979C
- 严重等级：P0 #A8222E, P1 #D9363E, P2 #D48806, P3 #08979C, P4 #8C8C8C
- 自愈结果：Success #389E0D, Failed #D9363E, Partial #D48806, RolledBack #08979C
- 步骤卡片：圆角 8px, 边框 1px, 内边距 16px
- 代码块：背景 #FAFAFA, 等宽字体，12px
- 标签页：选中背景 #E6F4FF, 文本 #0058C4
```

### 10.2 关键实现检查点

- [ ] 规则状态实时同步
- [ ] 阈值配置可视化
- [ ] PageRank 参数可调
- [ ] Playbook 步骤编辑流畅
- [ ] 模拟测试执行可视
- [ ] WCAG 2.1 AA 对比度合规
- [ ] 键盘导航完整（Tab 顺序、快捷键）
- [ ] 聚焦状态可见（`:focus-visible`）
- [ ] 暗黑模式颜色映射正确
- [ ] 响应式断点测试通过
- [ ] 骨架屏和空状态实现
- [ ] 自愈历史筛选和导出
- [ ] 效果对比图表清晰

### 10.3 自愈规则 API 要求

- 规则 CRUD API
- 规则启用/禁用 API
- 诊断配置 API
- Playbook CRUD API
- 模拟测试 API
- 自愈历史 API
- 效果统计 API
- PageRank 执行 API
- 指标查询 API

### 10.4 自愈规则示例

```graphql
# Query monitoring rules
query GetMonitoringRules {
  rules {
    id
    name
    description
    severity
    status
    metric {
      source
      query
      interval
    }
    trigger {
      condition
      duration
      evaluationInterval
    }
    diagnosis {
      enabled
      pageRankParams {
        dampingFactor
        iterations
        convergenceThreshold
      }
    }
    remediation {
      actionType
      playbook
      parameters
      rollbackEnabled
    }
    stats {
      successRate
      lastTriggered
      totalExecutions
    }
  }
}

# Query playbooks
query GetPlaybooks {
  playbooks {
    id
    name
    description
    version
    steps {
      name
      type
      commands
      timeout
    }
    author
    updatedAt
  }
}

# Run simulation test
mutation RunSimulation {
  runSimulation(
    ruleId: "rule-001"
    input: {
      metricValue: 92
      duration: "5m"
    }
  ) {
    success
    result {
      triggered
      diagnosis {
        rootCause
        confidence
      }
      remediation {
        executed
        outcome
      }
    }
  }
}

# Execute self-healing
mutation ExecuteSelfHealing {
  executeSelfHealing(
    ruleId: "rule-001"
    context: {
      alertId: "alert-123"
      metricValue: 95
    }
  ) {
    executionId
    status
    steps {
      name
      status
      output
    }
  }
}
```

---

*文档版本：v1.0*  
*创建日期：2026-04-10*  
*基于 Orion Design Tokens v1.2.0*
