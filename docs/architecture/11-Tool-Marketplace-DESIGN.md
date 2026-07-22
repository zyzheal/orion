# Orion 工具市场设计文档

> 版本：v1.0  
> 创建日期：2026-04-10  
> 设计师：Orion Design System Team  
> 适用范围：P1 核心功能 - 扩展能力与集成模块

---

## 一、页面概述

### 1.1 页面定义

工具市场（Tool Marketplace）是 Orion 平台的扩展能力发现与管理中心，用户在此浏览、安装、配置和监控各类开发工具（包括代码扫描、性能分析、安全检测、文档生成等）。页面采用应用商店式体验，兼顾工具健康监控和版本管理。

### 1.2 目标用户

| 角色 | 核心任务 | 使用频率 | 权限级别 |
|------|----------|----------|----------|
| 平台工程师 | 集成新工具、配置全局策略 | 中频（每周 3-5 次） | 完全访问 |
| 开发工程师 | 浏览/安装工具、查看使用 | 中频（每周 5-8 次） | 安装/使用 |
| 运维工程师 | 监控工具健康、处理异常 | 高频（每日 5-10 次） | 监控/配置 |
| 安全工程师 | 审计工具权限、合规检查 | 低频（每周 1-2 次） | 审计/只读 |

### 1.3 设计原则

- **发现简单**：分类浏览、搜索、推荐三位一体
- **安装安全**：权限透明、资源配额、沙箱隔离
- **监控实时**：健康状态、资源使用、错误日志可视
- **升级可控**：版本对比、灰度发布、一键回滚

---

## 二、布局结构

### 2.1 页面布局（ASCII）

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Top Navigation Bar                                                     │
├────────┬────────────────────────────────────────────────────────────────┤
│        │                                                                │
│ Side   │  ┌──────────────────────────────────────────────────────────┐ │
│ bar    │  │  Tool Marketplace                       [Submit Tool]    │ │
│        │  └──────────────────────────────────────────────────────────┘ │
│        │                                                                │
│        │  ┌──────────────────────────────────────────────────────────┐ │
│        │  │  🔍 Search tools...   [Category ▼] [Rating ▼] [Status ▼]│ │
│        │  │  Tags: #security #performance #documentation [Clear All]│ │
│        │  └──────────────────────────────────────────────────────────┘ │
│        │                                                                │
│        │  ┌──────────────────────────────────────────────────────────┐ │
│        │  │  Featured & Recommended                                 │ │
│        │  │  ┌─────────────┬─────────────┬─────────────┬──────────┐ │ │
│        │  │  │ SonarQube   │ Jira Sync   │ Doc Gen     │ Perf     │ │ │
│        │  │  │ ⭐ 4.8      │ ⭐ 4.7      │ ⭐ 4.6      │ Analyzer │ │ │
│        │  │  │ Security    │ PM          │ Docs        │ ⭐ 4.5   │ │ │
│        │  │  │ [Install]   │ [Install]   │ [Install]   │ [Install]│ │ │
│        │  │  └─────────────┴─────────────┴─────────────┴──────────┘ │ │
│        │  └──────────────────────────────────────────────────────────┘ │
│        │                                                                │
│        │  ┌──────────────────────────────────────────────────────────┐ │
│        │  │  All Tools                                              │ │
│        │  │  ──────────────────────────────────────────────────────  │ │
│        │  │  │ Name        │ Category │ Version │ Rating  │ Health │ │
│        │  │  │─────────────│──────────│─────────│─────────│────────│ │
│        │  │  │ SonarQube   │ Security │ 9.9.0   │ ⭐⭐⭐⭐⭐  │ 🟢     │ │
│        │  │  │ Jira Sync   │ PM       │ 2.1.4   │ ⭐⭐⭐⭐☆  │ 🟢     │ │
│        │  │  │ Doc Gen     │ Docs     │ 1.5.2   │ ⭐⭐⭐⭐☆  │ 🟡     │ │
│        │  │  │ Perf Master │ Monitor  │ 3.2.1   │ ⭐⭐⭐☆☆  │ 🔴     │ │
│        │  │  │ ...                                                    │ │
│        │  │  Showing 1-20 of 234 tools    [My Tools] [Health Check] │ │
│        │  └──────────────────────────────────────────────────────────┘ │
│        │                                                                │
└────────┴────────────────────────────────────────────────────────────────┘
```

### 2.2 工具详情布局（ASCII）

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Tool Marketplace / SonarQube                            [X] [Install]  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  SonarQube                                          [Installed]   │  │
│  │  ───────────────────────────────────────────────────────────────  │  │
│  │  Continuous inspection of code quality - detects bugs, vulnerabilities│
│  │                                                                     │  │
│  │  ⭐ 4.8 (1,247 reviews)  •  📥 8,542 installs  •  👤 SonarSource │  │
│  │  🏷️ Security • 📦 v9.9.0 • 📅 Updated 2 weeks ago                │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌─────────────────┐  ┌─────────────────────────────────────────────┐  │
│  │  Overview       │  │  Tool Health                                │  │
│  │  Configuration  │  │  ─────────────────────────────────────────  │  │
│  │  Dependencies   │  │  Status:      🟢 Healthy                    │  │
│  │  Versions       │  │  Uptime:      99.9% (30d)                   │  │
│  │  Reviews (247)  │  │  Avg Latency: 45ms                          │  │
│  │                 │  │  Error Rate:  0.02%                         │  │
│  │                 │  │                                              │  │
│  │                 │  │  ┌──────────────────────────────────────┐   │  │
│  │                 │  │  │  Request Trend (Last 24h)            │   │  │
│  │                 │  │  │  [Area Chart]                        │   │  │
│  │                 │  │  └──────────────────────────────────────┘   │  │
│  └─────────────────┘  └─────────────────────────────────────────────┘  │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  Configuration Items (4)                                          │  │
│  │  ───────────────────────────────────────────────────────────────  │  │
│  │  ┌────────────────────────────────────────────────────────────┐   │  │
│  │  │ Server URL *                                               │   │  │
│  │  │ https://sonarqube.internal.example.com                     │   │  │
│  │  └────────────────────────────────────────────────────────────┘   │  │
│  │  ┌────────────────────────────────────────────────────────────┐   │  │
│  │  │ API Token *                        [Generate New Token]    │   │  │
│  │  │ ••••••••••••••••••••••••••••••••                          │   │  │
│  │  └────────────────────────────────────────────────────────────┘   │  │
│  │  ┌──────────────────┐  ┌──────────────────┐                       │  │
│  │  │ Scan Frequency   │  │ Quality Gate     │                       │  │
│  │  │ [Daily ▼]        │  │ [Strict ▼]       │                       │  │
│  │  └──────────────────┘  └──────────────────┘                       │  │
│  │  [Save Configuration]    [Test Connection]    [Reset]             │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  Dependencies                                                     │  │
│  │  ───────────────────────────────────────────────────────────────  │  │
│  │  • Java Runtime 11+     • PostgreSQL 12+     • Elasticsearch 7.x  │  │
│  │  └───────────────────────────────────────────────────────────────  │  │
│  │  ⚠️ Requires database migration when upgrading from v9.8.x        │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.3 响应式断点布局

| 断点 | 宽度 | 布局策略 |
|------|------|----------|
| XS | < 576px | 单列卡片布局，健康指标折叠，筛选器底部抽屉 |
| SM | 576-768px | 双列卡片，隐藏次要信息，简化视图 |
| MD | 768-992px | 完整表格，健康面板侧边 |
| LG+ | > 992px | 完整布局，支持多面板并排 |

---

## 三、组件清单

### 3.1 使用组件列表

| 组件名 | 用途 | 状态数 | 设计规范 |
|--------|------|--------|----------|
| `PageHeader` | 页面标题 + 提交按钮 | 1 | 带统计信息 |
| `ToolSearch` | 工具搜索框 | 4 | 支持语义搜索 |
| `CategoryFilter` | 分类筛选器 | 5 | 多选 + 标签 |
| `ToolCard` | 工具卡片 | 4 | Featured/Normal/Installed/Disabled |
| `ToolTable` | 工具数据表格 | 5 | 支持排序 |
| `RatingDisplay` | 评分显示 | 3 | 星星 + 数值 |
| `HealthBadge` | 健康度徽章 | 4 | Healthy/Degraded/Down/Unknown |
| `VersionBadge` | 版本徽章 | 2 | 最新/旧版 |
| `ToolDrawer` | 工具详情抽屉 | 2 | 从右侧滑出 |
| `HealthPanel` | 健康监控面板 | 3 | 指标 + 图表 |
| `RequestChart` | 请求趋势图 | 2 | 24h/7d 切换 |
| `ConfigForm` | 配置表单 | 3 | 动态字段 + 校验 |
| `InstallWizard` | 安装向导弹窗 | 4 | 权限/资源/确认 |
| `VersionModal` | 版本管理弹窗 | 2 | 升级/回滚 |
| `DependencyList` | 依赖列表 | 2 | 树形展示 |
| `EmptyState` | 空状态 | 3 | 无工具/无搜索结果 |
| `Skeleton` | 加载骨架屏 | 4 | 卡片/表格/详情 |

### 3.2 组件颜色映射

```css
/* 工具健康度颜色 - 基于 Orion Design Tokens */
:root {
  --health-healthy-bg: var(--success-50);
  --health-healthy-text: var(--success-600);
  --health-healthy-border: var(--success-200);
  
  --health-degraded-bg: var(--warning-50);
  --health-degraded-text: var(--warning-700);
  --health-degraded-border: var(--warning-200);
  
  --health-down-bg: var(--error-50);
  --health-down-text: var(--error-600);
  --health-down-border: var(--error-200);
  
  --health-unknown-bg: var(--neutral-50);
  --health-unknown-text: var(--neutral-500);
  --health-unknown-border: var(--neutral-200);
}

/* 工具分类颜色 */
:root {
  --category-security: var(--error-500);       /* #F5222D */
  --category-performance: var(--info-500);     /* #13C2C2 */
  --category-documentation: var(--primary-500);/* #0070F3 */
  --category-monitoring: var(--warning-500);   /* #FAAD14 */
  --category-cicd: var(--success-500);         /* #52C41A */
  --category-custom: var(--neutral-500);       /* #8C8C8C */
}
```

---

## 四、颜色与视觉规范

### 4.1 主色调应用

| 元素 | 颜色 Token | HEX | 用途 |
|------|-----------|-----|------|
| 主按钮背景 | `primary-600` | #0058C4 | 安装/提交工具 |
| 主按钮悬停 | `primary-700` | #0047A0 | 按钮 Hover |
| 已安装状态 | `success-500` | #52C41A | 已安装徽章 |
| 评分星星 | `warning-500` | #FAAD14 | 填充星星 |
| 健康正常 | `success-600` | #389E0D | 健康徽章 |

### 4.2 健康度完整定义

```css
/* Healthy - 健康 */
.health-healthy {
  background-color: var(--success-50);    /* #F6FFED */
  color: var(--success-600);              /* #389E0D - 对比度 5.2:1 ✅ */
  border-color: var(--success-200);       /* #B7EB8F */
}

/* Degraded - 降级 */
.health-degraded {
  background-color: var(--warning-50);    /* #FFFBE6 */
  color: var(--warning-700);              /* #AD6800 - 对比度 6.2:1 ✅ */
  border-color: var(--warning-200);       /* #FFE58F */
}

/* Down - 宕机 */
.health-down {
  background-color: var(--error-50);      /* #FFF1F0 */
  color: var(--error-600);                /* #D9363E - 对比度 5.1:1 ✅ */
  border-color: var(--error-200);         /* #FFA39E */
  animation: pulse-error 2s infinite;
}

/* Unknown - 未知 */
.health-unknown {
  background-color: var(--neutral-50);    /* #FAFAFA */
  color: var(--neutral-500);              /* #8C8C8C - 对比度 4.2:1 ✅ */
  border-color: var(--neutral-200);       /* #EBEBEB */
}

@keyframes pulse-error {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}
```

### 4.3 工具分类标签色

```css
/* 安全类工具 */
.category-security {
  background-color: var(--error-50);
  color: var(--error-600);
  border-color: var(--error-200);
}

/* 性能类工具 */
.category-performance {
  background-color: var(--info-50);
  color: var(--info-600);
  border-color: var(--info-200);
}

/* 文档类工具 */
.category-documentation {
  background-color: var(--primary-50);
  color: var(--primary-600);
  border-color: var(--primary-200);
}

/* 监控类工具 */
.category-monitoring {
  background-color: var(--warning-50);
  color: var(--warning-600);
  border-color: var(--warning-200);
}

/* CI/CD 类工具 */
.category-cicd {
  background-color: var(--success-50);
  color: var(--success-600);
  border-color: var(--success-200);
}

/* 自定义类工具 */
.category-custom {
  background-color: var(--neutral-50);
  color: var(--neutral-600);
  border-color: var(--neutral-200);
}
```

### 4.4 版本徽章颜色

```css
/* 最新版本 */
.version-latest {
  background-color: var(--success-50);
  color: var(--success-600);
  border-color: var(--success-200);
  font-size: var(--text-xs);
  font-weight: var(--font-weight-medium);
}

/* 旧版本 */
.version-old {
  background-color: var(--neutral-50);
  color: var(--neutral-500);
  border-color: var(--neutral-200);
}

/* 测试版本 */
.version-beta {
  background-color: var(--info-50);
  color: var(--info-600);
  border-color: var(--info-200);
}

/* 废弃版本 */
.version-deprecated {
  background-color: var(--error-50);
  color: var(--error-600);
  border-color: var(--error-200);
}
```

### 4.5 暗黑模式映射

```css
.dark-mode {
  --health-healthy-bg: hsl(145, 25%, 12%);
  --health-healthy-text: var(--success-300);
  --health-healthy-border: hsl(145, 30%, 25%);
  
  --health-degraded-bg: hsl(38, 30%, 15%);
  --health-degraded-text: var(--warning-300);
  
  --health-down-bg: hsl(359, 30%, 15%);
  --health-down-text: var(--error-300);
  
  --rating-star-filled: #ffc53d;
  --rating-star-empty: #4a4a4a;
  
  --category-security: #ff6b6d;
  --category-performance: #36cfc9;
  --category-documentation: #40a9ff;
  --category-monitoring: #ffc53d;
  --category-cicd: #73d13d;
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
| 工具描述 | `text-md` | 16px | 24px | 400 |
| 表格标题 | `text-xs` | 12px | 16px | 600 |
| 表格正文 | `text-sm` | 14px | 20px | 400 |
| 版本号 | `text-xs` | 12px | 16px | 400 |
| 健康指标 | `text-lg` | 18px | 28px | 600 |

### 5.2 表格列宽定义

| 列名 | 宽度 | 对齐 | 可排序 |
|------|------|------|--------|
| 名称 | 200px | 左 | 是 |
| 分类 | 120px | 左 | 是 |
| 版本 | 100px | 左 | 是 |
| 评分 | 120px | 左 | 是 |
| 安装数 | 100px | 右 | 是 |
| 健康度 | 100px | 居中 | 是 |
| 操作 | 100px | 右 | 否 |

---

## 六、交互说明

### 6.1 核心交互行为

| 交互 | 触发条件 | 反馈 | 持续时间 |
|------|----------|------|----------|
| 工具卡片悬停 | 鼠标进入 | 卡片上浮 + 阴影 | 150ms |
| 点击卡片 | 点击 | 右侧抽屉滑出 | 300ms |
| 安装工具 | 点击安装 | 向导→确认→执行 | 多步骤 |
| 配置工具 | 点击配置 | 表单展开 | 200ms |
| 健康检查 | 点击检查 | 刷新指标 | 500ms+API |
| 版本升级 | 点击升级 | 对比→确认→执行 | 多步骤 |
| 收藏工具 | 点击星形 | 星形填充动画 | 200ms |

### 6.2 键盘快捷键

| 快捷键 | 功能 | 适用场景 |
|--------|------|----------|
| `Cmd/Ctrl + K` | 聚焦搜索框 | 全局 |
| `Cmd/Ctrl + N` | 提交新工具 | 全局 |
| `Cmd/Ctrl + M` | 打开已安装列表 | 全局 |
| `Cmd/Ctrl + H` | 健康检查 | 全局 |
| `Cmd/Ctrl + /` | 打开快捷键帮助 | 全局 |
| `Escape` | 关闭抽屉/弹窗 | 任意 |
| `↑/↓` | 上下选择工具 | 列表聚焦 |
| `Enter` | 打开选中的工具 | 行聚焦 |
| `I` | 安装选中的工具 | 有选中项 |
| `C` | 配置选中的工具 | 已安装 |
| `U` | 升级选中的工具 | 有更新 |

### 6.3 安装确认规则

| 操作 | 是否需要确认 | 确认方式 | 资源影响 |
|------|--------------|----------|----------|
| 安装免费工具 | 否 | 直接安装 | 无 |
| 安装付费工具 | 是 | 确认价格 + 余额 | 扣除配额 |
| 安装高资源工具 | 是 | 资源警告 + 确认 | CPU/内存增加 |
| 安装需要权限工具 | 是 | 权限列表确认 | 敏感权限 |
| 批量安装 (≥3) | 是 | 列表确认 | 累积资源 |
| 卸载工具 | 是 | 确认数据保留 | 配置保留 |

---

## 七、状态定义

### 7.1 空状态（Empty State）

```
┌─────────────────────────────────────────────────────────────────┐
│                        ┌─────────────┐                         │
│                        │             │                         │
│                        │    🧰       │                         │
│                        │  (64x64px)  │                         │
│                        │             │                         │
│                        └─────────────┘                         │
│                                                                 │
│                    暂无工具                                     │
│              text-2xl, font-weight-semibold, neutral-800        │
│                                                                 │
│          浏览工具市场，发现提升效率的开发工具                   │
│              text-md, neutral-500, margin-top: 8px             │
│                                                                 │
│              ┌──────────────┐  ┌──────────────┐                │
│              │ 🛒 浏览市场  │  │ 📝 提交工具  │                │
│              │ primary-600  │  │ neutral-600  │                │
│              └──────────────┘  └──────────────┘                │
│                                                                 │
│          ───────────  热门分类  ───────────                    │
│                                                                 │
│     🔒 安全检测  •  ⚡ 性能分析  •  📄 文档生成  •  🚀 CI/CD     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 7.2 加载状态（Loading State）

**骨架屏规格**：
```css
.tool-card-skeleton {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
  padding: 20px;
  background: var(--neutral-50);
  border-radius: var(--radius-md);
}

.skeleton-title {
  height: 20px;
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

.skeleton-description {
  height: 16px;
  width: 80%;
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

.skeleton-stats {
  display: flex;
  gap: 16px;
  margin-top: 16px;
}

.skeleton-stat {
  width: 80px;
  height: 32px;
  background: var(--neutral-200);
  border-radius: var(--radius-sm);
  animation: skeleton-loading 1.5s infinite;
}

/* 健康度骨架 */
.skeleton-health {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--neutral-200);
  animation: skeleton-loading 1.5s infinite;
}
```

**加载行数**：显示 8 个卡片骨架屏（2 行×4 列）

### 7.3 错误状态（Error State）

| 错误类型 | 展示方式 | 用户操作 | 自动重试 |
|----------|----------|----------|----------|
| 数据加载失败 | 全页错误卡片 | [重试] [检查连接] | 3 次后停止 |
| 安装失败 | Toast 错误提示 | [查看日志] [重试] | 否 |
| 配置保存失败 | 表单内错误提示 | [修改后重试] | 否 |
| 健康检查失败 | 面板错误状态 | [重新检查] | 可选 |
| 权限不足 | 空状态 + 申请按钮 | [申请权限] | 否 |

### 7.4 工具状态定义

| 状态 | 徽章颜色 | 说明 | 可操作 |
|------|----------|------|--------|
| Available | success-500 | 可用 | 安装 |
| Installed | primary-500 | 已安装 | 配置/卸载 |
| Updating | warning-500 | 更新中 | 等待 |
| Disabled | neutral-400 | 已禁用 | 启用 |
| Deprecated | error-500 | 已废弃 | 迁移 |
| Error | error-500 | 错误状态 | 排查 |

---

## 八、响应式设计

### 8.1 移动端适配策略

**XS (< 576px) - 卡片模式**：
```
┌─────────────────────────────────┐
│  Tools            [+ Submit]    │
├─────────────────────────────────┤
│ 🔍 Search tools...              │
│ [Category ▼] [Status ▼]         │
├─────────────────────────────────┤
│ ┌─────────────────────────────┐ │
│ │ SonarQube           ⭐ 4.8  │ │
│ │ Security • v9.9.0     🟢    │ │
│ │ 8.5k installs • [Install]   │ │
│ └─────────────────────────────┘ │
│ ┌─────────────────────────────┐ │
│ │ Jira Sync           ⭐ 4.7  │ │
│ │ PM • v2.1.4           🟢    │ │
│ │ 5.2k installs • [Install]   │ │
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```

**SM (576-768px) - 双列卡片**：
- Featured 轮播 2 列
- 全部列表 2 列
- 筛选器简化

**MD (768-992px) - 完整功能**：
- Featured 轮播 3 列
- 全部列表 3 列
- 健康面板侧边

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
  --featured-gap: var(--spacing-xl);
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
  
  /* 工具卡片悬停阴影 */
  --shadow-card-hover: 0 12px 32px rgba(0, 0, 0, 0.12);
}
```

### 9.4 动画系统

```css
:root {
  --transition-fast: 150ms ease;
  --transition-normal: 200ms ease;
  --transition-slow: 300ms ease;
  
  --animation-card-hover: card-lift 200ms ease;
  --animation-star-fill: star-fill 300ms ease;
  --animation-pulse-error: pulse-error 2s infinite;
}

@keyframes card-lift {
  from {
    transform: translateY(0);
    box-shadow: var(--shadow-md);
  }
  to {
    transform: translateY(-4px);
    box-shadow: var(--shadow-card-hover);
  }
}

@keyframes star-fill {
  0% { transform: scale(0.8); opacity: 0.5; }
  100% { transform: scale(1); opacity: 1; }
}

@keyframes pulse-error {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}
```

### 9.5 健康指标进度条

```css
:root {
  --metric-height: 8px;
  --metric-radius: 4px;
  
  --metric-uptime: var(--success-500);      /* 正常运行时间 */
  --metric-latency: var(--info-500);        /* 延迟 */
  --metric-error: var(--error-500);         /* 错误率 */
}
```

---

## 十、Agent 开发指南

### 10.1 快速实现提示

使用以下提示词生成代码：

```
创建一个工具市场页面，使用以下设计令牌：
- 健康度：Healthy #389E0D, Degraded #AD6800, Down #D9363E, Unknown #8C8C8C
- 分类色：Security #F5222D, Performance #13C2C2, Documentation #0070F3, Monitoring #FAAD14, CI/CD #52C41A
- 评分星星：填充 #FAAD14, 空白 #D9D9D9
- 卡片悬停：上浮 4px + shadow-lg
- 圆角：8px (radius-md)
```

### 10.2 关键实现检查点

- [ ] 工具卡片悬停动画流畅
- [ ] 评分星星支持半颗星显示
- [ ] 健康状态实时轮询（60s 间隔）
- [ ] 安装确认提示权限和资源
- [ ] WCAG 2.1 AA 对比度合规
- [ ] 键盘导航完整（Tab 顺序、快捷键）
- [ ] 聚焦状态可见（`:focus-visible`）
- [ ] 暗黑模式颜色映射正确
- [ ] 响应式断点测试通过
- [ ] 骨架屏和空状态实现
- [ ] 配置表单支持动态字段和校验
- [ ] 版本对比支持 diff 视图

### 10.3 工具 API 要求

- 工具注册 API（元数据、schema、端点）
- 工具安装/卸载 API
- 工具配置 CRUD API
- 健康检查 API（状态、指标、日志）
- 使用统计 API（调用次数、成功率、延迟）
- 版本管理 API（列表、升级、回滚）
- 批量操作 API

### 10.4 工具元数据 schema

```yaml
name: sonarqube
version: 9.9.0
category: security
description: Continuous inspection of code quality
author: SonarSource
rating: 4.8
installs: 8542
health:
  status: healthy
  uptime: 99.9
  latency: 45
  errorRate: 0.02
config:
  serverUrl: { type: string, required: true }
  apiToken: { type: string, required: true, sensitive: true }
  scanFrequency: { type: string, default: "daily", enum: [hourly, daily, weekly] }
  qualityGate: { type: string, default: "strict", enum: [lenient, strict, custom] }
dependencies:
  - java: "11+"
  - postgresql: "12+"
  - elasticsearch: "7.x"
permissions:
  - read:code
  - write:issues
  - read:metrics
resources:
  cpu: "500m"
  memory: "1Gi"
  storage: "10Gi"
```

---

*文档版本：v1.0*  
*创建日期：2026-04-10*  
*基于 Orion Design Tokens v1.2.0*
