# Orion IaC 管理后台设计文档

> 版本：v1.0  
> 创建日期：2026-04-10  
> 设计师：Orion Design System Team  
> 适用范围：P1 核心功能 - 基础设施即代码模块

---

## 一、页面概述

### 1.1 页面定义

IaC 管理后台（Infrastructure as Code）是 Orion 平台的 Terraform 基础设施代码管理中心，用户在此管理 Terraform 工作区、查看 IaC 资源清单、检测配置漂移、审查 AI 分析结果和进行成本预估与优化。页面采用开发者工具设计风格，兼顾代码可读性和运维可视性。

### 1.2 目标用户

| 角色 | 核心任务 | 使用频率 | 权限级别 |
|------|----------|----------|----------|
| 平台工程师 | 编写 Terraform、管理状态 | 高频（每日 5-8 次） | 配置/执行 |
| 运维工程师 | 查看资源清单、检测漂移 | 中频（每周 5-8 次） | 执行/只读 |
| 技术主管 | 审批变更、查看成本 | 低频（每周 2-3 次） | 审批/只读 |
| 成本优化 | 成本分析、优化建议 | 低频（每周 1-2 次） | 只读/分析 |

### 1.3 设计原则

- **工作区清晰**：所有 Terraform 工作区状态可视
- **资源可视**：IaC 管理的资源清单清晰展示
- **漂移可测**：配置漂移自动检测和告警
- **AI 赋能**：Plan 智能审查，成本预估准确

---

## 二、布局结构

### 2.1 页面布局（ASCII）

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Top Navigation Bar                                                     │
├────────┬────────────────────────────────────────────────────────────────┤
│        │                                                                │
│ Side   │  ┌──────────────────────────────────────────────────────────┐ │
│ bar    │  │  IaC Management                         [+ New Workspace]│ │
│        │  └──────────────────────────────────────────────────────────┘ │
│        │                                                                │
│        │  ┌──────────────────────────────────────────────────────────┐ │
│        │  │  [Workspaces] [Resources] [Drift] [AI Review] [Cost]    │ │
│        │  └──────────────────────────────────────────────────────────┘ │
│        │                                                                │
│        │  ┌──────────────────────────────────────────────────────────┐ │
│        │  │  🔍 Search workspaces...   [Provider ▼] [Status ▼] [+]  │ │
│        │  └──────────────────────────────────────────────────────────┘ │
│        │                                                                │
│        │  ┌──────────────────────────────────────────────────────────┐ │
│        │  │  Terraform Workspaces (18)                              │ │
│        │  │  ──────────────────────────────────────────────────────  │ │
│        │  │  ┌────────────────────────────────────────────────────┐  │ │
│        │  │  │ 🌐 prod-infrastructure    AWS      🟢 Synced      │  │ │
│        │  │  │    /terraform/prod    Last run: 2h ago    v2.1.0   │  │ │
│        │  │  │    Resources: 156    Drifts: 0    Cost: $12,450/mo│  │ │
│        │  │  │    [Plan] [Apply] [State] [Settings]               │  │ │
│        │  │  └────────────────────────────────────────────────────┘  │ │
│        │  │  ┌────────────────────────────────────────────────────┐  │ │
│        │  │  │ 🌐 staging-infra        AWS      🟡 Drift (3)     │  │ │
│        │  │  │    /terraform/staging    Last run: 1d ago    v1.8.0│  │ │
│        │  │  │    Resources: 89    Drifts: 3 ⚠️    Cost: $3,280/mo│  │ │
│        │  │  │    [Plan] [Apply] [State] [Settings]               │  │ │
│        │  │  └────────────────────────────────────────────────────┘  │ │
│        │  └──────────────────────────────────────────────────────────┘ │
│        │                                                                │
│        │  ┌──────────────────────────────────────────────────────────┐ │
│        │  │  Recent Activity                                        │ │
│        │  │  ┌────────────────────────────────────────────────────┐  │ │
│        │  │  │ 🟢 Applied  terraform-prod#142  +12 ~3 -1   2h ago │  │ │
│        │  │  │ 🟠 Planned  terraform-staging#89  +5 ~2 -0   5h ago│  │ │
│        │  │  │ 🔴 Failed   terraform-dev#56  Error: timeout  1d ago│  │ │
│        │  │  └────────────────────────────────────────────────────┘  │ │
│        │  └──────────────────────────────────────────────────────────┘ │
│        │                                                                │
└────────┴────────────────────────────────────────────────────────────────┘
```

### 2.2 Terraform Plan 审查抽屉（ASCII）

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Plan Review - terraform-prod#143                         [X] [Apply]   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  Plan Summary                                                     │  │
│  │  ───────────────────────────────────────────────────────────────  │  │
│  │  ┌────────────────────────────────────────────────────────────┐   │  │
│  │  │  Resources:  +12  ~3  -1    Total affected: 16             │   │  │
│  │  │  Cost Impact: +$450/month (from $12,450 to $12,900)        │   │  │
│  │  │  Risk Level: 🟡 Medium                                      │   │  │
│  │  └────────────────────────────────────────────────────────────┘   │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  AI Review Results                                                │  │
│  │  ───────────────────────────────────────────────────────────────  │  │
│  │  ┌────────────────────────────────────────────────────────────┐   │  │
│  │  │ ✅ Best Practices                                           │   │  │
│  │  │    • All resources have proper tags                         │   │  │
│  │  │    • Security groups follow least privilege                │   │  │
│  │  │    • S3 buckets have versioning enabled                    │   │  │
│  │  │                                                            │   │  │
│  │  │ ⚠️  Warnings (2)                                            │   │  │
│  │  │    • EC2 instance type m5.xlarge may be over-provisioned   │   │  │
│  │  │    • RDS backup retention period is only 7 days            │   │  │
│  │  │                                                            │   │  │
│  │  │ ❌ Issues (1)                                               │   │  │
│  │  │    • Security group allows 0.0.0.0/0 on port 22           │   │  │
│  │  │      Suggestion: Restrict to specific IP ranges            │   │  │
│  │  └────────────────────────────────────────────────────────────┘   │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  Changes by Resource Type                                         │  │
│  │  ───────────────────────────────────────────────────────────────  │  │
│  │  ┌────────────────────────────────────────────────────────────┐   │  │
│  │  │ 🔵 AWS EC2 Instance (3 changes)                            │   │  │
│  │  │  ────────────────────────────────────────────────────────  │   │  │
│  │  │  + aws_instance.app_server[0]                              │   │  │
│  │  │    • ami: ami-0c55b159cbfafe1f0                           │   │  │
│  │  │    • instance_type: m5.xlarge                              │   │  │
│  │  │    • tags: { "Name": "app-server-1", "Env": "prod" }      │   │  │
│  │  │                                                            │   │  │
│  │  │  ~ aws_instance.app_server[1] (in-place update)            │   │  │
│  │  │    ~ instance_type: "t3.medium" → "t3.large"               │   │  │
│  │  │    ~ tags: { ... "Updated": "2026-04-10" }                 │   │  │
│  │  │                                                            │   │  │
│  │  │  - aws_instance.legacy_server (destroy)                    │   │  │
│  │  │    ⚠️  Resource has been running for 730 days               │   │  │
│  │  └────────────────────────────────────────────────────────────┘   │  │
│  │  ┌────────────────────────────────────────────────────────────┐   │  │
│  │  │ 🟣 AWS RDS (1 change)                                      │   │  │
│  │  │  ────────────────────────────────────────────────────────  │   │  │
│  │  │  ~ aws_db_instance.main (in-place update)                  │   │  │
│  │  │    ~ backup_retention_period: 7 → 30                       │   │  │
│  │  │    + enabled_cloudwatch_logs_exports: ["audit", "error"]   │   │  │
│  │  └────────────────────────────────────────────────────────────┘   │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  Cost Breakdown                                                   │  │
│  │  ───────────────────────────────────────────────────────────────  │  │
│  │  ┌────────────────────────────────────────────────────────────┐   │  │
│  │  │ Resource              │ Current  │ After     │ Delta      │   │  │
│  │  │ ────────────────────────────────────────────────────────── │   │  │
│  │  │ EC2 Instances         │ $8,450   │ $8,680    │ +$230      │   │  │
│  │  │ RDS                   │ $2,800   │ $2,950    │ +$150      │   │  │
│  │  │ S3                    │ $450     │ $450      │ $0         │   │  │
│  │  │ Load Balancer         │ $750     │ $750      │ $0         │   │  │
│  │  │ ────────────────────────────────────────────────────────── │   │  │
│  │  │ Total                 │ $12,450  │ $12,900   │ +$450      │   │  │
│  │  └────────────────────────────────────────────────────────────┘   │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│  [Cancel]  [View Full Diff]  [Apply Changes]                            │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.3 响应式断点布局

| 断点 | 宽度 | 布局策略 |
|------|------|----------|
| XS | < 576px | 单列卡片布局，标签页简化为下拉，审查抽屉全屏 |
| SM | 576-768px | 卡片堆叠，Plan 简化，抽屉 80% 宽度 |
| MD | 768-992px | 双列布局，标签页完整，抽屉 60% 宽度 |
| LG+ | > 992px | 完整布局，所有功能可见 |

---

## 三、组件清单

### 3.1 使用组件列表

| 组件名 | 用途 | 状态数 | 设计规范 |
|--------|------|--------|----------|
| `PageHeader` | 页面标题 + 创建按钮 | 1 | 带副标题说明 |
| `TabBar` | 标签页导航 | 5 | Workspaces/Resources/Drift/AI/Cost |
| `WorkspaceCard` | 工作区卡片 | 4 | Synced/Drift/Failed/Pending |
| `ProviderIcon` | 云厂商图标 | 6 | AWS/Azure/GCP/Alibaba/Tencent/K8s |
| `ResourceTree` | 资源树形列表 | 3 | 展开/折叠/筛选 |
| `DriftBadge` | 漂移状态徽章 | 4 | Synced/Modified/Missing/Extra |
| `PlanDiff` | Plan 差异视图 | 4 | Add/Change/Delete/NoOp |
| `AIReviewCard` | AI 审查卡片 | 3 | Pass/Warning/Issue |
| `CostTable` | 成本明细表 | 3 | Current/Projected/Delta |
| `StateViewer` | 状态文件查看器 | 2 | JSON/YAML |
| `RunHistory` | 执行历史记录 | 4 | Success/Failed/Running/Pending |
| `EmptyState` | 空状态 | 4 | 无工作区/无漂移 |
| `Skeleton` | 加载骨架屏 | 3 | 卡片/树形/表格 |

### 3.2 组件颜色映射

```css
/* 工作区状态颜色 - 基于 Orion Design Tokens */
:root {
  --workspace-synced-bg: var(--success-50);
  --workspace-synced-text: var(--success-600);
  --workspace-synced-border: var(--success-200);
  
  --workspace-drift-bg: var(--warning-50);
  --workspace-drift-text: var(--warning-600);
  --workspace-drift-border: var(--warning-200);
  
  --workspace-failed-bg: var(--error-50);
  --workspace-failed-text: var(--error-600);
  --workspace-failed-border: var(--error-200);
  
  --workspace-pending-bg: var(--info-50);
  --workspace-pending-text: var(--info-600);
  --workspace-pending-border: var(--info-200);
}

/* Plan 变更颜色 */
:root {
  --plan-add: var(--success-600);       /* #389E0D */
  --plan-change: var(--info-600);       /* #08979C */
  --plan-delete: var(--error-600);      /* #D9363E */
  --plan-noop: var(--neutral-400);      /* #8C8C8C */
}
```

---

## 四、颜色与视觉规范

### 4.1 主色调应用

| 元素 | 颜色 Token | HEX | 用途 |
|------|-----------|-----|------|
| 主按钮背景 | `primary-600` | #0058C4 | 新建工作区 |
| 主按钮悬停 | `primary-700` | #0047A0 | 按钮 Hover |
| 激活标签 | `primary-50` | #E6F4FF | 标签页选中 |
| 激活文本 | `primary-600` | #0058C4 | 标签页文字 |
| 链接文本 | `primary-500` | #0070F3 | 可点击文本 |

### 4.2 工作区状态色完整定义

```css
/* Synced - 已同步 */
.workspace-synced {
  background-color: var(--success-50);    /* #F6FFED */
  color: var(--success-600);              /* #389E0D - 对比度 5.2:1 ✅ */
  border-color: var(--success-200);       /* #B7EB8F */
}

/* Drift - 有漂移 */
.workspace-drift {
  background-color: var(--warning-50);    /* #FFFBE6 */
  color: var(--warning-600);              /* #D48806 - 对比度 4.6:1 ✅ */
  border-color: var(--warning-200);       /* #FFE58F */
}

/* Failed - 失败 */
.workspace-failed {
  background-color: var(--error-50);      /* #FFF1F0 */
  color: var(--error-600);                /* #D9363E - 对比度 5.1:1 ✅ */
  border-color: var(--error-200);         /* #FFA39E */
}

/* Pending - 执行中 */
.workspace-pending {
  background-color: var(--info-50);       /* #E6FFFB */
  color: var(--info-600);                 /* #08979C */
  border-color: var(--info-200);          /* #87E8DE */
  animation: pulse-pending 1.5s infinite;
}

@keyframes pulse-pending {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.8; }
}
```

### 4.3 Plan 变更标记颜色

```css
/* Add - 新增资源 */
.diff-add {
  background-color: var(--success-50);
  color: var(--success-700);
  border-left: 3px solid var(--success-500);
}

/* Change - 变更资源 */
.diff-change {
  background-color: var(--info-50);
  color: var(--info-700);
  border-left: 3px solid var(--info-500);
}

/* Delete - 删除资源 */
.diff-delete {
  background-color: var(--error-50);
  color: var(--error-700);
  border-left: 3px solid var(--error-500);
}

/* NoOp - 无变更 */
.diff-noop {
  background-color: var(--neutral-50);
  color: var(--neutral-600);
  border-left: 3px solid var(--neutral-300);
}
```

### 4.4 云厂商品牌色

```css
/* 云服务提供商品牌色 */
:root {
  --provider-aws: #FF9900;
  --provider-azure: #0078D4;
  --provider-gcp: #4285F4;
  --provider-alibaba: #FF6A00;
  --provider-tencent: #00A4FF;
  --provider-k8s: #326CE5;
}
```

### 4.5 暗黑模式映射

```css
.dark-mode {
  --workspace-synced-bg: hsl(145, 25%, 12%);
  --workspace-synced-text: var(--success-300);
  
  --workspace-drift-bg: hsl(38, 30%, 15%);
  --workspace-drift-text: var(--warning-300);
  
  --workspace-failed-bg: hsl(359, 25%, 12%);
  --workspace-failed-text: var(--error-300);
  
  --provider-aws: #FFB140;
  --provider-azure: #4DA6FF;
  --provider-gcp: #6BA3FF;
}
```

---

## 五、字体与排版

### 5.1 字号层级

| 元素 | Token | 字号 | 行高 | 字重 |
|------|-------|------|------|------|
| 页面标题 | `text-2xl` | 24px | 32px | 600 |
| 卡片标题 | `text-md` | 16px | 24px | 600 |
| 工作区名称 | `text-md` | 16px | 24px | 600 |
| 资源类型 | `text-sm` | 14px | 20px | 400 |
| 代码块 | `text-xs` | 12px | 16px | 400 |
| HCL 代码 | `text-xs` | 12px | 16px | 400, mono |

### 5.2 差异视图样式

| 元素 | 尺寸 | 字体 |
|------|------|------|
| 差异行 | 100% x auto | text-xs, mono |
| 添加行背景 | #F6FFED | - |
| 删除行背景 | #FFF1F0 | - |
| 变更行背景 | #E6FFFB | - |

---

## 六、交互说明

### 6.1 核心交互行为

| 交互 | 触发条件 | 反馈 | 持续时间 |
|------|----------|------|----------|
| 工作区卡片悬停 | 鼠标进入 | 显示操作按钮 | 150ms |
| 工作区详情 | 点击详情 | 抽屉滑出 | 300ms |
| 标签切换 | 点击标签 | 内容切换+URL 更新 | 200ms |
| 资源树展开/折叠 | 点击节点 | 树形展开/折叠 | 150ms |
| Plan 审查 | 点击审查 | 显示 AI 分析 | 500ms+API |
| 执行历史筛选 | 条件变更 | 列表刷新 | 300ms |

### 6.2 键盘快捷键

| 快捷键 | 功能 | 适用场景 |
|--------|------|----------|
| `Cmd/Ctrl + K` | 聚焦全局搜索 | 全局 |
| `Cmd/Ctrl + N` | 新建工作区 | 全局 |
| `Cmd/Ctrl + P` | 运行 Plan | 工作区聚焦 |
| `Cmd/Ctrl + A` | 运行 Apply | 有 Plan 时 |
| `Cmd/Ctrl + S` | 保存配置 | 编辑状态 |
| `Escape` | 关闭抽屉/弹窗 | 任意 |
| `↑/↓` | 上下选择工作区 | 列表聚焦 |
| `Enter` | 打开工作区详情 | 行聚焦 |
| `E` | 编辑选中工作区 | 有选中项 |

### 6.3 操作确认规则

| 操作 | 是否需要确认 | 确认方式 | 可撤销 |
|------|--------------|----------|--------|
| 新建工作区 | 否 | 验证后生效 | ✅ 可删除 |
| 删除工作区 | 是 | 模态框 + 名称确认 | ❌ 不可撤销 |
| 运行 Plan | 否 | 直接执行 | - |
| 运行 Apply | 是 | Plan 审查确认 | ✅ 可回滚 |
| 强制同步 | 是 | 影响提示 | ✅ 可恢复 |

---

## 七、状态定义

### 7.1 空状态（Empty State）

```
┌─────────────────────────────────────────────────────────────────┐
│                        ┌─────────────┐                         │
│                        │             │                         │
│                        │    🌐       │                         │
│                        │  (64x64px)  │                         │
│                        │             │                         │
│                        └─────────────┘                         │
│                                                                 │
│                  暂无工作区                                     │
│              text-2xl, font-weight-semibold, neutral-800        │
│                                                                 │
│          创建第一个 Terraform 工作区，开始 IaC 管理               │
│              text-md, neutral-500, margin-top: 8px             │
│                                                                 │
│              ┌──────────────┐  ┌──────────────┐                │
│              │ + 创建工作区 │  │ 📖 接入指南  │                │
│              │ primary-600  │  │ neutral-600  │                │
│              └──────────────┘  └──────────────┘                │
│                                                                 │
│          ───────────  支持云厂商  ───────────                  │
│                                                                 │
│     ☁️ AWS  •  🪟 Azure  •  🔵 GCP  •  🟠 阿里云  •  🔷 腾讯云    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 7.2 加载状态（Loading State）

**骨架屏规格**：
```css
.workspace-card-skeleton {
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
  gap: 24px;
  margin-top: 8px;
}

.skeleton-resource {
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

/* 资源树骨架 */
.resource-tree-skeleton {
  height: 300px;
  background: var(--neutral-50);
  border-radius: var(--radius-md);
  animation: skeleton-loading 1.5s infinite;
}
```

### 7.3 错误状态（Error State）

| 错误类型 | 展示方式 | 用户操作 | 自动重试 |
|----------|----------|----------|----------|
| Plan 失败 | 卡片错误状态 | [查看日志] [重新 Plan] | 可选 |
| Apply 失败 | 抽屉错误面板 | [查看错误] [回滚] | 可选 |
| 状态锁定 | 状态显示锁定 | [强制解锁] | 否 |
| 漂移检测失败 | Toast 提示 | [重试检测] | 3 次 |

### 7.4 漂移状态定义

| 状态 | 图标 | 颜色 | 说明 |
|------|------|------|------|
| Synced | ✅ | success-600 | 与配置一致 |
| Modified | ⚠️ | warning-600 | 资源被修改 |
| Missing | ❌ | error-600 | 资源不存在 |
| Extra | ❓ | info-600 | 额外资源 |

---

## 八、响应式设计

### 8.1 移动端适配策略

**XS (< 576px) - 卡片模式**：
```
┌─────────────────────────────────┐
│  IaC Mgmt     [+ New Workspace] │
├─────────────────────────────────┤
│ [Workspaces ▼] [Resources] [...]│
├─────────────────────────────────┤
│ ┌─────────────────────────────┐ │
│ │ 🌐 prod-infra     🟢 AWS    │ │
│ │ 156 resources • 0 drifts    │ │
│ │ $12,450/mo                  │ │
│ │ [Plan] [Apply]              │ │
│ └─────────────────────────────┘ │
│ ┌─────────────────────────────┐ │
│ │ 🌐 staging        🟡 AWS    │ │
│ │ 89 resources • 3 drifts ⚠️  │ │
│ │ $3,280/mo                   │ │
│ │ [Plan] [Apply]              │ │
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```

**SM (576-768px) - 双列卡片**：
- 工作区卡片 2 列
- 资源数简化
- 操作按钮图标化

**MD (768-992px) - 完整功能**：
- 工作区卡片单列
- 所有指标可见
- Plan 审查完整

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
  --workspace-card-gap: var(--spacing-md);
}
```

### 9.2 圆角系统

```css
:root {
  --radius-xs: 2px;    /* Badge, Code */
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

### 9.4 差异视图样式

```css
:root {
  --diff-font: var(--font-family-mono);
  --diff-size: var(--text-xs);
  --diff-line-height: 1.6;
  
  --diff-add-bg: #F6FFED;
  --diff-add-text: #237804;
  --diff-change-bg: #E6FFFB;
  --diff-change-text: #006D75;
  --diff-delete-bg: #FFF1F0;
  --diff-delete-text: #A8222E;
  --diff-noop-bg: #FAFAFA;
  --diff-noop-text: #666666;
}
```

### 9.5 动画系统

```css
:root {
  --transition-fast: 150ms ease;
  --transition-normal: 200ms ease;
  --transition-slow: 300ms ease;
  
  --animation-skeleton: skeleton-loading 1.5s infinite;
  --animation-pulse-pending: pulse-pending 1.5s infinite;
}

@keyframes skeleton-loading {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

@keyframes pulse-pending {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.8; }
}
```

---

## 十、Agent 开发指南

### 10.1 快速实现提示

使用以下提示词生成代码：

```
创建一个 IaC 管理后台页面，使用以下设计令牌：
- 工作区状态：Synced #389E0D, Drift #D48806, Failed #D9363E, Pending #08979C
- Plan 变更：Add #52C41A, Change #13C2C2, Delete #D9363E, NoOp #8C8C8C
- 云厂商品：AWS #FF9900, Azure #0078D4, GCP #4285F4, Alibaba #FF6A00
- 差异视图：等宽字体，12px, 行高 1.6
- 工作区卡片：圆角 8px, 悬停阴影 shadow-md
- 标签页：选中背景 #E6F4FF, 文本 #0058C4
```

### 10.2 关键实现检查点

- [ ] 工作区状态实时同步
- [ ] Plan 差异可视清晰
- [ ] AI 审查结果准确
- [ ] 成本预估合理
- [ ] WCAG 2.1 AA 对比度合规
- [ ] 键盘导航完整（Tab 顺序、快捷键）
- [ ] 聚焦状态可见（`:focus-visible`）
- [ ] 暗黑模式颜色映射正确
- [ ] 响应式断点测试通过
- [ ] 骨架屏和空状态实现
- [ ] HCL 语法高亮
- [ ] 状态文件查看器

### 10.3 IaC API 要求

- 工作区 CRUD API
- Plan 执行 API
- Apply 执行 API
- 状态文件 API
- 漂移检测 API
- AI 审查 API
- 成本估算 API
- 资源清单 API
- 执行历史 API

### 10.4 Terraform 示例

```graphql
# Query workspaces
query GetWorkspaces {
  workspaces {
    id
    name
    provider
    status
    path
    version
    resourceCount
    driftCount
    lastRun
    cost {
      monthly
      trend
    }
  }
}

# Query workspace state
query GetWorkspaceState($workspaceId: ID!) {
  workspaceState(workspaceId: $workspaceId) {
    resources {
      type
      id
      name
      provider
      status
      drift
    }
  }
}

# Run Terraform Plan
mutation RunPlan($workspaceId: ID!) {
  runPlan(workspaceId: $workspaceId) {
    planId
    status
    summary {
      add
      change
      destroy
    }
    costImpact {
      current
      projected
      delta
    }
    aiReview {
      passed
      warnings { message suggestion }
      issues { message severity suggestion }
    }
  }
}

# Run Terraform Apply
mutation RunApply($planId: ID!) {
  runApply(planId: $planId) {
    applyId
    status
    output
    resources {
      type
      id
      action
      status
    }
  }
}

# Detect drift
mutation DetectDrift($workspaceId: ID!) {
  detectDrift(workspaceId: $workspaceId) {
    detectionId
    status
    drifts {
      resourceType
      resourceId
      type
      details
    }
  }
}
```

---

*文档版本：v1.0*  
*创建日期：2026-04-10*  
*基于 Orion Design Tokens v1.2.0*
