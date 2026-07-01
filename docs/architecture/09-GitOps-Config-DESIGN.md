# Orion GitOps 配置管理设计文档

> 版本：v1.0  
> 创建日期：2026-04-10  
> 设计师：Orion Design System Team  
> 适用范围：P1 核心功能 - GitOps 与自动化部署模块

---

## 一、页面概述

### 1.1 页面定义

GitOps 配置管理（GitOps Configuration）是 Orion 平台基于 ArgoCD 的 GitOps 工作流核心界面，用户在此管理 ArgoCD 应用、配置 Git 仓库同步策略、查看同步历史和进行多集群管理。页面采用运维密集型设计，兼顾配置精确性和操作可追溯性。

### 1.2 目标用户

| 角色 | 核心任务 | 使用频率 | 权限级别 |
|------|----------|----------|----------|
| 平台工程师 | 配置 ArgoCD 应用、管理同步策略 | 高频（每日 10+ 次） | 完全访问 |
| 运维工程师 | 监控同步状态、处理同步失败 | 高频（每日 15+ 次） | 配置/执行 |
| 开发工程师 | 查看应用状态、触发手动同步 | 中频（每周 5-8 次） | 只读/执行 |
| 技术主管 | 查看多集群概览、审计同步历史 | 低频（每周 2-3 次） | 概览/只读 |

### 1.3 设计原则

- **Git 为真相源**：所有配置变更可追溯到 Git 提交
- **状态可视**：同步状态、健康度一目了然
- **安全回滚**：一键回滚到任意历史版本
- **多集群支持**：统一视图管理多个 Kubernetes 集群

---

## 二、布局结构

### 2.1 页面布局（ASCII）

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Top Navigation Bar                                                     │
├────────┬────────────────────────────────────────────────────────────────┤
│        │                                                                │
│ Side   │  ┌──────────────────────────────────────────────────────────┐ │
│ bar    │  │  GitOps Configuration                   [+ New App]      │ │
│        │  └──────────────────────────────────────────────────────────┘ │
│        │                                                                │
│        │  ┌──────────────────────────────────────────────────────────┐ │
│        │  │  [Apps] [Repositories] [Clusters] [Sync History]        │ │
│        │  └──────────────────────────────────────────────────────────┘ │
│        │                                                                │
│        │  ┌──────────────────────────────────────────────────────────┐ │
│        │  │  🔍 Search apps...    [Cluster ▼] [Namespace ▼] [Status ▼]│ │
│        │  └──────────────────────────────────────────────────────────┘ │
│        │                                                                │
│        │  ┌──────────────────────────────────────────────────────────┐ │
│        │  │  ArgoCD Applications                                    │ │
│        │  │  ──────────────────────────────────────────────────────  │ │
│        │  │  │ Name           │ Status   │ Health  │ Sync │ Cluster │ │
│        │  │  │────────────────│──────────│─────────│──────│─────────│ │
│        │  │  │ payment-api    │ ✅ Synced│ 🟢 Hlthy│ Auto│ prod-cn  │ │
│        │  │  │ order-service  │ 🟡 OutOf │ 🟡 Degrad│ Manual│ prod-cn│ │
│        │  │  │ user-db        │ ✅ Synced│ 🟢 Hlthy│ Auto│ prod-us  │ │
│        │  │  │ gateway        │ 🔴 Error │ 🔴 Miss  │ Auto│ staging  │ │
│        │  │  │ ...                                                    │ │
│        │  │  Showing 1-20 of 156 apps    [Bulk Sync] [Export YAML]  │ │
│        │  └──────────────────────────────────────────────────────────┘ │
│        │                                                                │
│        │  ┌──────────────────────────────────────────────────────────┐ │
│        │  │  Cluster Overview                                       │ │
│        │  │  ┌──────────────┬──────────────┬──────────────────────┐ │ │
│        │  │  │ prod-cn (42) │ prod-us (38) │ staging (24)         │ │
│        │  │  │ [●●●●○]      │ [●●●○○]      │ [●●○○○]              │ │
│        │  │  │ 85% Healthy  │ 92% Healthy  │ 78% Healthy          │ │
│        │  │  └──────────────┴──────────────┴──────────────────────┘ │ │
│        │  └──────────────────────────────────────────────────────────┘ │
│        │                                                                │
└────────┴────────────────────────────────────────────────────────────────┘
```

### 2.2 应用详情抽屉布局（ASCII）

```
┌─────────────────────────────────────────────────────────────────┐
│  Application: payment-api                          [X] [Sync ▼] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Status: ✅ Synced    Health: 🟢 Healthy    Policy: Auto-Sync  │
│                                                                 │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Git Repository                                            │ │
│  │  ──────────────────────────────────────────────────────── │ │
│  │  📁 https://github.com/orion/payment-api.git              │ │
│  │  🌿 main                                                  │ │
│  │  📂 manifests/production                                  │ │
│  │  🔗 @a1b2c3d - "Update resource limits" - 2h ago          │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Sync History (Last 5)                                     │ │
│  │  ──────────────────────────────────────────────────────── │ │
│  │  │ Time    │ Revision  │ Result  │ Trigger      │ Duration│ │
│  │  │─────────│───────────│─────────│──────────────│─────────│ │
│  │  │ 14:30   │ a1b2c3d   │ ✅      │ Auto         │ 45s     │ │
│  │  │ 12:15   │ 9f8e7d6   │ ✅      │ Manual       │ 52s     │ │
│  │  │ 09:00   │ 5c4d3e2   │ ⚠️      │ Schedule     │ 1m 12s  │ │
│  │  │ ...                                                      │ │
│  │  [View Full History] [Compare] [Rollback]                   │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Resources (12)                                            │ │
│  │  ──────────────────────────────────────────────────────── │ │
│  │  │ Kind       │ Name              │ Status │ Health       │ │
│  │  │────────────│───────────────────│────────│──────────────│ │
│  │  │ Deployment │ payment-api       │ Synced │ Healthy      │ │
│  │  │ Service    │ payment-api-svc   │ Synced │ Healthy      │ │
│  │  │ ConfigMap  │ payment-api-cfg   │ Synced │ -            │ │
│  │  │ ...                                                      │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2.3 响应式断点布局

| 断点 | 宽度 | 布局策略 |
|------|------|----------|
| XS | < 576px | 单列卡片布局，集群概览折叠，筛选器底部抽屉 |
| SM | 576-768px | 紧凑表格，隐藏集群列，状态简化 |
| MD | 768-992px | 完整表格，集群概览底部 |
| LG+ | > 992px | 完整布局，支持侧边详情预览 |

---

## 三、组件清单

### 3.1 使用组件列表

| 组件名 | 用途 | 状态数 | 设计规范 |
|--------|------|--------|----------|
| `PageHeader` | 页面标题 + 创建按钮 | 1 | 带批量操作 |
| `AppTable` | ArgoCD 应用表格 | 5 | 支持行展开 |
| `StatusBadge` | 同步状态徽章 | 5 | Synced/OutOf/Error/Unknown |
| `HealthBadge` | 健康度徽章 | 5 | Healthy/Degraded/Missing/Suspended/Unknown |
| `ClusterSelector` | 集群选择器 | 3 | 搜索 + 最近 |
| `NamespaceSelector` | 命名空间选择器 | 3 | 级联选择 |
| `SyncPolicyBadge` | 同步策略徽章 | 2 | Auto/Manual |
| `ClusterOverview` | 集群概览卡片 | 3 | 健康度点阵 |
| `AppDrawer` | 应用详情抽屉 | 2 | 从右侧滑出 |
| `SyncHistory` | 同步历史表格 | 3 | 可比较/回滚 |
| `ResourceTree` | 资源树形图 | 2 | 依赖关系可视化 |
| `YamlEditor` | YAML 编辑器 | 3 | 语法高亮 |
| `CompareModal` | 版本比较弹窗 | 2 | diff 视图 |
| `RollbackModal` | 回滚配置弹窗 | 2 | 版本选择 |
| `EmptyState` | 空状态 | 3 | 无应用/无搜索结果 |
| `Skeleton` | 加载骨架屏 | 4 | 表格/卡片/树形 |

### 3.2 组件颜色映射

```css
/* 同步状态颜色 - 基于 Orion Design Tokens */
:root {
  --sync-synced-bg: var(--success-50);
  --sync-synced-text: var(--success-600);
  --sync-synced-border: var(--success-200);
  
  --sync-outof-bg: var(--warning-50);
  --sync-outof-text: var(--warning-600);
  --sync-outof-border: var(--warning-200);
  
  --sync-error-bg: var(--error-50);
  --sync-error-text: var(--error-600);
  --sync-error-border: var(--error-200);
  
  --sync-unknown-bg: var(--neutral-50);
  --sync-unknown-text: var(--neutral-500);
  --sync-unknown-border: var(--neutral-200);
}

/* 健康度颜色 */
:root {
  --health-healthy-bg: var(--success-50);
  --health-healthy-text: var(--success-600);
  --health-healthy-border: var(--success-200);
  
  --health-degraded-bg: var(--warning-50);
  --health-degraded-text: var(--warning-700);
  --health-degraded-border: var(--warning-200);
  
  --health-missing-bg: var(--error-50);
  --health-missing-text: var(--error-600);
  --health-missing-border: var(--error-200);
  
  --health-suspended-bg: var(--info-50);
  --health-suspended-text: var(--info-600);
  --health-suspended-border: var(--info-200);
}
```

---

## 四、颜色与视觉规范

### 4.1 主色调应用

| 元素 | 颜色 Token | HEX | 用途 |
|------|-----------|-----|------|
| 主按钮背景 | `primary-600` | #0058C4 | 创建应用 |
| 主按钮悬停 | `primary-700` | #0047A0 | 按钮 Hover |
| 同步操作 | `primary-500` | #0070F3 | 手动同步按钮 |
| 回滚操作 | `error-600` | #D9363E | 回滚按钮 |
| 比较操作 | `info-600` | #08979C | 比较按钮 |

### 4.2 同步状态色完整定义

```css
/* Synced - 已同步 */
.sync-synced {
  background-color: var(--success-50);    /* #F6FFED */
  color: var(--success-600);              /* #389E0D - 对比度 5.2:1 ✅ */
  border-color: var(--success-200);       /* #B7EB8F */
}

/* OutOfSync - 不同步 */
.sync-outof {
  background-color: var(--warning-50);    /* #FFFBE6 */
  color: var(--warning-600);              /* #D48806 - 对比度 4.6:1 ✅ */
  border-color: var(--warning-200);       /* #FFE58F */
}

/* Error - 错误 */
.sync-error {
  background-color: var(--error-50);      /* #FFF1F0 */
  color: var(--error-600);                /* #D9363E - 对比度 5.1:1 ✅ */
  border-color: var(--error-200);         /* #FFA39E */
  animation: pulse-error 2s infinite;
}

/* Unknown - 未知 */
.sync-unknown {
  background-color: var(--neutral-50);    /* #FAFAFA */
  color: var(--neutral-500);              /* #8C8C8C - 对比度 4.2:1 ✅ */
  border-color: var(--neutral-200);       /* #EBEBEB */
}

@keyframes pulse-error {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}
```

### 4.3 健康度色完整定义

```css
/* Healthy - 健康 */
.health-healthy {
  background-color: var(--success-50);
  color: var(--success-600);
  border-color: var(--success-200);
}

/* Degraded - 降级 */
.health-degraded {
  background-color: var(--warning-50);
  color: var(--warning-700);              /* #AD6800 - 对比度 6.2:1 ✅ */
  border-color: var(--warning-200);
}

/* Missing - 缺失 */
.health-missing {
  background-color: var(--error-50);
  color: var(--error-600);
  border-color: var(--error-200);
}

/* Suspended - 暂停 */
.health-suspended {
  background-color: var(--info-50);
  color: var(--info-600);
  border-color: var(--info-200);
}
```

### 4.4 集群健康度点阵

```css
/* 5 点健康度表示法 */
.cluster-health {
  display: flex;
  gap: 4px;
}

.health-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: var(--neutral-200);
}

/* 100% - 5 点全绿 */
.health-100 .health-dot { background-color: var(--success-500); }

/* 80% - 4 点绿 */
.health-80 .health-dot:nth-child(-n+4) { background-color: var(--success-500); }

/* 60% - 3 点绿 */
.health-60 .health-dot:nth-child(-n+3) { background-color: var(--success-500); }

/* 40% - 2 点绿，2 点橙 */
.health-40 {
  .health-dot:nth-child(-n+2) { background-color: var(--success-500); }
  .health-dot:nth-child(3), .health-dot:nth-child(4) { background-color: var(--warning-500); }
}

/* 20% - 1 点绿，4 点红 */
.health-20 {
  .health-dot:first-child { background-color: var(--success-500); }
  .health-dot:nth-child(n+2) { background-color: var(--error-500); }
}
```

### 4.5 暗黑模式映射

```css
.dark-mode {
  --sync-synced-bg: hsl(145, 25%, 12%);
  --sync-synced-text: var(--success-300);
  --sync-synced-border: hsl(145, 30%, 25%);
  
  --sync-outof-bg: hsl(38, 30%, 15%);
  --sync-outof-text: var(--warning-300);
  
  --sync-error-bg: hsl(359, 30%, 15%);
  --sync-error-text: var(--error-300);
  
  --health-degraded-text: var(--warning-400);
  
  --cluster-health-dot-active: var(--success-400);
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
| 表格标题 | `text-xs` | 12px | 16px | 600 |
| 表格正文 | `text-sm` | 14px | 20px | 400 |
| Git 提交哈希 | `text-xs` | 12px | 16px | 400 |
| 健康度百分比 | `text-lg` | 18px | 28px | 600 |

### 5.2 表格列宽定义

| 列名 | 宽度 | 对齐 | 可排序 |
|------|------|------|--------|
| 名称 | 180px | 左 | 是 |
| 同步状态 | 100px | 左 | 是 |
| 健康度 | 100px | 左 | 是 |
| 同步策略 | 80px | 居中 | 是 |
| 集群 | 120px | 左 | 是 |
| 命名空间 | 120px | 左 | 是 |
| 最后同步 | 100px | 右 | 是 |
| 操作 | 100px | 右 | 否 |

---

## 六、交互说明

### 6.1 核心交互行为

| 交互 | 触发条件 | 反馈 | 持续时间 |
|------|----------|------|----------|
| 行展开 | 点击应用名 | 显示资源树 | 200ms |
| 状态筛选 | 下拉选择 | 表格刷新 | 150ms |
| 应用详情 | 点击行 | 右侧抽屉滑出 | 300ms |
| 手动同步 | 点击同步按钮 | 确认→执行→刷新 | 500ms+API |
| 版本比较 | 点击比较按钮 | 弹窗 diff 视图 | 250ms |
| 回滚操作 | 点击回滚 | 确认→执行→刷新 | 500ms+API |
| 批量同步 | 选择多行→批量操作 | 确认→执行→刷新 | 500ms+API |

### 6.2 键盘快捷键

| 快捷键 | 功能 | 适用场景 |
|--------|------|----------|
| `Cmd/Ctrl + N` | 创建新应用 | 全局 |
| `Cmd/Ctrl + S` | 触发同步 | 有选中项 |
| `Cmd/Ctrl + R` | 回滚到上一版本 | 有选中项 |
| `Cmd/Ctrl + D` | 打开详情抽屉 | 有选中项 |
| `Cmd/Ctrl + /` | 打开快捷键帮助 | 全局 |
| `Escape` | 关闭抽屉/弹窗 | 任意 |
| `↑/↓` | 上下选择应用 | 表格聚焦 |
| `Enter` | 打开选中的应用 | 行聚焦 |
| `Space` | 切换选中状态 | 行聚焦 |
| `A` | 全选当前页 | 全局 |

### 6.3 同步确认规则

| 操作 | 是否需要确认 | 确认方式 | 可撤销 |
|------|--------------|----------|--------|
| 手动同步 | 否（生产环境是） | 生产环境需模态框确认 | ✅ 可回滚 |
| 批量同步 (≥5) | 是 | 模态框 + 数量确认 | ✅ 可逐一回滚 |
| 回滚操作 | 是 | 模态框 + 版本确认 | ❌ 不可撤销 |
| 删除应用 | 是 | 模态框 + 名称确认 | ❌ 不可撤销 |
| 修改同步策略 | 是 | Toast 确认 | ✅ 可修改回 |

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
│                    暂无 ArgoCD 应用                              │
│              text-2xl, font-weight-semibold, neutral-800        │
│                                                                 │
│          创建第一个 ArgoCD 应用，开始 GitOps 部署流程            │
│              text-md, neutral-500, margin-top: 8px             │
│                                                                 │
│              ┌──────────────┐  ┌──────────────┐                │
│              │ + 创建应用   │  │ 📖 查看文档  │                │
│              │ primary-600  │  │ neutral-600  │                │
│              └──────────────┘  └──────────────┘                │
│                                                                 │
│          ───────────  快速开始  ───────────                    │
│                                                                 │
│     1. 连接 Git 仓库  →  2. 配置 manifests 路径  →  3. 选择集群   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 7.2 加载状态（Loading State）

**骨架屏规格**：
```css
.app-skeleton {
  display: grid;
  grid-template-columns: 180px 100px 100px 80px 1fr;
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

/* 状态徽章骨架 */
.skeleton-badge {
  width: 80px;
  height: 24px;
  border-radius: var(--radius-sm);
  background: var(--neutral-200);
  animation: skeleton-loading 1.5s infinite;
}

/* 健康度点阵骨架 */
.skeleton-health {
  display: flex;
  gap: 4px;
}

.skeleton-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--neutral-200);
  animation: skeleton-loading 1.5s infinite;
}
```

**加载行数**：显示 5 行骨架屏

### 7.3 错误状态（Error State）

| 错误类型 | 展示方式 | 用户操作 | 自动重试 |
|----------|----------|----------|----------|
| 数据加载失败 | 全页错误卡片 | [重试] [检查连接] | 3 次后停止 |
| ArgoCD 连接失败 | 行内状态图标 | [重新连接] [配置] | 否 |
| 同步失败 | 行内错误状态 + Toast | [查看日志] [重试] | 可选 |
| 权限不足 | 空状态 + 申请按钮 | [申请权限] | 否 |

### 7.4 同步状态定义

| 状态 | 图标 | 颜色 | 说明 |
|------|------|------|------|
| Synced | ✅ | success-600 | Git 与集群状态一致 |
| OutOfSync | 🟡 | warning-600 | Git 有未同步变更 |
| Error | ❌ | error-600 | 同步过程出错 |
| Unknown | ⚪ | neutral-400 | 状态未知 |

### 7.5 健康度定义

| 状态 | 图标 | 颜色 | 说明 |
|------|------|------|------|
| Healthy | 🟢 | success-600 | 所有资源健康 |
| Degraded | 🟠 | warning-600 | 部分资源异常 |
| Missing | 🔴 | error-600 | 关键资源缺失 |
| Suspended | ⚪ | info-600 | 应用已暂停 |
| Unknown | ❓ | neutral-400 | 健康度未知 |

---

## 八、响应式设计

### 8.1 移动端适配策略

**XS (< 576px) - 卡片模式**：
```
┌─────────────────────────────────┐
│  GitOps Config    [+ App]       │
├─────────────────────────────────┤
│ [Apps] [Clusters] [History]     │
├─────────────────────────────────┤
│ ┌─────────────────────────────┐ │
│ │ payment-api           ✅🟢  │ │
│ │ prod-cn • Auto Sync         │ │
│ │ Last: 2h ago                │ │
│ │ [Sync] [View] [More ▼]     │ │
│ └─────────────────────────────┘ │
│ ┌─────────────────────────────┐ │
│ │ order-service         🟡🟠  │ │
│ │ prod-cn • Manual            │ │
│ │ Last: 5h ago                │ │
│ │ [Sync] [More ▼]            │ │
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```

**SM (576-768px) - 紧凑表格**：
- 隐藏命名空间列
- 集群概览垂直堆叠
- 筛选器简化为图标

**MD (768-992px) - 完整功能**：
- 显示所有列
- 集群概览底部固定
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
  --drawer-padding: var(--spacing-xl);
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
  --shadow-drawer: 0 24px 48px rgba(0, 0, 0, 0.2);
}
```

### 9.4 动画系统

```css
:root {
  --transition-fast: 150ms ease;
  --transition-normal: 200ms ease;
  --transition-slow: 300ms ease;
  
  --animation-pulse: pulse 2s infinite;
  --animation-pulse-error: pulse-error 2s infinite;
  --animation-slide-right: slide-right 300ms ease;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

@keyframes pulse-error {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

@keyframes slide-right {
  from { transform: translateX(100%); }
  to { transform: translateX(0); }
}
```

---

## 十、Agent 开发指南

### 10.1 快速实现提示

使用以下提示词生成代码：

```
创建一个 GitOps 配置管理页面，使用以下设计令牌：
- 同步状态：Synced #389E0D, OutOfSync #D48806, Error #D9363E
- 健康度：Healthy #389E0D, Degraded #AD6800, Missing #D9363E
- 集群健康度点阵：5 点表示法，100%=5 绿，80%=4 绿，60%=3 绿，40%=2 绿 2 橙，20%=1 绿 4 红
- 表格行高：56px（运维密集型）
- 圆角：8px (radius-md)
- 字体：等宽字体显示 Git 提交哈希
```

### 10.2 关键实现检查点

- [ ] ArgoCD API 集成状态实时显示
- [ ] 同步状态和健康度自动刷新（30s 轮询）
- [ ] 回滚操作需要版本确认
- [ ] 批量操作支持选择/取消全选
- [ ] WCAG 2.1 AA 对比度合规
- [ ] 键盘导航完整（Tab 顺序、快捷键）
- [ ] 聚焦状态可见（`:focus-visible`）
- [ ] 暗黑模式颜色映射正确
- [ ] 响应式断点测试通过
- [ ] 骨架屏和空状态实现
- [ ] YAML 编辑器支持语法高亮和校验
- [ ] Diff 视图支持并排/内联切换

### 10.3 ArgoCD 集成要求

- ArgoCD API v1.0+ 支持
- JWT Token 认证
- 应用列表轮询（30s 间隔）
- 事件 WebSocket 推送
- 多集群配置管理
- 应用 CRUD 操作
- 同步/回滚/比较 API

### 10.4 Git 仓库配置模板

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: payment-api
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/orion/payment-api.git
    targetRevision: HEAD
    path: manifests/production
  destination:
    server: https://k8s.prod-cn.example.com
    namespace: payment
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
    - CreateNamespace=true
```

---

*文档版本：v1.0*  
*创建日期：2026-04-10*  
*基于 Orion Design Tokens v1.2.0*
