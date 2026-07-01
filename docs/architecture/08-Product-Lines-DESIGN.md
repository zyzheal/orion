# Orion 多分支产品线管理设计文档

> 版本：v1.0  
> 创建日期：2026-04-10  
> 设计师：Orion Design System Team  
> 适用范围：P1 核心功能 - GitOps 与产品线管理模块

---

## 一、页面概述

### 1.1 页面定义

多分支产品线管理（Product Lines）是 Orion 平台 GitOps 工作流的核心配置界面，用户在此管理产品线与 Git 分支的映射关系、配置环境部署策略和绑定团队权限。页面采用配置密集型设计，兼顾批量操作效率和精细控制能力。

### 1.2 目标用户

| 角色 | 核心任务 | 使用频率 | 权限级别 |
|------|----------|----------|----------|
| 平台工程师 | 配置产品线、映射分支 - 环境 | 中频（每周 5-10 次） | 完全访问 |
| 技术主管 | 查看产品线概览、分配权限 | 低频（每周 2-3 次） | 配置/只读 |
| 开发工程师 | 查看所属产品线、申请权限 | 低频（每周 1-2 次） | 只读/申请 |
| 运维工程师 | 监控环境状态、处理部署 | 中频（每周 5-8 次） | 环境/只读 |

### 1.3 设计原则

- **Git 优先**：分支策略可视化，映射关系一目了然
- **环境隔离**：生产/预发/测试环境清晰分离
- **权限精细**：产品线 - 团队 - 用户三级权限绑定
- **批量高效**：支持多产品线批量操作和模板导入

---

## 二、布局结构

### 2.1 页面布局（ASCII）

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Top Navigation Bar                                                     │
├────────┬────────────────────────────────────────────────────────────────┤
│        │                                                                │
│ Side   │  ┌──────────────────────────────────────────────────────────┐ │
│ bar    │  │  Product Lines                        [+ New Line]       │ │
│        │  └──────────────────────────────────────────────────────────┘ │
│        │                                                                │
│        │  ┌──────────────────────────────────────────────────────────┐ │
│        │  │  🔍 Search lines...    [Strategy ▼] [Team ▼] [Status ▼] │ │
│        │  └──────────────────────────────────────────────────────────┘ │
│        │                                                                │
│        │  ┌──────────────────────────────────────────────────────────┐ │
│        │  │  Product Lines                                          │ │
│        │  │  ──────────────────────────────────────────────────────  │ │
│        │  │  │ Name          │ Repo        │ Strategy │ Env  │ Team │ │
│        │  │  │───────────────│─────────────│──────────│──────│──────│ │
│        │  │  │ payment-svc   │ /pay/core   │ GitFlow  │ 5    │ T1   │ │
│        │  │  │ order-svc     │ /ord/core   │ Trunk    │ 3    │ T2   │ │
│        │  │  │ user-svc      │ /usr/core   │ GitHub   │ 4    │ T1   │ │
│        │  │  │ gateway       │ /gw/public  │ GitFlow  │ 6    │ T3   │ │
│        │  │  │ ...                                                    │ │
│        │  │  Showing 1-20 of 89 lines    [Import Template] [Export]  │ │
│        │  └──────────────────────────────────────────────────────────┘ │
│        │                                                                │
│        │  ┌──────────────────────────────────────────────────────────┐ │
│        │  │  Branch-Environment Mapping Preview                     │ │
│        │  │  ┌─────────────┬─────────────┬─────────────────────────┐ │ │
│        │  │  │ main        │ develop     │ feature/*               │ │
│        │  │  ├─────────────┼─────────────┼─────────────────────────┤ │ │
│        │  │  │ Production  │ Staging     │ Dev Environment         │ │
│        │  │  │ [●●●○○]     │ [●●○○○]     │ [●○○○○]                 │ │
│        │  │  └─────────────┴─────────────┴─────────────────────────┘ │ │
│        │  └──────────────────────────────────────────────────────────┘ │
│        │                                                                │
└────────┴────────────────────────────────────────────────────────────────┘
```

### 2.2 创建向导布局（ASCII）

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Create Product Line                              [Step 1/4] [Cancel]   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  Step 1: Basic Information                                        │  │
│  │  ─────────────────────────────────────────────────────────────    │  │
│  │                                                                     │  │
│  │  Product Line Name *                                               │  │
│  │  ┌─────────────────────────────────────────────────────────────┐  │  │
│  │  │ payment-service-v2                                          │  │  │
│  │  └─────────────────────────────────────────────────────────────┘  │  │
│  │                                                                     │  │
│  │  Description                                                        │  │
│  │  ┌─────────────────────────────────────────────────────────────┐  │  │
│  │  │ Payment service product line for v2 architecture            │  │  │
│  │  └─────────────────────────────────────────────────────────────┘  │  │
│  │                                                                     │  │
│  │  ┌──────────────┐  ┌──────────────┐                                │  │
│  │  │   Back       │  │   Next →     │                                │  │
│  │  │  (disabled)  │  │   primary    │                                │  │
│  │  └──────────────┘  └──────────────┘                                │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  Step Indicator:  ●──○──○──○                                            │
│                   1   2   3   4                                         │
│              (Basic → Repo → Strategy → Review)                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.3 响应式断点布局

| 断点 | 宽度 | 布局策略 |
|------|------|----------|
| XS | < 576px | 单列卡片布局，映射预览折叠，筛选器底部抽屉 |
| SM | 576-768px | 紧凑表格，隐藏团队列，映射简化 |
| MD | 768-992px | 完整表格，映射面板底部 |
| LG+ | > 992px | 完整布局，支持侧边详情预览 |

---

## 三、组件清单

### 3.1 使用组件列表

| 组件名 | 用途 | 状态数 | 设计规范 |
|--------|------|--------|----------|
| `PageHeader` | 页面标题 + 创建按钮 | 1 | 带批量操作 |
| `ProductLineTable` | 产品线数据表格 | 5 | 支持行展开 |
| `BranchMappingPreview` | 分支 - 环境映射预览 | 3 | 可视化映射 |
| `RepoSelector` | Git 仓库选择器 | 4 | 搜索 + 最近 |
| `StrategySelector` | 分支策略选择 | 3 | GitFlow/Trunk/GitHub |
| `EnvironmentBadges` | 环境数量徽章 | 2 | 彩色点阵 |
| `TeamBadge` | 团队绑定徽章 | 2 | 可点击跳转 |
| `WizardModal` | 创建向导弹窗 | 5 | 4 步骤分步 |
| `StepIndicator` | 步骤指示器 | 3 | 数字/圆点/进度 |
| `MappingEditor` | 映射关系编辑器 | 3 | 拖拽配置 |
| `PermissionBinder` | 权限绑定面板 | 2 | 团队/用户选择 |
| `SyncStatusIcon` | 集成状态图标 | 4 | 同步/失败/等待/禁用 |
| `EmptyState` | 空状态 | 3 | 无产品线/无搜索结果 |
| `Skeleton` | 加载骨架屏 | 4 | 表格/卡片/表单 |

### 3.2 组件颜色映射

```css
/* 分支策略颜色 - 基于 Orion Design Tokens */
:root {
  --strategy-gitflow-bg: var(--primary-50);
  --strategy-gitflow-text: var(--primary-600);
  --strategy-gitflow-border: var(--primary-200);
  
  --strategy-trunk-bg: var(--success-50);
  --strategy-trunk-text: var(--success-600);
  --strategy-trunk-border: var(--success-200);
  
  --strategy-github-bg: var(--info-50);
  --strategy-github-text: var(--info-600);
  --strategy-github-border: var(--info-200);
  
  --strategy-custom-bg: var(--neutral-50);
  --strategy-custom-text: var(--neutral-600);
  --strategy-custom-border: var(--neutral-200);
}

/* 环境类型颜色 */
:root {
  --env-production: var(--error-500);    /* #F5222D */
  --env-staging: var(--warning-500);     /* #FAAD14 */
  --env-development: var(--info-500);    /* #13C2C2 */
  --env-testing: var(--success-500);     /* #52C41A */
  --env-feature: var(--primary-500);     /* #0070F3 */
}
```

---

## 四、颜色与视觉规范

### 4.1 主色调应用

| 元素 | 颜色 Token | HEX | 用途 |
|------|-----------|-----|------|
| 主按钮背景 | `primary-600` | #0058C4 | 创建产品线 |
| 主按钮悬停 | `primary-700` | #0047A0 | 按钮 Hover |
| 步骤完成 | `success-500` | #52C41A | 向导完成状态 |
| 步骤当前 | `primary-500` | #0070F3 | 当前步骤 |
| 步骤待处理 | `neutral-300` | #D9D9D9 | 未完成步骤 |

### 4.2 分支策略色完整定义

```css
/* GitFlow 策略 */
.strategy-gitflow {
  background-color: var(--primary-50);    /* #E6F4FF */
  color: var(--primary-600);              /* #0058C4 - 对比度 5.8:1 ✅ */
  border-color: var(--primary-200);       /* #91D5FF */
}

/* Trunk Based 策略 */
.strategy-trunk {
  background-color: var(--success-50);    /* #F6FFED */
  color: var(--success-600);              /* #389E0D - 对比度 5.2:1 ✅ */
  border-color: var(--success-200);       /* #B7EB8F */
}

/* GitHub Flow 策略 */
.strategy-github {
  background-color: var(--info-50);       /* #E6FFFB */
  color: var(--info-600);                 /* #08979C - 对比度 5.1:1 ✅ */
  border-color: var(--info-200);          /* #87E8DE */
}

/* 自定义策略 */
.strategy-custom {
  background-color: var(--neutral-50);    /* #FAFAFA */
  color: var(--neutral-600);              /* #666666 - 对比度 5.7:1 ✅ */
  border-color: var(--neutral-200);       /* #EBEBEB */
}
```

### 4.3 环境映射可视化

```css
/* 环境点阵表示法 */
.env-dots {
  display: flex;
  gap: 4px;
}

.env-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: var(--neutral-200);
}

.env-dot.active {
  /* 生产环境 - 红色 */
  &.production { background-color: var(--error-500); }
  /* 预发环境 - 橙色 */
  &.staging { background-color: var(--warning-500); }
  /* 开发环境 - 青色 */
  &.development { background-color: var(--info-500); }
  /* 测试环境 - 绿色 */
  &.testing { background-color: var(--success-500); }
  /* 特性环境 - 蓝色 */
  &.feature { background-color: var(--primary-500); }
}
```

### 4.4 暗黑模式映射

```css
.dark-mode {
  --strategy-gitflow-bg: hsl(210, 30%, 15%);
  --strategy-gitflow-text: var(--primary-300);
  --strategy-gitflow-border: hsl(210, 40%, 25%);
  
  --strategy-trunk-bg: hsl(145, 25%, 12%);
  --strategy-trunk-text: var(--success-300);
  
  --strategy-github-bg: hsl(200, 25%, 12%);
  --strategy-github-text: var(--info-300);
  
  --env-production: #ff6b6d;
  --env-staging: #ffc53d;
  --env-development: #57d0c6;
  --env-testing: #73d13d;
  --env-feature: #40a9ff;
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
| 表单标签 | `text-sm` | 14px | 20px | 500 |
| 步骤指示 | `text-md` | 16px | 24px | 500 |

### 5.2 表格列宽定义

| 列名 | 宽度 | 对齐 | 可排序 |
|------|------|------|--------|
| 名称 | 200px | 左 | 是 |
| Git 仓库 | 180px | 左 | 是 |
| 分支策略 | 120px | 左 | 是 |
| 环境数 | 80px | 居中 | 是 |
| 绑定团队 | 120px | 左 | 是 |
| 集成状态 | 100px | 居中 | 是 |
| 操作 | 120px | 右 | 否 |

---

## 六、交互说明

### 6.1 核心交互行为

| 交互 | 触发条件 | 反馈 | 持续时间 |
|------|----------|------|----------|
| 行展开 | 点击产品名称 | 显示分支映射详情 | 200ms |
| 策略切换 | 下拉选择 | 映射预览更新 | 150ms |
| 仓库选择 | 搜索选择 | 自动填充仓库路径 | 即时 |
| 环境绑定 | 拖拽连接 | 连线动画 + 确认 | 300ms |
| 权限变更 | 点击团队徽章 | 侧边抽屉滑出 | 250ms |
| 批量导入 | 文件上传 | 预览→确认→执行 | 多步骤 |

### 6.2 键盘快捷键

| 快捷键 | 功能 | 适用场景 |
|--------|------|----------|
| `Cmd/Ctrl + N` | 创建新产品线 | 全局 |
| `Cmd/Ctrl + I` | 批量导入 | 全局 |
| `Cmd/Ctrl + E` | 导出配置 | 全局 |
| `Cmd/Ctrl + /` | 打开快捷键帮助 | 全局 |
| `Escape` | 关闭向导/抽屉 | 任意 |
| `↑/↓` | 上下选择产品线 | 表格聚焦 |
| `Enter` | 编辑选中产品线 | 行聚焦 |
| `D` | 删除选中产品线 | 有选中项 |
| `E` | 编辑分支映射 | 行聚焦 |

### 6.3 删除确认规则

| 操作 | 是否需要确认 | 确认方式 | 级联影响 |
|------|--------------|----------|----------|
| 删除产品线 | 是 | 模态框 + 名称确认 | 解绑所有环境 |
| 批量删除 (≥3) | 是 | 模态框 + 原因填写 | 影响多个团队 |
| 修改分支策略 | 是 | 警告提示 + 确认 | 可能影响正在运行的流水线 |
| 解绑团队 | 是 | Toast 确认 | 团队失去访问权限 |

---

## 七、状态定义

### 7.1 空状态（Empty State）

```
┌─────────────────────────────────────────────────────────────────┐
│                        ┌─────────────┐                         │
│                        │             │                         │
│                        │    🌿       │                         │
│                        │  (64x64px)  │                         │
│                        │             │                         │
│                        └─────────────┘                         │
│                                                                 │
│                    暂无产品线                                   │
│              text-2xl, font-weight-semibold, neutral-800        │
│                                                                 │
│          创建第一条产品线，开始您的 GitOps 之旅                  │
│              text-md, neutral-500, margin-top: 8px             │
│                                                                 │
│              ┌──────────────┐  ┌──────────────┐                │
│              │ + 创建产品线 │  │ 📥 导入模板  │                │
│              │ primary-600  │  │ neutral-600  │                │
│              └──────────────┘  └──────────────┘                │
│                                                                 │
│          ───────────  或  ───────────                          │
│                                                                 │
│     📖 了解 GitFlow、Trunk Based、GitHub Flow 分支策略           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 7.2 加载状态（Loading State）

**骨架屏规格**：
```css
.product-line-skeleton {
  display: grid;
  grid-template-columns: 200px 180px 120px 80px 1fr;
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

/* 策略徽章骨架 */
.skeleton-badge {
  width: 80px;
  height: 24px;
  border-radius: var(--radius-sm);
  background: var(--neutral-200);
  animation: skeleton-loading 1.5s infinite;
}

/* 环境点阵骨架 */
.skeleton-dots {
  display: flex;
  gap: 4px;
}

.skeleton-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--neutral-200);
}
```

**加载行数**：显示 5 行骨架屏

### 7.3 错误状态（Error State）

| 错误类型 | 展示方式 | 用户操作 | 自动重试 |
|----------|----------|----------|----------|
| 数据加载失败 | 全页错误卡片 | [重试] [检查连接] | 3 次后停止 |
| Git 集成失败 | 行内状态图标 | [重新连接] [配置] | 否 |
| 创建失败 | 向导内错误提示 | [修改后重试] | 否 |
| 权限不足 | 空状态 + 申请按钮 | [申请权限] | 否 |

### 7.4 Git 集成状态

| 状态 | 图标 | 颜色 | 说明 |
|------|------|------|------|
| 已连接 | ✅ | success-500 | Git 仓库正常同步 |
| 同步中 | 🟡 | warning-500 | 正在拉取/推送 |
| 失败 | ❌ | error-500 | 认证失败或仓库不存在 |
| 禁用 | ⚪ | neutral-400 | 集成已禁用 |

---

## 八、响应式设计

### 8.1 移动端适配策略

**XS (< 576px) - 卡片模式**：
```
┌─────────────────────────────────┐
│  Product Lines    [+ New]       │
├─────────────────────────────────┤
│ ┌─────────────────────────────┐ │
│ │ payment-service             │ │
│ │ /pay/core • GitFlow    🔗   │ │
│ │ Env: ●●●○○  Team: T1       │ │
│ │ [Edit] [Deploy] [More ▼]   │ │
│ └─────────────────────────────┘ │
│ ┌─────────────────────────────┐ │
│ │ order-service               │ │
│ │ /ord/core • Trunk      🔗   │ │
│ │ Env: ●●○○○  Team: T2       │ │
│ │ [Edit] [More ▼]            │ │
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```

**SM (576-768px) - 紧凑表格**：
- 隐藏团队列
- 环境数用徽章显示
- 筛选器简化为图标

**MD (768-992px) - 完整功能**：
- 显示所有列
- 分支映射面板底部
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
  --radius-xs: 2px;    /* Badge, Dot */
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

### 9.4 向导步骤指示器

```css
:root {
  /* 步骤完成状态 */
  --step-complete: var(--success-500);   /* #52C41A */
  /* 当前步骤状态 */
  --step-current: var(--primary-500);    /* #0070F3 */
  /* 待处理状态 */
  --step-pending: var(--neutral-300);    /* #D9D9D9 */
  
  /* 步骤指示器尺寸 */
  --step-dot-size: 32px;
  --step-line-height: 2px;
  --step-gap: 16px;
}
```

### 9.5 分支映射可视化

```css
:root {
  /* 分支卡片 */
  --branch-card-bg: var(--neutral-50);
  --branch-card-border: var(--neutral-200);
  --branch-card-hover: var(--primary-50);
  
  /* 环境卡片 */
  --env-card-bg: var(--neutral-50);
  --env-card-border: var(--neutral-200);
  
  /* 映射连线 */
  --mapping-line-color: var(--primary-300);
  --mapping-line-width: 2px;
  --mapping-line-active: var(--primary-500);
}
```

---

## 十、Agent 开发指南

### 10.1 快速实现提示

使用以下提示词生成代码：

```
创建一个多分支产品线管理页面，使用以下设计令牌：
- 分支策略色：GitFlow #0058C4, Trunk #389E0D, GitHub #08979C
- 环境色：Production #F5222D, Staging #FAAD14, Development #13C2C2, Testing #52C41A
- 步骤指示器：完成 #52C41A, 当前 #0070F3, 待处理 #D9D9D9
- 表格行高：56px（配置密集型）
- 圆角：8px (radius-md)
- 字体：等宽字体显示 Git 仓库路径
```

### 10.2 关键实现检查点

- [ ] Git 仓库集成状态实时显示
- [ ] 分支策略切换时映射关系预览更新
- [ ] 拖拽映射有视觉反馈（连线动画）
- [ ] 向导步骤可回溯（上一步按钮）
- [ ] 删除操作需要输入名称确认
- [ ] WCAG 2.1 AA 对比度合规
- [ ] 键盘导航完整（Tab 顺序、快捷键）
- [ ] 聚焦状态可见（`:focus-visible`）
- [ ] 暗黑模式颜色映射正确
- [ ] 响应式断点测试通过
- [ ] 骨架屏和空状态实现
- [ ] 批量导入支持 CSV/YAML 格式

### 10.3 Git 集成要求

- 支持 GitHub、GitLab、Bitbucket、Gitee
- OAuth 2.0 认证流程
- Webhook 自动配置
- SSH Key 管理
- 仓库权限同步（只读/读写）

### 10.4 分支策略模板

```yaml
# GitFlow
gitflow:
  main: production
  develop: staging
  feature/*: development
  release/*: staging
  hotfix/*: production

# Trunk Based
trunk:
  main: production, staging
  feature/*: development

# GitHub Flow
github:
  main: production
  feature/*: preview
```

---

*文档版本：v1.0*  
*创建日期：2026-04-10*  
*基于 Orion Design Tokens v1.2.0*
