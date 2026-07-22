# Orion 构建环境管理设计文档

> 版本：v1.0  
> 创建日期：2026-04-10  
> 设计师：Orion Design System Team  
> 适用范围：P1 核心功能 - 构建与运行环境模块

---

## 一、页面概述

### 1.1 页面定义

构建环境管理（Build Environment）是 Orion 平台的构建资源配置中心，用户在此管理 Builder 镜像、配置构建缓存、设置弹性 Runner、管理构建资源配额和查看构建历史与性能分析。页面采用运维控制台设计风格，兼顾资源配置和监控能力。

### 1.2 目标用户

| 角色 | 核心任务 | 使用频率 | 权限级别 |
|------|----------|----------|----------|
| 运维工程师 | 管理镜像、配置 Runner | 高频（每日 5-8 次） | 配置/执行 |
| 平台工程师 | 优化构建性能、分析瓶颈 | 中频（每周 5-8 次） | 配置/分析 |
| 开发工程师 | 查看构建历史、选择镜像 | 中频（每日 3-5 次） | 只读/执行 |
| 技术主管 | 查看资源使用、成本分析 | 低频（每周 1-2 次） | 只读/分析 |

### 1.3 设计原则

- **镜像丰富**：多语言/多版本 Builder 镜像可选
- **缓存智能**：自动识别依赖，智能缓存复用
- **弹性伸缩**：基于负载自动扩缩容 Runner
- **性能可视**：构建耗时、资源使用清晰可见

---

## 二、布局结构

### 2.1 页面布局（ASCII）

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Top Navigation Bar                                                     │
├────────┬────────────────────────────────────────────────────────────────┤
│        │                                                                │
│ Side   │  ┌──────────────────────────────────────────────────────────┐ │
│ bar    │  │  Build Environment                      [+ New Builder]  │ │
│        │  └──────────────────────────────────────────────────────────┘ │
│        │                                                                │
│        │  ┌──────────────────────────────────────────────────────────┐ │
│        │  │  [Builders] [Cache] [Runners] [Quota] [History]         │ │
│        │  └──────────────────────────────────────────────────────────┘ │
│        │                                                                │
│        │  ┌──────────────────────────────────────────────────────────┐ │
│        │  │  🔍 Search builders...    [Language ▼] [Status ▼] [+]   │ │
│        │  └──────────────────────────────────────────────────────────┘ │
│        │                                                                │
│        │  ┌──────────────────────────────────────────────────────────┐ │
│        │  │  Builder Images (18)                                    │ │
│        │  │  ──────────────────────────────────────────────────────  │ │
│        │  │  ┌────────────────────────────────────────────────────┐  │ │
│        │  │  │ 🐳 node:18-alpine      Node.js    125MB   🟢Ready │  │ │
│        │  │  │    Last updated: 2d ago    Pulls: 1,245            │  │ │
│        │  │  │    [Use] [Details] [Update]                        │  │ │
│        │  │  └────────────────────────────────────────────────────┘  │ │
│        │  │  ┌────────────────────────────────────────────────────┐  │ │
│        │  │  │ 🐳 python:3.11-slim  Python    280MB   🟢Ready    │  │ │
│        │  │  │    Last updated: 5d ago    Pulls: 892              │  │ │
│        │  │  │    [Use] [Details] [Update]                        │  │ │
│        │  │  └────────────────────────────────────────────────────┘  │ │
│        │  └──────────────────────────────────────────────────────────┘ │
│        │                                                                │
│        │  ┌──────────────────────────────────────────────────────────┐ │
│        │  │  Runner Pool Status                                     │ │
│        │  │  ┌─────────┬─────────┬─────────┬───────────────────────┐ │ │
│        │  │  │ Total   │ Active  │ Idle    │ Avg Wait Time         │ │ │
│        │  │  │ 24      │ 18      │ 6       │ 2.3s                  │ │ │
│        │  │  │ ↑ 4     │ ↓ 2     │ ↑ 6     │ ↓ 0.5s                │ │ │
│        │  │  └─────────┴─────────┴─────────┴───────────────────────┘ │ │
│        │  └──────────────────────────────────────────────────────────┘ │
│        │                                                                │
└────────┴────────────────────────────────────────────────────────────────┘
```

### 2.2 Builder 镜像配置抽屉（ASCII）

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Configure Builder Image - node:18-alpine                 [X] [Save]    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  Basic Information                                                │  │
│  │  ───────────────────────────────────────────────────────────────  │  │
│  │  Image Name: [node                                               ]│  │
│  │  Tag:          [18-alpine                                        ]│  │
│  │  Full Name:    node:18-alpine                                     │  │
│  │  Description:  [Node.js 18 Alpine 轻量级构建环境                 ]│  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  Language & Version                                               │  │
│  │  ───────────────────────────────────────────────────────────────  │  │
│  │  Language: [Node.js ▼]  Version: [18.18.0                       ]│  │
│  │                                                                   │  │
│  │  Pre-installed Tools:                                             │  │
│  │  ☑ npm    ☑ yarn   ☑ pnpm   ☑ npx                               │  │
│  │  ☑ Node-Gyp    ☤ Python 3.11 (for node-gyp)                      │  │
│  │                                                                   │  │
│  │  [+ Add Pre-installed Tool]                                       │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  Resource Configuration                                           │  │
│  │  ───────────────────────────────────────────────────────────────  │  │
│  │  Image Size: [125] MB    Estimated Pull Time: [2.5] s (100Mbps)  │  │
│  │                                                                   │  │
│  │  Default Resources:                                               │  │
│  │  CPU: [2] Cores    Memory: [4] GB    Ephemeral Storage: [10] GB  │  │
│  │                                                                   │  │
│  │  ☑ Enable GPU Support (for ML builds)                             │  │
│  │     GPU Type: [NVIDIA Tesla T4 ▼]    GPU Memory: [16] GB         │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  Cache Configuration                                              │  │
│  │  ───────────────────────────────────────────────────────────────  │  │
│  │  ☑ Enable Layer Caching                                           │  │
│  │  ☑ Enable Dependency Caching                                      │  │
│  │                                                                   │  │
│  │  Cache Paths:                                                     │  │
│  │  ┌────────────────────────────────────────────────────────────┐   │  │
│  │  │ /root/.npm                 [Auto]  [Custom]  [Remove]      │   │  │
│  │  │ /app/node_modules          [Auto]  [Custom]  [Remove]      │   │  │
│  │  │ ────────────────────────────────────────────────────────── │   │  │
│  │  │ [+ Add Cache Path]                                          │   │  │
│  │  └────────────────────────────────────────────────────────────┘   │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  Build Performance                                                │  │
│  │  ───────────────────────────────────────────────────────────────  │  │
│  │  ┌────────────────────────────────────────────────────────────┐   │  │
│  │  │ Metric              │ Current    │ Avg (7d)   │ Trend     │   │  │
│  │  │ ────────────────────────────────────────────────────────── │   │  │
│  │  │ Pull Time           │ 2.5s       │ 2.8s       │ ↓ 10%     │   │  │
│  │  │ Build Time (avg)    │ 3m 12s     │ 3m 45s     │ ↓ 15%     │   │  │
│  │  │ Cache Hit Rate      │ 78%        │ 72%        │ ↑ 6%      │   │  │
│  │  │ Success Rate        │ 98.5%      │ 97.2%      │ ↑ 1.3%    │   │  │
│  │  └────────────────────────────────────────────────────────────┘   │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│  [Cancel]  [Save Configuration]                                         │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.3 弹性 Runner 配置面板（ASCII）

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Elastic Runner Configuration                             [X] [Save]    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  HPA Configuration (Horizontal Pod Autoscaler)                    │  │
│  │  ───────────────────────────────────────────────────────────────  │  │
│  │  ☑ Enable Auto-Scaling                                            │  │
│  │                                                                   │  │
│  │  Min Runners: [4]    Max Runners: [50]    Current: 24            │  │
│  │                                                                   │  │
│  │  Scale Up Rules:                                                  │  │
│  │  ┌────────────────────────────────────────────────────────────┐   │  │
│  │  │ Trigger           │ Threshold    │ Scale     │ Cooldown    │   │  │
│  │  │ ────────────────────────────────────────────────────────── │   │  │
│  │  │ Queue Depth       │ > 10 jobs    │ +4 runners │ 2 min       │   │  │
│  │  │ CPU Usage         │ > 70%        │ +25%       │ 3 min       │   │  │
│  │  │ Memory Usage      │ > 80%        │ +25%       │ 3 min       │   │  │
│  │  │ Wait Time         │ > 30s        │ +8 runners │ 1 min       │   │  │
│  │  └────────────────────────────────────────────────────────────┘   │  │
│  │                                                                   │  │
│  │  Scale Down Rules:                                                │  │
│  │  ┌────────────────────────────────────────────────────────────┐   │  │
│  │  │ Trigger           │ Threshold    │ Scale     │ Cooldown    │   │  │
│  │  │ ────────────────────────────────────────────────────────── │   │  │
│  │  │ Idle Time         │ > 10 min     │ -2 runners │ 5 min       │   │  │
│  │  │ Queue Depth       │ < 3 jobs     │ -25%       │ 5 min       │   │  │
│  │  │ CPU Usage         │ < 30%        │ -25%       │ 5 min       │   │  │
│  │  └────────────────────────────────────────────────────────────┘   │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  Runner Instance Type                                             │  │
│  │  ───────────────────────────────────────────────────────────────  │  │
│  │  Default: [General Purpose ▼]                                     │  │
│  │  ┌────────────────────────────────────────────────────────────┐   │  │
│  │  │ Type              │ CPU    │ Memory │ Price/Hour │ Count   │   │  │
│  │  │ ────────────────────────────────────────────────────────── │   │  │
│  │  │ General Purpose   │ 2 vCPU │ 4 GB   │ $0.05      │ 18      │   │  │
│  │  │ Compute Optimized │ 4 vCPU │ 8 GB   │ $0.10      │ 4       │   │  │
│  │  │ Memory Optimized  │ 2 vCPU │ 16 GB  │ $0.12      │ 2       │   │  │
│  │  │ ────────────────────────────────────────────────────────── │   │  │
│  │  │ [+ Add Instance Type]                                       │   │  │
│  │  └────────────────────────────────────────────────────────────┘   │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│  [Cancel]  [Save Configuration]                                         │
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
| `TabBar` | 标签页导航 | 5 | Builders/Cache/Runners/Quota/History |
| `BuilderCard` | Builder 镜像卡片 | 4 | Ready/Building/Failed/Updating |
| `LanguageIcon` | 编程语言图标 | 8 | Node/Python/Go/Java/Rust/etc. |
| `ResourceBadge` | 资源徽章 | 3 | CPU/Memory/Storage |
| `CacheConfig` | 缓存配置器 | 3 | Auto/Custom/Disabled |
| `RunnerPool` | Runner 池状态 | 4 | Total/Active/Idle/Scaling |
| `HPARule` | HPA 规则配置 | 2 | ScaleUp/ScaleDown |
| `QuotaMeter` | 配额计量表 | 4 | CPU/Memory/Storage/Cost |
| `BuildHistory` | 构建历史列表 | 5 | Success/Failed/Running/Cancelled/Pending |
| `PerformanceChart` | 性能图表 | 4 | Duration/Success Rate/Cache Hit |
| `EmptyState` | 空状态 | 4 | 无镜像/无 Runner/无历史 |
| `Skeleton` | 加载骨架屏 | 3 | 卡片/表格/图表 |

### 3.2 组件颜色映射

```css
/* Builder 状态颜色 - 基于 Orion Design Tokens */
:root {
  --builder-ready-bg: var(--success-50);
  --builder-ready-text: var(--success-600);
  --builder-ready-border: var(--success-200);
  
  --builder-building-bg: var(--info-50);
  --builder-building-text: var(--info-600);
  --builder-building-border: var(--info-200);
  
  --builder-failed-bg: var(--error-50);
  --builder-failed-text: var(--error-600);
  --builder-failed-border: var(--error-200);
  
  --builder-updating-bg: var(--warning-50);
  --builder-updating-text: var(--warning-600);
  --builder-updating-border: var(--warning-200);
}

/* Runner 状态颜色 */
:root {
  --runner-active: var(--primary-500);    /* #0070F3 */
  --runner-idle: var(--success-500);      /* #52C41A */
  --runner-scaling: var(--info-500);      /* #13C2C2 */
  --runner-offline: var(--neutral-400);   /* #8C8C8C */
}
```

---

## 四、颜色与视觉规范

### 4.1 主色调应用

| 元素 | 颜色 Token | HEX | 用途 |
|------|-----------|-----|------|
| 主按钮背景 | `primary-600` | #0058C4 | 新建 Builder |
| 主按钮悬停 | `primary-700` | #0047A0 | 按钮 Hover |
| 激活标签 | `primary-50` | #E6F4FF | 标签页选中 |
| 激活文本 | `primary-600` | #0058C4 | 标签页文字 |
| 链接文本 | `primary-500` | #0070F3 | 可点击文本 |

### 4.2 Builder 状态色完整定义

```css
/* Ready - 就绪 */
.builder-ready {
  background-color: var(--success-50);    /* #F6FFED */
  color: var(--success-600);              /* #389E0D - 对比度 5.2:1 ✅ */
  border-color: var(--success-200);       /* #B7EB8F */
}

/* Building - 构建中 */
.builder-building {
  background-color: var(--info-50);       /* #E6FFFB */
  color: var(--info-600);                 /* #08979C */
  border-color: var(--info-200);          /* #87E8DE */
  animation: pulse-building 1.5s infinite;
}

/* Failed - 失败 */
.builder-failed {
  background-color: var(--error-50);      /* #FFF1F0 */
  color: var(--error-600);                /* #D9363E - 对比度 5.1:1 ✅ */
  border-color: var(--error-200);         /* #FFA39E */
}

/* Updating - 更新中 */
.builder-updating {
  background-color: var(--warning-50);    /* #FFFBE6 */
  color: var(--warning-600);              /* #D48806 - 对比度 4.6:1 ✅ */
  border-color: var(--warning-200);       /* #FFE58F */
}

@keyframes pulse-building {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.8; }
}
```

### 4.3 语言品牌色

```css
/* 编程语言品牌色 */
:root {
  --lang-nodejs: #339933;
  --lang-python: #3776AB;
  --lang-go: #00ADD8;
  --lang-java: #E76F00;
  --lang-rust: #DEA584;
  --lang-ruby: #CC342D;
  --lang-php: #8993BE;
  --lang-dotnet: #512BD4;
}
```

### 4.4 暗黑模式映射

```css
.dark-mode {
  --builder-ready-bg: hsl(145, 25%, 12%);
  --builder-ready-text: var(--success-300);
  
  --builder-building-bg: hsl(200, 30%, 15%);
  --builder-building-text: var(--info-300);
  
  --builder-failed-bg: hsl(359, 25%, 12%);
  --builder-failed-text: var(--error-300);
  
  --lang-nodejs: #5abf5a;
  --lang-python: #5a9bd4;
  --lang-go: #4dd0e1;
  --lang-java: #ff9800;
}
```

---

## 五、字体与排版

### 5.1 字号层级

| 元素 | Token | 字号 | 行高 | 字重 |
|------|-------|------|------|------|
| 页面标题 | `text-2xl` | 24px | 32px | 600 |
| 卡片标题 | `text-md` | 16px | 24px | 600 |
| 镜像名称 | `text-md` | 16px | 24px | 600 |
| 镜像标签 | `text-sm` | 14px | 20px | 400 |
| 指标数值 | `text-lg` | 18px | 28px | 700 |
| 辅助文本 | `text-xs` | 12px | 16px | 400 |

### 5.2 Runner 池状态卡片

| 元素 | 尺寸 | 字体 |
|------|------|------|
| 状态卡片 | 180px x 100px | - |
| 数值显示 | text-2xl, 700 | - |
| 标签文本 | text-sm, 500 | - |
| 趋势指示 | text-xs, 500 | - |

---

## 六、交互说明

### 6.1 核心交互行为

| 交互 | 触发条件 | 反馈 | 持续时间 |
|------|----------|------|----------|
| Builder 卡片悬停 | 鼠标进入 | 显示操作按钮 | 150ms |
| 镜像详情 | 点击详情 | 抽屉滑出 | 300ms |
| 标签切换 | 点击标签 | 内容切换+URL 更新 | 200ms |
| HPA 规则编辑 | 点击编辑 | 内联编辑 | 即时 |
| 构建历史筛选 | 条件变更 | 列表刷新 | 300ms |
| 性能图表缩放 | 滚轮/拖拽 | 平滑缩放 | 即时 |

### 6.2 键盘快捷键

| 快捷键 | 功能 | 适用场景 |
|--------|------|----------|
| `Cmd/Ctrl + K` | 聚焦全局搜索 | 全局 |
| `Cmd/Ctrl + N` | 新建 Builder | 全局 |
| `Cmd/Ctrl + B` | 查看构建历史 | 全局 |
| `Cmd/Ctrl + S` | 保存配置 | 编辑状态 |
| `Escape` | 关闭抽屉/弹窗 | 任意 |
| `↑/↓` | 上下选择 Builder | 列表聚焦 |
| `Enter` | 打开 Builder 详情 | 行聚焦 |
| `E` | 编辑选中 Builder | 有选中项 |

### 6.3 操作确认规则

| 操作 | 是否需要确认 | 确认方式 | 可撤销 |
|------|--------------|----------|--------|
| 新建 Builder | 否 | 验证后生效 | ✅ 可删除 |
| 删除 Builder | 是 | 模态框 + 名称确认 | ❌ 不可撤销 |
| 更新镜像 | 是 | 影响提示 | ✅ 可回滚 |
| 修改 HPA 规则 | 否 | 保存即生效 | ✅ 可恢复 |
| 调整配额 | 是 | 资源影响提示 | ✅ 可调整 |

---

## 七、状态定义

### 7.1 空状态（Empty State）

```
┌─────────────────────────────────────────────────────────────────┐
│                        ┌─────────────┐                         │
│                        │             │                         │
│                        │    🐳       │                         │
│                        │  (64x64px)  │                         │
│                        │             │                         │
│                        └─────────────┘                         │
│                                                                 │
│                  暂无 Builder 镜像                               │
│              text-2xl, font-weight-semibold, neutral-800        │
│                                                                 │
│          添加第一个 Builder 镜像，开始定制化构建环境              │
│              text-md, neutral-500, margin-top: 8px             │
│                                                                 │
│              ┌──────────────┐  ┌──────────────┐                │
│              │ + 添加镜像   │  │ 📖 配置指南  │                │
│              │ primary-600  │  │ neutral-600  │                │
│              └──────────────┘  └──────────────┘                │
│                                                                 │
│          ───────────  预置镜像  ───────────                    │
│                                                                 │
│     🟢 Node.js  •  🐍 Python  •  🦀 Rust  •  ☕ Java  •  🐹 Go   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 7.2 加载状态（Loading State）

**骨架屏规格**：
```css
.builder-card-skeleton {
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

/* 性能图表骨架 */
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
| 镜像拉取失败 | 卡片错误状态 | [重试拉取] [检查配置] | 3 次 |
| Runner 离线 | 状态显示离线 | [重启 Runner] [排查] | 可选 |
| 构建失败 | 历史列表标记 | [查看日志] [重新构建] | 可选 |
| 配额超限 | 配额卡片告警 | [申请扩容] [优化使用] | 否 |

### 7.4 构建状态定义

| 状态 | 图标 | 颜色 | 说明 |
|------|------|------|------|
| Success | ✅ | success-600 | 构建成功 |
| Failed | ❌ | error-600 | 构建失败 |
| Running | 🔄 | info-600 | 构建进行中 |
| Cancelled | ⏹️ | neutral-500 | 已取消 |
| Pending | ⏳ | warning-600 | 等待中 |

---

## 八、响应式设计

### 8.1 移动端适配策略

**XS (< 576px) - 卡片模式**：
```
┌─────────────────────────────────┐
│  Build Env     [+ New Builder]  │
├─────────────────────────────────┤
│ [Builders ▼] [Cache] [Runners]  │
├─────────────────────────────────┤
│ ┌─────────────────────────────┐ │
│ │ 🐳 node:18-alpine  🟢Ready  │ │
│ │ Node.js • 125MB • 1,245 pulls│ │
│ │ [Use] [Details]              │ │
│ └─────────────────────────────┘ │
│ ┌─────────────────────────────┐ │
│ │ 🐳 python:3.11     🟢Ready  │ │
│ │ Python • 280MB • 892 pulls  │ │
│ │ [Use] [Details]              │ │
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```

**SM (576-768px) - 双列卡片**：
- Builder 卡片 2 列
- Runner 状态简化
- 操作按钮图标化

**MD (768-992px) - 完整功能**：
- Builder 卡片单列
- Runner 状态完整
- 性能图表可见

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
  --builder-card-gap: var(--spacing-md);
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

### 9.4 Runner 池状态样式

```css
:root {
  --runner-card-width: 180px;
  --runner-card-height: 100px;
  --runner-card-gap: 16px;
  
  --runner-active: #0070F3;
  --runner-idle: #52C41A;
  --runner-scaling: #13C2C2;
  --runner-offline: #8C8C8C;
  
  --runner-value-size: var(--text-2xl);
  --runner-value-weight: var(--font-weight-bold);
  --runner-label-size: var(--text-sm);
  --runner-label-weight: var(--font-weight-medium);
}
```

### 9.5 动画系统

```css
:root {
  --transition-fast: 150ms ease;
  --transition-normal: 200ms ease;
  --transition-slow: 300ms ease;
  
  --animation-skeleton: skeleton-loading 1.5s infinite;
  --animation-pulse-building: pulse-building 1.5s infinite;
}

@keyframes skeleton-loading {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

@keyframes pulse-building {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.8; }
}
```

---

## 十、Agent 开发指南

### 10.1 快速实现提示

使用以下提示词生成代码：

```
创建一个构建环境管理页面，使用以下设计令牌：
- Builder 状态：Ready #389E0D, Building #08979C, Failed #D9363E, Updating #D48806
- Runner 状态：Active #0070F3, Idle #52C41A, Scaling #13C2C2, Offline #8C8C8C
- 语言品牌色：Node.js #339933, Python #3776AB, Go #00ADD8, Java #E76F00
- 资源卡片：180x100px, 数值 24px 粗体，标签 14px 中字重
- Builder 卡片：圆角 8px, 悬停阴影 shadow-md
- 标签页：选中背景 #E6F4FF, 文本 #0058C4
```

### 10.2 关键实现检查点

- [ ] Builder 镜像状态实时同步
- [ ] Runner 池自动扩缩容可视化
- [ ] HPA 规则配置直观
- [ ] 构建性能图表清晰
- [ ] WCAG 2.1 AA 对比度合规
- [ ] 键盘导航完整（Tab 顺序、快捷键）
- [ ] 聚焦状态可见（`:focus-visible`）
- [ ] 暗黑模式颜色映射正确
- [ ] 响应式断点测试通过
- [ ] 骨架屏和空状态实现
- [ ] 构建历史筛选和导出
- [ ] 配额使用告警

### 10.3 构建环境 API 要求

- Builder 镜像 CRUD API
- 镜像更新 API
- Runner 池状态 API
- HPA 配置 API
- 构建配额 API
- 构建历史 API
- 性能指标 API
- 缓存配置 API
- 构建日志 API

### 10.4 构建配置示例

```graphql
# Query builder images
query GetBuilderImages {
  builders {
    id
    name
    tag
    language
    version
    size
    status
    pulls
    lastUpdated
    cacheConfig {
      enabled
      paths
    }
  }
}

# Query runner pool
query GetRunnerPool {
  runnerPool {
    total
    active
    idle
    scaling
    avgWaitTime
    hpa {
      enabled
      minRunners
      maxRunners
      scaleUpRules { trigger threshold scale cooldown }
      scaleDownRules { trigger threshold scale cooldown }
    }
  }
}

# Query build history
query GetBuildHistory($repoId: ID!, $limit: Int!) {
  buildHistory(repoId: $repoId, limit: $limit) {
    id
    repo
    branch
    commit
    status
    duration
    startTime
    endTime
    builder
  }
}

# Update HPA configuration
mutation UpdateHPAConfig {
  updateHPAConfig(
    input: {
      minRunners: 4
      maxRunners: 50
      scaleUpRules: [
        { trigger: QUEUE_DEPTH, threshold: ">10", scale: "+4", cooldown: "2m" }
      ]
    }
  ) {
    success
    hpa {
      minRunners
      maxRunners
    }
  }
}
```

---

*文档版本：v1.0*  
*创建日期：2026-04-10*  
*基于 Orion Design Tokens v1.2.0*
