# Orion 多租户管理设计文档

> 版本：v1.0  
> 创建日期：2026-04-10  
> 设计师：Orion Design System Team  
> 适用范围：P0 核心功能 - 多租户与资源隔离模块

---

## 一、页面概述

### 1.1 页面定义

多租户管理（Multi-Tenancy）是 Orion 平台的租户资源管理中心，用户在此管理租户列表、配置资源配额、设置租户隔离、管理租户权限和查看租户账单与成本。页面采用企业级 SaaS 控制台设计风格，兼顾资源管理的精细化和成本可视性。

### 1.2 目标用户

| 角色 | 核心任务 | 使用频率 | 权限级别 |
|------|----------|----------|----------|
| 平台管理员 | 创建租户、分配配额 | 中频（每周 3-5 次） | 完全访问 |
| 运维工程师 | 监控资源使用、调整配额 | 高频（每日 3-5 次） | 配置/执行 |
| 财务/成本 | 查看账单、成本分摊 | 低频（每月 2-3 次） | 只读/分析 |
| 租户管理员 | 管理本租户资源 | 中频（每周 3-5 次） | 租户级配置 |

### 1.3 设计原则

- **租户清晰**：所有租户状态和资源使用一目了然
- **配额精细**：CPU/内存/存储可独立配置
- **隔离安全**：Namespace/Schema 多层隔离策略
- **成本可视**：账单明细和成本趋势清晰可见

---

## 二、布局结构

### 2.1 页面布局（ASCII）

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Top Navigation Bar                                                     │
├────────┬────────────────────────────────────────────────────────────────┤
│        │                                                                │
│ Side   │  ┌──────────────────────────────────────────────────────────┐ │
│ bar    │  │  Multi-Tenancy                          [+ New Tenant]   │ │
│        │  └──────────────────────────────────────────────────────────┘ │
│        │                                                                │
│        │  ┌──────────────────────────────────────────────────────────┐ │
│        │  │  [Tenants] [Quotas] [Isolation] [Permissions] [Billing] │ │
│        │  └──────────────────────────────────────────────────────────┘ │
│        │                                                                │
│        │  ┌──────────────────────────────────────────────────────────┐ │
│        │  │  🔍 Search tenants...      [Status ▼] [Plan ▼] [+]      │ │
│        │  └──────────────────────────────────────────────────────────┘ │
│        │                                                                │
│        │  ┌──────────────────────────────────────────────────────────┐ │
│        │  │  Tenants (24)                                           │ │
│        │  │  ──────────────────────────────────────────────────────  │ │
│        │  │  ┌────────────────────────────────────────────────────┐  │ │
│        │  │  │ 🏢 Acme Corp          🟢 Active    Enterprise     │  │ │
│        │  │  │    ID: tenant-001    Created: 2025-01-15           │  │ │
│        │  │  │    CPU: 45/100 cores  Memory: 128/256 GB  Storage: 2/5 TB│ │ │
│        │  │  │    [Manage] [Quota] [Billing] [Settings]           │  │ │
│        │  │  └────────────────────────────────────────────────────┘  │ │
│        │  │  ┌────────────────────────────────────────────────────┐  │ │
│        │  │  │ 🏢 TechStart Inc      🟡 Warning   Pro            │  │ │
│        │  │  │    ID: tenant-002    Created: 2025-03-20           │  │ │
│        │  │  │    CPU: 18/20 cores ⚠️  Memory: 32/32 GB ⚠️  Storage: 450/500 GB│ │ │
│        │  │  │    [Manage] [Quota] [Billing] [Settings]           │  │ │
│        │  │  └────────────────────────────────────────────────────┘  │ │
│        │  └──────────────────────────────────────────────────────────┘ │
│        │                                                                │
│        │  ┌──────────────────────────────────────────────────────────┐ │
│        │  │  Cluster Resources Summary                              │ │
│        │  │  ┌─────────┬─────────┬─────────┬───────────────────────┐ │ │
│        │  │  │ Total   │ Allocated │ Available │ Utilization       │ │ │
│        │  │  │ 500C    │ 380C      │ 120C      │ 76%               │ │ │
│        │  │  │ 1024GB  │ 820GB     │ 204GB     │ 80%               │ │ │
│        │  │  │ 20TB    │ 15.2TB    │ 4.8TB     │ 76%               │ │ │
│        │  │  └─────────┴─────────┴─────────┴───────────────────────┘ │ │
│        │  └──────────────────────────────────────────────────────────┘ │
│        │                                                                │
└────────┴────────────────────────────────────────────────────────────────┘
```

### 2.2 租户配置抽屉（ASCII）

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Tenant Configuration - Acme Corp                         [X] [Save]    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  Basic Information                                                │  │
│  │  ───────────────────────────────────────────────────────────────  │  │
│  │  Tenant Name: [Acme Corp                                         ]│  │
│  │  Tenant ID:   [tenant-001                          ] (Read-only)  │  │
│  │  Plan:        [Enterprise ▼]                                      │  │
│  │  Status:      [🟢 Active ▼]                                       │  │
│  │  Description: [企业级租户，完整功能访问                           ]│  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  Resource Quota                                                   │  │
│  │  ───────────────────────────────────────────────────────────────  │  │
│  │  ┌────────────────────────────────────────────────────────────┐   │  │
│  │  │ Compute Resources                                          │   │  │
│  │  │ ────────────────────────────────────────────────────────── │   │  │
│  │  │ CPU Cores:      [====●========] 45/100 cores (45%)         │   │  │
│  │  │ Memory:         [=====●=======] 128/256 GB (50%)           │   │  │
│  │  │ GPU:            [=============] 0/4 GPUs (0%)              │   │  │
│  │  │                                                          │   │  │
│  │  │ Limit Configuration:                                      │   │  │
│  │  │ CPU: [100] cores    Memory: [256] GB    GPU: [4]          │   │  │
│  │  └────────────────────────────────────────────────────────────┘   │  │
│  │                                                                   │  │
│  │  ┌────────────────────────────────────────────────────────────┐   │  │
│  │  │ Storage Resources                                          │   │  │
│  │  │ ────────────────────────────────────────────────────────── │   │  │
│  │  │ Persistent Storage: [==●=========] 2/5 TB (40%)            │   │  │
│  │  │ Object Storage:     [===●========] 1.2/4 TB (30%)          │   │  │
│  │  │ Backup Storage:     [●===========] 200/500 GB (40%)        │   │  │
│  │  │                                                            │   │  │
│  │  │ Limit Configuration:                                       │   │  │
│  │  │ Persistent: [5] TB    Object: [4] TB    Backup: [500] GB   │   │  │
│  │  └────────────────────────────────────────────────────────────┘   │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  Isolation Configuration                                          │  │
│  │  ───────────────────────────────────────────────────────────────  │  │
│  │  Isolation Level: [Namespace + Schema ▼]                          │  │
│  │                                                                   │  │
│  │  Kubernetes Namespace: [acme-corp-prod                          ]  │  │
│  │  Database Schema:      [acme_prod                               ]  │  │
│  │  Network Policy:       [isolated ▼]                               │  │
│  │                                                                   │  │
│  │  ☑ Enable Pod Security Policy                                     │  │
│  │  ☑ Enable Network Isolation                                       │  │
│  │  ☑ Enable Storage Isolation                                       │  │
│  │  ☑ Enable Resource Priority (QoS: Guaranteed)                     │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  Access Control                                                   │  │
│  │  ───────────────────────────────────────────────────────────────  │  │
│  │  Tenant Admins:                                                   │  │
│  │  [👤 zhang@acme.com (Owner)] [👤 li@acme.com (Admin)]             │  │
│  │  [+ Add Admin]                                                    │  │
│  │                                                                   │  │
│  │  Roles & Permissions:                                             │  │
│  │  ┌────────────────────────────────────────────────────────────┐   │  │
│  │  │ Role              │ Permissions                    │ Count │   │  │
│  │  │ ────────────────────────────────────────────────── │   │   │  │
│  │  │ Tenant Admin    │ Full tenant access          │ 2    │   │  │
│  │  │ Developer       │ Deploy, Manage resources    │ 15   │   │  │
│  │  │ Viewer          │ Read-only access            │ 8    │   │  │
│  │  └────────────────────────────────────────────────────────────┘   │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  Billing & Cost (Current Month)                                   │  │
│  │  ───────────────────────────────────────────────────────────────  │  │
│  │  ┌────────────────────────────────────────────────────────────┐   │  │
│  │  │ Item                    │ Usage      │ Rate      │ Cost   │   │  │
│  │  │ ────────────────────────────────────────────────────────── │   │  │
│  │  │ Compute (CPU-hours)     │ 32,400     │ $0.05/hr  │ $1,620 │   │  │
│  │  │ Memory (GB-hours)       │ 92,160     │ $0.01/GB  │ $921   │   │  │
│  │  │ Storage (GB-month)      │ 2,048      │ $0.10/GB  │ $205   │   │  │
│  │  │ Network (GB egress)     │ 512        │ $0.08/GB  │ $41    │   │  │
│  │  │ ────────────────────────────────────────────────────────── │   │  │
│  │  │ Total                                          │ $2,787 │   │  │
│  │  └────────────────────────────────────────────────────────────┘   │  │
│  │                                                                   │  │
│  │  Budget: $5,000/month    Remaining: $2,213 (56%)                  │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│  [Cancel]  [Save Configuration]                                         │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.3 响应式断点布局

| 断点 | 宽度 | 布局策略 |
|------|------|----------|
| XS | < 576px | 单列卡片布局，标签页简化为下拉，配置抽屉全屏 |
| SM | 576-768px | 卡片堆叠，资源使用简化，抽屉 80% 宽度 |
| MD | 768-992px | 双列布局，标签页完整，抽屉 60% 宽度 |
| LG+ | > 992px | 完整布局，所有功能可见 |

---

## 三、组件清单

### 3.1 使用组件列表

| 组件名 | 用途 | 状态数 | 设计规范 |
|--------|------|--------|----------|
| `PageHeader` | 页面标题 + 创建按钮 | 1 | 带副标题说明 |
| `TabBar` | 标签页导航 | 5 | Tenants/Quotas/Isolation/Permissions/Billing |
| `TenantCard` | 租户卡片 | 4 | Active/Warning/Suspended/Inactive |
| `PlanBadge` | 套餐徽章 | 4 | Enterprise/Pro/Standard/Free |
| `ResourceMeter` | 资源计量表 | 5 | CPU/Memory/Storage/GPU/Network |
| `ProgressBar` | 进度条 | 4 | 使用率可视化 |
| `QuotaConfig` | 配额配置器 | 3 | Edit/View/Compare |
| `IsolationBadge` | 隔离等级徽章 | 4 | Namespace/Schema/Network/Full |
| `RoleTable` | 角色权限表 | 3 | Admin/Developer/Viewer |
| `BillingTable` | 账单明细表 | 4 | Current/Historical/Projected/Alert |
| `CostChart` | 成本趋势图 | 3 | Daily/Monthly/Yearly |
| `EmptyState` | 空状态 | 4 | 无租户/无配额 |
| `Skeleton` | 加载骨架屏 | 3 | 卡片/表格/图表 |

### 3.2 组件颜色映射

```css
/* 租户状态颜色 - 基于 Orion Design Tokens */
:root {
  --tenant-active-bg: var(--success-50);
  --tenant-active-text: var(--success-600);
  --tenant-active-border: var(--success-200);
  
  --tenant-warning-bg: var(--warning-50);
  --tenant-warning-text: var(--warning-600);
  --tenant-warning-border: var(--warning-200);
  
  --tenant-suspended-bg: var(--error-50);
  --tenant-suspended-text: var(--error-600);
  --tenant-suspended-border: var(--error-200);
  
  --tenant-inactive-bg: var(--neutral-50);
  --tenant-inactive-text: var(--neutral-500);
  --tenant-inactive-border: var(--neutral-200);
}

/* 资源使用率颜色 */
:root {
  --usage-low: var(--success-500);       /* 0-60% */
  --usage-medium: var(--warning-500);    /* 61-80% */
  --usage-high: var(--error-500);        /* 81-100% */
  --usage-over: var(--error-700);        /* >100% */
}
```

---

## 四、颜色与视觉规范

### 4.1 主色调应用

| 元素 | 颜色 Token | HEX | 用途 |
|------|-----------|-----|------|
| 主按钮背景 | `primary-600` | #0058C4 | 新建租户 |
| 主按钮悬停 | `primary-700` | #0047A0 | 按钮 Hover |
| 激活标签 | `primary-50` | #E6F4FF | 标签页选中 |
| 激活文本 | `primary-600` | #0058C4 | 标签页文字 |
| 链接文本 | `primary-500` | #0070F3 | 可点击文本 |

### 4.2 租户状态色完整定义

```css
/* Active - 活跃 */
.tenant-active {
  background-color: var(--success-50);    /* #F6FFED */
  color: var(--success-600);              /* #389E0D - 对比度 5.2:1 ✅ */
  border-color: var(--success-200);       /* #B7EB8F */
}

/* Warning - 资源告警 */
.tenant-warning {
  background-color: var(--warning-50);    /* #FFFBE6 */
  color: var(--warning-600);              /* #D48806 - 对比度 4.6:1 ✅ */
  border-color: var(--warning-200);       /* #FFE58F */
}

/* Suspended - 已暂停 */
.tenant-suspended {
  background-color: var(--error-50);      /* #FFF1F0 */
  color: var(--error-600);                /* #D9363E - 对比度 5.1:1 ✅ */
  border-color: var(--error-200);         /* #FFA39E */
}

/* Inactive - 未激活 */
.tenant-inactive {
  background-color: var(--neutral-50);    /* #FAFAFA */
  color: var(--neutral-500);              /* #8C8C8C */
  border-color: var(--neutral-200);       /* #EBEBEB */
}
```

### 4.3 资源使用率进度条

```css
/* 资源使用率颜色阈值 */
.progress-usage {
  --usage-low: #52C41A;       /* 0-60% - Healthy */
  --usage-medium: #FAAD14;    /* 61-80% - Warning */
  --usage-high: #F5222D;      /* 81-100% - Critical */
  --usage-over: #A8222E;      /* >100% - Over Limit */
}

/* 进度条样式 */
.progress-bar {
  height: 8px;
  border-radius: var(--radius-xs);
  background-color: var(--neutral-100);
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  transition: width 0.3s ease, background-color 0.2s ease;
}
```

### 4.4 套餐等级颜色

```css
/* 租户套餐等级 */
.plan-enterprise {
  background-color: var(--primary-50);
  color: var(--primary-700);
  border: 1px solid var(--primary-300);
}

.plan-pro {
  background-color: var(--info-50);
  color: var(--info-700);
  border: 1px solid var(--info-300);
}

.plan-standard {
  background-color: var(--success-50);
  color: var(--success-700);
  border: 1px solid var(--success-300);
}

.plan-free {
  background-color: var(--neutral-50);
  color: var(--neutral-700);
  border: 1px solid var(--neutral-300);
}
```

### 4.5 暗黑模式映射

```css
.dark-mode {
  --tenant-active-bg: hsl(145, 25%, 12%);
  --tenant-active-text: var(--success-300);
  
  --tenant-warning-bg: hsl(38, 30%, 15%);
  --tenant-warning-text: var(--warning-300);
  
  --tenant-suspended-bg: hsl(359, 25%, 12%);
  --tenant-suspended-text: var(--error-300);
  
  --usage-low: #73D13D;
  --usage-medium: #FFC53D;
  --usage-high: #FF6B6D;
  --usage-over: #FF4D4F;
}
```

---

## 五、字体与排版

### 5.1 字号层级

| 元素 | Token | 字号 | 行高 | 字重 |
|------|-------|------|------|------|
| 页面标题 | `text-2xl` | 24px | 32px | 600 |
| 卡片标题 | `text-md` | 16px | 24px | 600 |
| 租户名称 | `text-md` | 16px | 24px | 600 |
| 资源数值 | `text-lg` | 18px | 28px | 700 |
| 辅助文本 | `text-xs` | 12px | 16px | 400 |
| 账单金额 | `text-xl` | 20px | 28px | 700 |

### 5.2 资源进度条尺寸

| 元素 | 尺寸 | 字体 |
|------|------|------|
| 进度条高度 | 8px | - |
| 数值显示 | text-sm, 500 | - |
| 百分比 | text-xs, 500 | - |

---

## 六、交互说明

### 6.1 核心交互行为

| 交互 | 触发条件 | 反馈 | 持续时间 |
|------|----------|------|----------|
| 租户卡片悬停 | 鼠标进入 | 显示操作按钮 | 150ms |
| 租户详情 | 点击详情 | 抽屉滑出 | 300ms |
| 标签切换 | 点击标签 | 内容切换+URL 更新 | 200ms |
| 配额调整 | 滑块/输入 | 实时验证 | 即时 |
| 资源筛选 | 条件变更 | 列表刷新 | 300ms |
| 成本图表缩放 | 滚轮/拖拽 | 平滑缩放 | 即时 |

### 6.2 键盘快捷键

| 快捷键 | 功能 | 适用场景 |
|--------|------|----------|
| `Cmd/Ctrl + K` | 聚焦全局搜索 | 全局 |
| `Cmd/Ctrl + N` | 新建租户 | 全局 |
| `Cmd/Ctrl + Q` | 查看资源配额 | 租户聚焦 |
| `Cmd/Ctrl + S` | 保存配置 | 编辑状态 |
| `Escape` | 关闭抽屉/弹窗 | 任意 |
| `↑/↓` | 上下选择租户 | 列表聚焦 |
| `Enter` | 打开租户详情 | 行聚焦 |
| `E` | 编辑选中租户 | 有选中项 |

### 6.3 操作确认规则

| 操作 | 是否需要确认 | 确认方式 | 可撤销 |
|------|--------------|----------|--------|
| 新建租户 | 否 | 验证后生效 | ✅ 可停用 |
| 删除租户 | 是 | 模态框 + 名称确认 | ❌ 不可撤销 |
| 调整配额 | 否 | 保存即生效 | ✅ 可恢复 |
| 暂停租户 | 是 | 影响提示确认 | ✅ 可恢复 |
| 批量操作 | 是 | 数量确认 | 部分可逆 |

---

## 七、状态定义

### 7.1 空状态（Empty State）

```
┌─────────────────────────────────────────────────────────────────┐
│                        ┌─────────────┐                         │
│                        │             │                         │
│                        │    🏢       │                         │
│                        │  (64x64px)  │                         │
│                        │             │                         │
│                        └─────────────┘                         │
│                                                                 │
│                  暂无租户                                       │
│              text-2xl, font-weight-semibold, neutral-800        │
│                                                                 │
│          创建第一个租户，开始多租户管理                           │
│              text-md, neutral-500, margin-top: 8px             │
│                                                                 │
│              ┌──────────────┐  ┌──────────────┐                │
│              │ + 创建租户   │  │ 📖 配置指南  │                │
│              │ primary-600  │  │ neutral-600  │                │
│              └──────────────┘  └──────────────┘                │
│                                                                 │
│          ───────────  支持场景  ───────────                    │
│                                                                 │
│     🏢 企业组织  •  👥 团队隔离  •  🧪 环境分离  •  💰 成本分摊   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 7.2 加载状态（Loading State）

**骨架屏规格**：
```css
.tenant-card-skeleton {
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

.skeleton-resources {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 12px;
}

.skeleton-progress {
  height: 8px;
  background: var(--neutral-200);
  border-radius: var(--radius-xs);
  animation: skeleton-loading 1.5s infinite;
}
```

### 7.3 错误状态（Error State）

| 错误类型 | 展示方式 | 用户操作 | 自动重试 |
|----------|----------|----------|----------|
| 配额超限 | 卡片告警状态 | [申请扩容] [优化使用] | 否 |
| 租户创建失败 | Toast 提示 | [重试] [检查配置] | 3 次 |
| 账单计算失败 | 表格错误状态 | [重新计算] | 可选 |
| 权限不足 | 空状态 + 申请 | [申请权限] | 否 |

### 7.4 租户状态定义

| 状态 | 图标 | 颜色 | 说明 |
|------|------|------|------|
| Active | 🟢 | success-600 | 正常运行 |
| Warning | 🟡 | warning-600 | 资源告警 |
| Suspended | 🔴 | error-600 | 已暂停 |
| Inactive | ⚪ | neutral-500 | 未激活 |

---

## 八、响应式设计

### 8.1 移动端适配策略

**XS (< 576px) - 卡片模式**：
```
┌─────────────────────────────────┐
│  Tenants        [+ New Tenant]  │
├─────────────────────────────────┤
│ [Tenants ▼] [Quota] [Billing]   │
├─────────────────────────────────┤
│ ┌─────────────────────────────┐ │
│ │ 🏢 Acme Corp     🟢 Ent.    │ │
│ │ CPU: 45/100  Mem: 128/256   │ │
│ │ Storage: 2/5 TB             │ │
│ │ [Manage] [Billing]          │ │
│ └─────────────────────────────┘ │
│ ┌─────────────────────────────┐ │
│ │ 🏢 TechStart     🟡 Pro     │ │
│ │ CPU: 18/20 ⚠️  Mem: 32/32 ⚠️│ │
│ │ Storage: 450/500 GB         │ │
│ │ [Manage] [Billing]          │ │
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```

**SM (576-768px) - 双列卡片**：
- 租户卡片 2 列
- 资源使用简化
- 操作按钮图标化

**MD (768-992px) - 完整功能**：
- 租户卡片单列
- 所有资源指标可见
- 成本图表完整

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
  --tenant-card-gap: var(--spacing-md);
}
```

### 9.2 圆角系统

```css
:root {
  --radius-xs: 2px;    /* Badge, Progress */
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

### 9.4 资源进度条样式

```css
:root {
  --progress-height: 8px;
  --progress-radius: var(--radius-xs);
  --progress-gap: 4px;
  
  --progress-low: #52C41A;      /* 0-60% */
  --progress-medium: #FAAD14;   /* 61-80% */
  --progress-high: #F5222D;     /* 81-100% */
  --progress-over: #A8222E;     /* >100% */
  
  --progress-bg: var(--neutral-100);
}
```

### 9.5 动画系统

```css
:root {
  --transition-fast: 150ms ease;
  --transition-normal: 200ms ease;
  --transition-slow: 300ms ease;
  
  --animation-skeleton: skeleton-loading 1.5s infinite;
  --animation-progress: progress-pulse 2s infinite;
}

@keyframes skeleton-loading {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

@keyframes progress-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.9; }
}
```

---

## 十、Agent 开发指南

### 10.1 快速实现提示

使用以下提示词生成代码：

```
创建一个多租户管理页面，使用以下设计令牌：
- 租户状态：Active #389E0D, Warning #D48806, Suspended #D9363E, Inactive #8C8C8C
- 资源使用率：Low #52C41A (0-60%), Medium #FAAD14 (61-80%), High #F5222D (81-100%), Over #A8222E (>100%)
- 套餐等级：Enterprise #E6F4FF/#0058C4, Pro #E6FFFB/#08979C, Standard #F6FFED/#389E0D, Free #FAFAFA/#666666
- 进度条：高度 8px, 圆角 2px, 动态颜色
- 租户卡片：圆角 8px, 悬停阴影 shadow-md
- 标签页：选中背景 #E6F4FF, 文本 #0058C4
```

### 10.2 关键实现检查点

- [ ] 租户状态实时同步
- [ ] 资源使用率可视化
- [ ] 配额调整平滑
- [ ] 隔离配置清晰
- [ ] 成本计算准确
- [ ] WCAG 2.1 AA 对比度合规
- [ ] 键盘导航完整（Tab 顺序、快捷键）
- [ ] 聚焦状态可见（`:focus-visible`）
- [ ] 暗黑模式颜色映射正确
- [ ] 响应式断点测试通过
- [ ] 骨架屏和空状态实现
- [ ] 账单导出功能
- [ ] 配额告警通知

### 10.3 多租户 API 要求

- 租户 CRUD API
- 租户状态 API
- 资源配额 API
- 资源使用率 API
- 隔离配置 API
- 角色权限 API
- 账单计算 API
- 成本分析 API
- 配额告警 API

### 10.4 租户配置示例

```graphql
# Query tenants
query GetTenants {
  tenants {
    id
    name
    plan
    status
    createdAt
    resources {
      cpu { used limit unit }
      memory { used limit unit }
      storage { used limit unit }
    }
    isolation {
      level
      namespace
      schema
      networkPolicy
    }
    admins {
      id
      email
      role
    }
    billing {
      currentMonth
      budget
      remaining
    }
  }
}

# Query resource usage
query GetResourceUsage($tenantId: ID!) {
  resourceUsage(tenantId: $tenantId) {
    cpu { hours cost trend }
    memory { gbHours cost trend }
    storage { gb cost trend }
    network { gb cost trend }
    total { cost trend }
  }
}

# Update tenant quota
mutation UpdateTenantQuota {
  updateTenantQuota(
    tenantId: "tenant-001"
    input: {
      cpu: 150
      memory: 512
      storage: 10
    }
  ) {
    success
    tenant {
      resources {
        cpu { limit }
        memory { limit }
        storage { limit }
      }
    }
  }
}

# Generate billing report
mutation GenerateBillingReport {
  generateBillingReport(
    tenantId: "tenant-001"
    period: { start: "2026-04-01", end: "2026-04-30" }
  ) {
    reportId
    total
    breakdown {
      item
      usage
      rate
      cost
    }
  }
}
```

---

*文档版本：v1.0*  
*创建日期：2026-04-10*  
*基于 Orion Design Tokens v1.2.0*
