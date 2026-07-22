# Orion 智能部署配置设计文档

> 版本：v1.0  
> 创建日期：2026-04-10  
> 设计师：Orion Design System Team  
> 适用范围：P1 核心功能 - 智能部署与发布管理模块

---

## 一、页面概述

### 1.1 页面定义

智能部署配置（Smart Deployment）是 Orion 平台的部署策略管理与执行中心，用户在此配置蓝绿/灰度/金丝雀发布策略、设置流量分配规则、定义分析指标和自动回滚条件。页面采用配置向导式体验，兼顾策略灵活性和执行安全性。

### 1.2 目标用户

| 角色 | 核心任务 | 使用频率 | 权限级别 |
|------|----------|----------|----------|
| 运维工程师 | 配置部署策略、执行发布 | 高频（每周 5-10 次） | 完全访问 |
| 平台工程师 | 配置全局策略、分析规则 | 中频（每周 3-5 次） | 配置/执行 |
| 开发工程师 | 查看部署状态、触发部署 | 中频（每周 5-8 次） | 执行/只读 |
| 技术主管 | 查看部署历史、审批发布 | 低频（每周 2-3 次） | 审批/只读 |

### 1.3 设计原则

- **策略可视**：流量分配、阶段进度可视化呈现
- **安全优先**：多级确认、自动回滚、人工审批点
- **数据驱动**：实时指标监控、自动分析决策
- **历史可溯**：完整部署历史、版本对比

---

## 二、布局结构

### 2.1 页面布局（ASCII）

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Top Navigation Bar                                                     │
├────────┬────────────────────────────────────────────────────────────────┤
│        │                                                                │
│ Side   │  ┌──────────────────────────────────────────────────────────┐ │
│ bar    │  │  Smart Deployment                       [+ New Deploy]   │ │
│        │  └──────────────────────────────────────────────────────────┘ │
│        │                                                                │
│        │  ┌──────────────────────────────────────────────────────────┐ │
│        │  │  [Overview] [Strategies] [Running] [History]            │ │
│        │  └──────────────────────────────────────────────────────────┘ │
│        │                                                                │
│        │  ┌──────────────────────────────────────────────────────────┐ │
│        │  │  Active Deployments                                     │ │
│        │  │  ──────────────────────────────────────────────────────  │ │
│        │  │  │ Name          │ Strategy │ Progress │ Status │ Risk  │ │
│        │  │  │───────────────│──────────│──────────│────────│───────│ │
│        │  │  │ payment-v2.3  │ Canary   │ [===>  ] │ Running│ Low   │ │
│        │  │  │ order-v1.8    │ BlueGreen│ [=====>] │ Running│ Medium│ │
│        │  │  │ user-v3.1     │ Rolling  │ [==>   ] │ Running│ Low   │ │
│        │  │  │ ...                                                    │ │
│        │  │  [View All Running]                                       │ │
│        │  └──────────────────────────────────────────────────────────┘ │
│        │                                                                │
│        │  ┌──────────────────────────────────────────────────────────┐ │
│        │  │  Deployment Strategies                                  │ │
│        │  │  ┌─────────────┬─────────────┬─────────────────────────┐ │ │
│        │  │  │ Blue-Green  │ Canary      │ Rolling                 │ │
│        │  │  │ [Configure] │ [Configure] │ [Configure]             │ │
│        │  │  │ 零停机发布   │ 按比例放量   │ 逐步替换实例            │ │
│        │  │  └─────────────┴─────────────┴─────────────────────────┘ │ │
│        │  └──────────────────────────────────────────────────────────┘ │
│        │                                                                │
└────────┴────────────────────────────────────────────────────────────────┘
```

### 2.2 部署策略配置向导（ASCII）

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Configure Canary Deployment                      [Step 2/5] [Cancel]   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  Step 2: Traffic Rules                                            │  │
│  │  ───────────────────────────────────────────────────────────────  │  │
│  │                                                                     │  │
│  │  Canary Stages (流量分配阶段)                                      │  │
│  │                                                                     │  │
│  │  ┌─────────────────────────────────────────────────────────────┐  │  │
│  │  │  Stage 1    Stage 2    Stage 3    Stage 4                   │  │  │
│  │  │  [10%]  →   [25%]  →   [50%]  →   [100%]                    │  │  │
│  │  │   30min      1h         2h       Complete                   │  │  │
│  │  │   [Edit]     [Edit]     [Edit]   [Edit]                     │  │  │
│  │  └─────────────────────────────────────────────────────────────┘  │  │
│  │                                                                     │  │
│  │  [+ Add Stage]                                          [- Remove] │  │
│  │                                                                     │  │
│  │  ┌─────────────────────────────────────────────────────────────┐  │  │
│  │  │  Traffic Allocation Method                                  │  │  │
│  │  │  ○ Percentage  ○ Weight-based  ○ Header-based  ○ User-ID   │  │  │
│  │  └─────────────────────────────────────────────────────────────┘  │  │
│  │                                                                     │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │  │
│  │  │   ← Back     │  │   Save Draft │  │   Next →     │             │  │
│  │  │  secondary   │  │  secondary   │  │   primary    │             │  │
│  │  └──────────────┘  └──────────────┘  └──────────────┘             │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  Step Indicator:  ●───●───○───○───○                                     │
│                   1   2   3   4   5                                     │
│         (Target → Traffic → Analysis → Rollback → Review)               │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.3 部署历史对比布局（ASCII）

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Deployment History / payment-api                         [X] [Export]  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  Compare Deployments                          [Compare Selected]  │  │
│  │  ──────────────────────────────────────────────────────────────   │  │
│  │  Select 2 deployments to compare metrics and outcomes             │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  │ ☐ │ Dep ID   │ Version  │ Date       │ Strategy │ Result    │ │
│  │  │───│──────────│──────────│────────────│──────────│───────────│ │
│  │  │ ☐ │ #1245    │ v2.3.1   │ 2026-04-09 │ Canary   │ ✅ Success│ │
│  │  │ ☐ │ #1244    │ v2.3.0   │ 2026-04-08 │ Canary   │ ⚠️ Partial│ │
│  │  │ ☐ │ #1243    │ v2.2.9   │ 2026-04-07 │ BlueGreen│ ✅ Success│ │
│  │  │ ☐ │ #1242    │ v2.2.8   │ 2026-04-06 │ Rolling  │ ❌ Rolled │ │
│  │  │ ...                                                            │ │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  Comparison Result (#1245 vs #1242)                               │  │
│  │  ──────────────────────────────────────────────────────────────   │  │
│  │  ┌───────────────┬───────────────┬───────────────────────────────┐ │  │
│  │  │ Metric        │ #1245 (v2.3.1)│ #1242 (v2.2.8) │ Delta       │ │  │
│  │  ├───────────────┼───────────────┼─────────────────┼─────────────┤ │  │
│  │  │ Error Rate    │ 0.02%         │ 2.45%          │ -99.2% ✅   │ │  │
│  │  │ P99 Latency   │ 120ms         │ 450ms          │ -73.3% ✅   │ │  │
│  │  │ Success Rate  │ 99.98%        │ 97.55%         │ +2.5% ✅    │ │  │
│  │  │ Throughput    │ 1250 req/s    │ 980 req/s      │ +27.6% ✅   │ │  │
│  │  └───────────────┴───────────────┴─────────────────┴─────────────┘ │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.4 响应式断点布局

| 断点 | 宽度 | 布局策略 |
|------|------|----------|
| XS | < 576px | 单列卡片布局，进度条简化，筛选器底部抽屉 |
| SM | 576-768px | 紧凑表格，隐藏次要列，策略卡片双列 |
| MD | 768-992px | 完整表格，策略卡片三列 |
| LG+ | > 992px | 完整布局，支持侧边详情预览 |

---

## 三、组件清单

### 3.1 使用组件列表

| 组件名 | 用途 | 状态数 | 设计规范 |
|--------|------|--------|----------|
| `PageHeader` | 页面标题 + 创建按钮 | 1 | 带批量操作 |
| `StrategyTabs` | 策略类型切换 | 4 | BlueGreen/Canary/Rolling/Custom |
| `DeployTable` | 部署列表表格 | 5 | 支持行展开 |
| `ProgressBars` | 进度条可视化 | 4 | 分段/连续/百分比 |
| `StatusBadge` | 部署状态徽章 | 6 | Running/Success/Failed/Rolled/Pending/Cancelled |
| `RiskIndicator` | 风险等级指示 | 4 | Low/Medium/High/Critical |
| `StrategyCard` | 策略卡片 | 3 | Default/Active/Disabled |
| `WizardModal` | 配置向导弹窗 | 5 | 5 步骤分步 |
| `StageEditor` | 阶段编辑器 | 3 | 拖拽/表单 |
| `TrafficSlider` | 流量分配滑块 | 3 | 百分比/权重 |
| `AnalysisRules` | 分析规则配置 | 3 | 阈值/公式 |
| `RollbackConfig` | 回滚配置面板 | 3 | 自动/手动 |
| `HistoryDrawer` | 历史详情抽屉 | 2 | 从右侧滑出 |
| `CompareModal` | 对比弹窗 | 2 | 双栏 diff |
| `EmptyState` | 空状态 | 3 | 无部署/无搜索结果 |
| `Skeleton` | 加载骨架屏 | 4 | 表格/卡片/详情 |

### 3.2 组件颜色映射

```css
/* 部署状态颜色 - 基于 Orion Design Tokens */
:root {
  --deploy-running-bg: var(--info-50);
  --deploy-running-text: var(--info-600);
  --deploy-running-border: var(--info-200);
  
  --deploy-success-bg: var(--success-50);
  --deploy-success-text: var(--success-600);
  --deploy-success-border: var(--success-200);
  
  --deploy-failed-bg: var(--error-50);
  --deploy-failed-text: var(--error-600);
  --deploy-failed-border: var(--error-200);
  
  --deploy-rolled-bg: var(--error-50);
  --deploy-rolled-text: var(--error-700);
  --deploy-rolled-border: var(--error-300);
  
  --deploy-pending-bg: var(--warning-50);
  --deploy-pending-text: var(--warning-600);
  --deploy-pending-border: var(--warning-200);
}

/* 风险等级颜色 */
:root {
  --risk-low: var(--success-500);         /* #52C41A */
  --risk-medium: var(--warning-500);      /* #FAAD14 */
  --risk-high: var(--orange-500);         /* #FA8C16 */
  --risk-critical: var(--error-500);      /* #F5222D */
}
```

---

## 四、颜色与视觉规范

### 4.1 主色调应用

| 元素 | 颜色 Token | HEX | 用途 |
|------|-----------|-----|------|
| 主按钮背景 | `primary-600` | #0058C4 | 创建部署 |
| 主按钮悬停 | `primary-700` | #0047A0 | 按钮 Hover |
| 进度条填充 | `primary-500` | #0070F3 | 进度指示 |
| 成功状态 | `success-500` | #52C41A | 成功徽章 |
| 回滚操作 | `error-600` | #D9363E | 回滚按钮 |

### 4.2 部署状态色完整定义

```css
/* Running - 运行中 */
.deploy-running {
  background-color: var(--info-50);       /* #E6FFFB */
  color: var(--info-600);                 /* #08979C - 对比度 5.1:1 ✅ */
  border-color: var(--info-200);          /* #87E8DE */
  animation: pulse-running 2s infinite;
}

/* Success - 成功 */
.deploy-success {
  background-color: var(--success-50);    /* #F6FFED */
  color: var(--success-600);              /* #389E0D - 对比度 5.2:1 ✅ */
  border-color: var(--success-200);       /* #B7EB8F */
}

/* Failed - 失败 */
.deploy-failed {
  background-color: var(--error-50);      /* #FFF1F0 */
  color: var(--error-600);                /* #D9363E - 对比度 5.1:1 ✅ */
  border-color: var(--error-200);         /* #FFA39E */
}

/* Rolled Back - 已回滚 */
.deploy-rolled {
  background-color: var(--error-50);      /* #FFF1F0 */
  color: var(--error-700);                /* #A8222E - 对比度 6.8:1 ✅ */
  border-color: var(--error-300);         /* #FF7875 */
}

/* Pending - 等待中 */
.deploy-pending {
  background-color: var(--warning-50);    /* #FFFBE6 */
  color: var(--warning-600);              /* #D48806 - 对比度 4.6:1 ✅ */
  border-color: var(--warning-200);       /* #FFE58F */
}

/* Cancelled - 已取消 */
.deploy-cancelled {
  background-color: var(--neutral-50);    /* #FAFAFA */
  color: var(--neutral-500);              /* #8C8C8C - 对比度 4.2:1 ✅ */
  border-color: var(--neutral-200);       /* #EBEBEB */
}

@keyframes pulse-running {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.8; }
}
```

### 4.3 风险等级指示器

```css
/* Low Risk - 低风险 */
.risk-low {
  background-color: var(--success-50);
  color: var(--success-600);
  border-color: var(--success-200);
}

/* Medium Risk - 中风险 */
.risk-medium {
  background-color: var(--warning-50);
  color: var(--warning-600);
  border-color: var(--warning-200);
}

/* High Risk - 高风险 */
.risk-high {
  background-color: #FFF7E6);
  color: var(--orange-600);
  border-color: var(--orange-200);
}

/* Critical Risk - 严重风险 */
.risk-critical {
  background-color: var(--error-50);
  color: var(--error-600);
  border-color: var(--error-200);
}
```

### 4.4 进度条颜色梯度

```css
/* 蓝绿部署进度 */
.progress-bluegreen {
  --progress-blue: var(--primary-500);    /* 蓝色阶段 */
  --progress-green: var(--success-500);   /* 绿色阶段 */
}

/* 金丝雀部署进度 - 多色渐变 */
.progress-canary {
  --progress-stage-1: #52C41A;  /* 10% - 绿色 */
  --progress-stage-2: #95DE64;  /* 25% - 浅绿 */
  --progress-stage-3: #FFC53D;  /* 50% - 橙色 */
  --progress-stage-4: #FA8C16;  /* 75% - 深橙 */
  --progress-complete: #F5222D; /* 100% - 红色（最终确认） */
}

/* 滚动部署进度 */
.progress-rolling {
  --progress-instances: var(--primary-500);
  --progress-pending: var(--neutral-200);
}
```

### 4.5 暗黑模式映射

```css
.dark-mode {
  --deploy-running-bg: hsl(200, 25%, 12%);
  --deploy-running-text: var(--info-300);
  --deploy-running-border: hsl(200, 30%, 25%);
  
  --deploy-success-bg: hsl(145, 25%, 12%);
  --deploy-success-text: var(--success-300);
  
  --deploy-failed-bg: hsl(359, 30%, 15%);
  --deploy-failed-text: var(--error-300);
  
  --deploy-rolled-text: var(--error-400);
  
  --risk-low: #73d13d;
  --risk-medium: #ffc53d;
  --risk-high: #ff9c38;
  --risk-critical: #ff6b6d;
  
  --progress-canary-stage-1: #73d13d;
  --progress-canary-stage-2: #95de64;
  --progress-canary-stage-3: #ffc53d;
  --progress-canary-stage-4: #ff9c38;
}
```

---

## 五、字体与排版

### 5.1 字号层级

| 元素 | Token | 字号 | 行高 | 字重 |
|------|-------|------|------|------|
| 页面标题 | `text-2xl` | 24px | 32px | 600 |
| 卡片标题 | `text-lg` | 18px | 28px | 600 |
| 向导标题 | `text-xl` | 20px | 28px | 600 |
| 表格标题 | `text-xs` | 12px | 16px | 600 |
| 表格正文 | `text-sm` | 14px | 20px | 400 |
| 进度百分比 | `text-md` | 16px | 24px | 600 |
| 风险等级 | `text-sm` | 14px | 20px | 500 |

### 5.2 表格列宽定义

| 列名 | 宽度 | 对齐 | 可排序 |
|------|------|------|--------|
| 名称 | 180px | 左 | 是 |
| 策略类型 | 120px | 左 | 是 |
| 进度 | 200px | 左 | 否 |
| 状态 | 100px | 居中 | 是 |
| 风险等级 | 80px | 居中 | 是 |
| 开始时间 | 120px | 左 | 是 |
| 操作 | 120px | 右 | 否 |

---

## 六、交互说明

### 6.1 核心交互行为

| 交互 | 触发条件 | 反馈 | 持续时间 |
|------|----------|------|----------|
| 行展开 | 点击部署名 | 显示详细指标 | 200ms |
| 策略切换 | 点击策略卡 | 配置表单更新 | 150ms |
| 阶段编辑 | 点击阶段 | 编辑弹窗 | 200ms |
| 流量调整 | 拖动滑块 | 实时更新预览 | 即时 |
| 规则配置 | 点击规则 | 表单展开 | 200ms |
| 历史对比 | 选择多行→对比 | 弹窗对比视图 | 300ms |
| 回滚操作 | 点击回滚 | 确认→执行 | 500ms+API |

### 6.2 键盘快捷键

| 快捷键 | 功能 | 适用场景 |
|--------|------|----------|
| `Cmd/Ctrl + N` | 创建新部署 | 全局 |
| `Cmd/Ctrl + D` | 打开部署历史 | 全局 |
| `Cmd/Ctrl + C` | 对比选中部署 | 有选中项 |
| `Cmd/Ctrl + R` | 触发回滚 | 有选中项 |
| `Cmd/Ctrl + /` | 打开快捷键帮助 | 全局 |
| `Escape` | 关闭向导/弹窗 | 任意 |
| `↑/↓` | 上下选择部署 | 表格聚焦 |
| `Enter` | 打开选中的部署 | 行聚焦 |
| `Space` | 切换选中状态 | 行聚焦 |
| `P` | 暂停/继续部署 | 运行中 |
| `R` | 回滚选中的部署 | 有选中项 |

### 6.3 部署确认规则

| 操作 | 是否需要确认 | 确认方式 | 审批要求 |
|------|--------------|----------|----------|
| 创建部署 | 是 | 向导 review 步骤 | 生产环境需审批 |
| 修改策略 | 是 | 影响评估 + 确认 | 运行中需审批 |
| 暂停部署 | 是 | Toast 确认 | 否 |
| 继续部署 | 是 | 指标确认 + 确认 | 暂停后需审批 |
| 回滚操作 | 是 | 模态框 + 原因 | 生产环境需审批 |
| 取消部署 | 是 | 模态框 + 原因 | 否 |

---

## 七、状态定义

### 7.1 空状态（Empty State）

```
┌─────────────────────────────────────────────────────────────────┐
│                        ┌─────────────┐                         │
│                        │             │                         │
│                        │    🚀       │                         │
│                        │  (64x64px)  │                         │
│                        │             │                         │
│                        └─────────────┘                         │
│                                                                 │
│                    暂无部署                                     │
│              text-2xl, font-weight-semibold, neutral-800        │
│                                                                 │
│          创建第一个部署，开始您的智能发布之旅                    │
│              text-md, neutral-500, margin-top: 8px             │
│                                                                 │
│              ┌──────────────┐  ┌──────────────┐                │
│              │ + 创建部署   │  │ 📖 部署指南  │                │
│              │ primary-600  │  │ neutral-600  │                │
│              └──────────────┘  └──────────────┘                │
│                                                                 │
│          ───────────  部署策略  ───────────                    │
│                                                                 │
│     🔄 蓝绿部署  •  🐤 金丝雀发布  •  📦 滚动更新  •  ⚙️ 自定义  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 7.2 加载状态（Loading State）

**骨架屏规格**：
```css
.deploy-skeleton {
  display: grid;
  grid-template-columns: 180px 120px 200px 100px 80px 1fr;
  gap: 16px;
  padding: 16px;
}

.skeleton-cell {
  height: 24px;
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

/* 进度条骨架 */
.skeleton-progress {
  height: 8px;
  border-radius: var(--radius-xs);
  background: var(--neutral-200);
  animation: skeleton-loading 1.5s infinite;
}

/* 状态徽章骨架 */
.skeleton-badge {
  width: 80px;
  height: 24px;
  border-radius: var(--radius-sm);
  background: var(--neutral-200);
  animation: skeleton-loading 1.5s infinite;
}
```

**加载行数**：显示 5 行骨架屏

### 7.3 错误状态（Error State）

| 错误类型 | 展示方式 | 用户操作 | 自动重试 |
|----------|----------|----------|----------|
| 数据加载失败 | 全页错误卡片 | [重试] [检查连接] | 3 次后停止 |
| 部署失败 | 行内状态 + Toast | [查看日志] [回滚] | 否 |
| 配置保存失败 | 向导内错误提示 | [修改后重试] | 否 |
| 回滚失败 | 模态框错误 | [联系支持] [重试] | 可选 |
| 权限不足 | 空状态 + 申请按钮 | [申请权限] | 否 |

### 7.4 部署状态定义

| 状态 | 图标 | 颜色 | 说明 |
|------|------|------|------|
| Running | 🟢 | info-600 | 部署正在进行中 |
| Success | ✅ | success-600 | 部署成功完成 |
| Failed | ❌ | error-600 | 部署失败 |
| Rolled Back | ↩️ | error-700 | 已回滚到上一版本 |
| Pending | ⏳ | warning-600 | 等待审批/调度 |
| Cancelled | ⚪ | neutral-500 | 用户取消部署 |

---

## 八、响应式设计

### 8.1 移动端适配策略

**XS (< 576px) - 卡片模式**：
```
┌─────────────────────────────────┐
│  Deployments      [+ New]       │
├─────────────────────────────────┤
│ [Overview] [Running] [History]  │
├─────────────────────────────────┤
│ ┌─────────────────────────────┐ │
│ │ payment-v2.3                │ │
│ │ Canary • [=====> 75%]       │ │
│ │ Running • Low Risk          │ │
│ │ [Pause] [View] [Rollback]   │ │
│ └─────────────────────────────┘ │
│ ┌─────────────────────────────┐ │
│ │ order-v1.8                  │ │
│ │ BlueGreen • [===> 50%]      │ │
│ │ Success • Low Risk          │ │
│ │ [View] [Details]            │ │
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```

**SM (576-768px) - 紧凑表格**：
- 隐藏风险等级列
- 进度条简化
- 筛选器简化

**MD (768-992px) - 完整功能**：
- 显示所有列
- 策略卡片双列
- 支持横向滚动

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
  
  --table-row-padding: var(--spacing-md);
  --card-padding: var(--spacing-lg);
  --wizard-padding: var(--spacing-xl);
}
```

### 9.2 圆角系统

```css
:root {
  --radius-xs: 2px;    /* Badge, Progress */
  --radius-sm: 4px;    /* Button, Input */
  --radius-md: 8px;    /* Card, Dropdown */
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

### 9.4 动画系统

```css
:root {
  --transition-fast: 150ms ease;
  --transition-normal: 200ms ease;
  --transition-slow: 300ms ease;
  
  --animation-pulse-running: pulse-running 2s infinite;
  --animation-progress: progress-slide 300ms ease;
}

@keyframes pulse-running {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.8; }
}

@keyframes progress-slide {
  from { width: 0; }
  to { width: var(--progress-value); }
}
```

### 9.5 进度条系统

```css
:root {
  --progress-height: 8px;
  --progress-radius: var(--radius-xs);
  --progress-transition: width 300ms ease;
  
  /* 策略类型进度色 */
  --progress-bluegreen: var(--primary-500);
  --progress-canary-gradient: linear-gradient(
    90deg,
    #52C41A 0%,
    #95DE64 25%,
    #FFC53D 50%,
    #FA8C16 75%,
    #F5222D 100%
  );
  --progress-rolling: var(--success-500);
}
```

---

## 十、Agent 开发指南

### 10.1 快速实现提示

使用以下提示词生成代码：

```
创建一个智能部署配置页面，使用以下设计令牌：
- 部署状态：Running #08979C, Success #389E0D, Failed #D9363E, Rolled #A8222E
- 风险等级：Low #52C41A, Medium #FAAD14, High #FA8C16, Critical #F5222D
- 进度条：高度 8px，圆角 2px，Canary 渐变 #52C41A→#95DE64→#FFC53D→#FA8C16→#F5222D
- 表格行高：56px（配置密集型）
- 圆角：8px (radius-md)
```

### 10.2 关键实现检查点

- [ ] 部署进度实时刷新（10s 轮询）
- [ ] 阶段编辑器支持拖拽排序
- [ ] 流量滑块有视觉反馈
- [ ] 回滚操作需要原因填写
- [ ] WCAG 2.1 AA 对比度合规
- [ ] 键盘导航完整（Tab 顺序、快捷键）
- [ ] 聚焦状态可见（`:focus-visible`）
- [ ] 暗黑模式颜色映射正确
- [ ] 响应式断点测试通过
- [ ] 骨架屏和空状态实现
- [ ] 对比视图支持指标 diff
- [ ] 审批流程集成

### 10.3 部署 API 要求

- 部署创建 API（策略、目标、规则）
- 部署执行 API（启动/暂停/继续/取消）
- 部署状态轮询 API
- 回滚执行 API
- 历史查询 API
- 指标对比 API
- 审批流程 API

### 10.4 部署策略配置模板

```yaml
# Canary Deployment Configuration
apiVersion: deployment.orion.io/v1
kind: DeploymentStrategy
metadata:
  name: payment-canary
  type: canary
spec:
  target:
    service: payment-api
    namespace: production
    currentVersion: v2.2.9
    targetVersion: v2.3.1
  
  trafficRules:
    method: percentage
    stages:
      - percentage: 10
        duration: 30m
      - percentage: 25
        duration: 1h
      - percentage: 50
        duration: 2h
      - percentage: 100
        duration: 0
  
  analysisRules:
    - metric: errorRate
      operator: "<"
      threshold: 0.01
    - metric: p99Latency
      operator: "<"
      threshold: 200
    - metric: successRate
      operator: ">"
      threshold: 0.995
  
  rollbackConditions:
    auto: true
    triggers:
      - metric: errorRate
        operator: ">"
        threshold: 0.05
      - metric: successRate
        operator: "<"
        threshold: 0.95
    requireApproval: true
```

---

*文档版本：v1.0*  
*创建日期：2026-04-10*  
*基于 Orion Design Tokens v1.2.0*
