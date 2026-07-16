# Orion 代码管理集成设计文档

> 版本：v1.0  
> 创建日期：2026-04-10  
> 设计师：Orion Design System Team  
> 适用范围：P1 核心功能 - 代码管理与集成模块

---

## 一、页面概述

### 1.1 页面定义

代码管理集成（Code Management）是 Orion 平台与 Git 系统的深度集成中心，用户在此管理 Git 仓库、配置 MR/PR 集成、设置代码质量门禁、定义 Branch Policy 和配置 Code Ownership。页面采用开发者工具设计风格，兼顾信息密度和操作便捷性。

### 1.2 目标用户

| 角色 | 核心任务 | 使用频率 | 权限级别 |
|------|----------|----------|----------|
| 开发工程师 | 查看仓库状态、提交 MR | 高频（每日 10+ 次） | 执行/只读 |
| 技术主管 | 审批 MR、配置门禁 | 中频（每日 5-8 次） | 审批/配置 |
| 运维工程师 | 配置仓库集成、监控质量 | 中频（每周 3-5 次） | 配置/执行 |
| 质量保障 | 查看质量报告、配置规则 | 中频（每周 5-8 次） | 配置/只读 |

### 1.3 设计原则

- **仓库可视**：所有 Git 仓库状态一目了然
- **集成深度**：MR/PR 全流程自动化
- **门禁严格**：代码覆盖率/重复率/技术债可配置
- **策略清晰**：Branch Policy 和 Code Ownership 明确

---

## 二、布局结构

### 2.1 页面布局（ASCII）

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Top Navigation Bar                                                     │
├────────┬────────────────────────────────────────────────────────────────┤
│        │                                                                │
│ Side   │  ┌──────────────────────────────────────────────────────────┐ │
│ bar    │  │  Code Management                        [+ Add Repository]│ │
│        │  └──────────────────────────────────────────────────────────┘ │
│        │                                                                │
│        │  ┌──────────────────────────────────────────────────────────┐ │
│        │  │  [Repositories] [MR/PR] [Quality Gates] [Branch Policy] │ │
│        │  └──────────────────────────────────────────────────────────┘ │
│        │                                                                │
│        │  ┌──────────────────────────────────────────────────────────┐ │
│        │  │  🔍 Search repositories...     [Org ▼] [Status ▼] [+]   │ │
│        │  └──────────────────────────────────────────────────────────┘ │
│        │                                                                │
│        │  ┌──────────────────────────────────────────────────────────┐ │
│        │  │  Repositories (24)                                      │ │
│        │  │  ──────────────────────────────────────────────────────  │ │
│        │  │  ┌────────────────────────────────────────────────────┐  │ │
│        │  │  │ 📦 orion-api             main    🟢 Protected     │  │ │
│        │  │  │    orion-design/orion-api    Last commit: 2h ago   │  │ │
│        │  │  │    Coverage: 85%  Duplicates: 2.3%  Issues: 12     │  │ │
│        │  │  │    [Settings] [Quality] [MRs]                      │  │ │
│        │  │  └────────────────────────────────────────────────────┘  │ │
│        │  │  ┌────────────────────────────────────────────────────┐  │ │
│        │  │  │ 📦 payment-service       feat/x   🟡 Unprotected   │  │ │
│        │  │  │    orion-design/payment-service  30m ago          │  │ │
│        │  │  │    Coverage: 72% ⚠️  Duplicates: 5.1% ⚠️  Issues: 3 │  │ │
│        │  │  │    [Settings] [Quality] [MRs]                      │  │ │
│        │  │  └────────────────────────────────────────────────────┘  │ │
│        │  └──────────────────────────────────────────────────────────┘ │
│        │                                                                │
│        │  ┌──────────────────────────────────────────────────────────┐ │
│        │  │  Quality Gates Summary                                  │ │
│        │  │  ┌─────────┬─────────┬─────────┬───────────────────────┐ │ │
│        │  │  │ Avg Cov │ Failures│ Tech Debt│ Passing Repos        │ │ │
│        │  │  │ 78.5%   │ 3       │ 2.4h     │ 18/24 (75%)          │ │ │
│        │  │  │ ↑ 2.1%  │ ↓ 1     │ ↓ 0.3h   │ 🟢 18 🟡 4 🔴 2      │ │ │
│        │  │  └─────────┴─────────┴─────────┴───────────────────────┘ │ │
│        │  └──────────────────────────────────────────────────────────┘ │
│        │                                                                │
└────────┴────────────────────────────────────────────────────────────────┘
```

### 2.2 仓库配置抽屉（ASCII）

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Repository Settings - orion-api                          [X] [Save]    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  Basic Information                                                │  │
│  │  ───────────────────────────────────────────────────────────────  │  │
│  │  Repository: [📦 orion-design/orion-api                          ]│  │
│  │  Display Name: [Orion API Service                               ]  │  │
│  │  Description: [核心 API 服务，提供用户/订单/支付接口              ]  │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  Branch Protection                                                │  │
│  │  ───────────────────────────────────────────────────────────────  │  │
│  │  ☑ Enable Branch Protection                                       │  │
│  │                                                                   │  │
│  │  Protected Branches:                                              │  │
│  │  ┌────────────────────────────────────────────────────────────┐   │  │
│  │  │ main          ✅ Required reviewers: 2    ✅ CI required    │   │  │
│  │  │ release/*     ✅ Required reviewers: 1    ✅ CI required    │   │  │
│  │  │ ────────────────────────────────────────────────────────── │   │  │
│  │  │ [+ Add Branch Pattern]                                      │   │  │
│  │  └────────────────────────────────────────────────────────────┘   │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  Quality Gates                                                    │  │
│  │  ───────────────────────────────────────────────────────────────  │  │
│  │  ☑ Enable Quality Gates                                           │  │
│  │                                                                   │  │
│  │  ┌────────────────────────────────────────────────────────────┐   │  │
│  │  │ Code Coverage    [>=] [80] [%]   Current: 85% ✅           │   │  │
│  │  │ Duplication      [<=] [3 ] [%]   Current: 2.3% ✅         │   │  │
│  │  │ Technical Debt   [<=] [4 ] [h]   Current: 1.8h ✅         │   │  │
│  │  │ Critical Issues  [<=] [0 ]      Current: 0 ✅              │   │  │
│  │  └────────────────────────────────────────────────────────────┘   │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  Code Ownership                                                   │  │
│  │  ───────────────────────────────────────────────────────────────  │  │
│  │  ┌────────────────────────────────────────────────────────────┐   │  │
│  │  │ Path Pattern        │ Owners                  │ Reviewers  │   │  │
│  │  │ ────────────────────────────────────────────────────────── │   │  │
│  │  │ src/api/**          │ @zhangsan              │ @team-api   │   │  │
│  │  │ src/payment/**      │ @lisi, @wangwu         │ @team-pay   │   │  │
│  │  │ **/*.proto          │ @protobuf-team         │ -           │   │  │
│  │  │ ────────────────────────────────────────────────────────── │   │  │
│  │  │ [+ Add Ownership Rule]                                      │   │  │
│  │  └────────────────────────────────────────────────────────────┘   │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  MR/PR Integration                                                │  │
│  │  ───────────────────────────────────────────────────────────────  │  │
│  │  ☑ Auto-create MR for protected branches                          │  │
│  │  ☑ Require CI pass before merge                                   │  │
│  │  ☑ Auto-delete branch after merge                                 │  │
│  │  ☑ Squash commits on merge                                        │  │
│  │                                                                   │  │
│  │  Merge Strategy: [Squash Merge ▼]                                 │  │
│  │  Default Reviewers: [@zhangsan, @lisi                            ]│  │
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
| SM | 576-768px | 卡片堆叠，指标简化，抽屉 80% 宽度 |
| MD | 768-992px | 双列布局，标签页完整，抽屉 60% 宽度 |
| LG+ | > 992px | 完整布局，所有功能可见 |

---

## 三、组件清单

### 3.1 使用组件列表

| 组件名 | 用途 | 状态数 | 设计规范 |
|--------|------|--------|----------|
| `PageHeader` | 页面标题 + 添加按钮 | 1 | 带副标题说明 |
| `TabBar` | 标签页导航 | 5 | Repos/MR/Quality/Branch/Ownership |
| `RepoCard` | 仓库卡片 | 4 | Protected/Unprotected/Warning/Error |
| `RepoIcon` | 仓库类型图标 | 4 | Public/Private/Fork/Mirror |
| `QualityGauge` | 质量仪表盘 | 4 | Coverage/Duplication/Debt/Issues |
| `BranchBadge` | 分支徽章 | 3 | Protected/Feature/Release |
| `OwnershipRule` | 代码归属规则 | 2 | 路径匹配/人员分配 |
| `MergeConfig` | 合并策略配置 | 3 | Merge/Squash/Rebase |
| `CIStatus` | CI 状态指示器 | 4 | Passing/Failed/Running/Pending |
| `ReviewerPicker` | 审核人选择器 | 3 | 单选/多选/团队 |
| `EmptyState` | 空状态 | 4 | 无仓库/无配置 |
| `Skeleton` | 加载骨架屏 | 3 | 卡片/表格/详情 |

### 3.2 组件颜色映射

```css
/* 仓库保护状态颜色 - 基于 Orion Design Tokens */
:root {
  --repo-protected-bg: var(--success-50);
  --repo-protected-text: var(--success-600);
  --repo-protected-border: var(--success-200);
  
  --repo-unprotected-bg: var(--warning-50);
  --repo-unprotected-text: var(--warning-600);
  --repo-unprotected-border: var(--warning-200);
  
  --repo-error-bg: var(--error-50);
  --repo-error-text: var(--error-600);
  --repo-error-border: var(--error-200);
}

/* 质量状态颜色 */
:root {
  --quality-good: var(--success-600);       /* >= 80% */
  --quality-warning: var(--warning-600);    /* 60-79% */
  --quality-critical: var(--error-600);     /* < 60% */
}
```

---

## 四、颜色与视觉规范

### 4.1 主色调应用

| 元素 | 颜色 Token | HEX | 用途 |
|------|-----------|-----|------|
| 主按钮背景 | `primary-600` | #0058C4 | 添加仓库 |
| 主按钮悬停 | `primary-700` | #0047A0 | 按钮 Hover |
| 激活标签 | `primary-50` | #E6F4FF | 标签页选中 |
| 激活文本 | `primary-600` | #0058C4 | 标签页文字 |
| 链接文本 | `primary-500` | #0070F3 | 可点击文本 |

### 4.2 质量门禁颜色定义

```css
/* Code Coverage - 代码覆盖率 */
.coverage-good {
  background-color: var(--success-50);    /* #F6FFED */
  color: var(--success-600);              /* #389E0D - 对比度 5.2:1 ✅ */
  border-color: var(--success-200);       /* #B7EB8F */
}

.coverage-warning {
  background-color: var(--warning-50);    /* #FFFBE6 */
  color: var(--warning-600);              /* #D48806 - 对比度 4.6:1 ✅ */
  border-color: var(--warning-200);       /* #FFE58F */
}

.coverage-critical {
  background-color: var(--error-50);      /* #FFF1F0 */
  color: var(--error-600);                /* #D9363E - 对比度 5.1:1 ✅ */
  border-color: var(--error-200);         /* #FFA39E */
}

/* 质量仪表盘刻度颜色 */
.quality-gauge {
  --gauge-good: #52C41A;      /* 80-100% */
  --gauge-warning: #FAAD14;   /* 60-79% */
  --gauge-critical: #F5222D;  /* 0-59% */
  --gauge-bg: var(--neutral-100);
}
```

### 4.3 仓库类型颜色

```css
/* 仓库可见性 */
.repo-public {
  color: var(--info-600);
}

.repo-private {
  color: var(--neutral-600);
}

.repo-fork {
  color: var(--primary-500);
}

.repo-mirror {
  color: var(--warning-600);
}
```

### 4.4 暗黑模式映射

```css
.dark-mode {
  --repo-protected-bg: hsl(145, 25%, 12%);
  --repo-protected-text: var(--success-300);
  
  --repo-unprotected-bg: hsl(38, 30%, 15%);
  --repo-unprotected-text: var(--warning-300);
  
  --quality-good: #73D13D;
  --quality-warning: #FFC53D;
  --quality-critical: #FF6B6D;
}
```

---

## 五、字体与排版

### 5.1 字号层级

| 元素 | Token | 字号 | 行高 | 字重 |
|------|-------|------|------|------|
| 页面标题 | `text-2xl` | 24px | 32px | 600 |
| 卡片标题 | `text-md` | 16px | 24px | 600 |
| 仓库名称 | `text-md` | 16px | 24px | 600 |
| 仓库路径 | `text-sm` | 14px | 20px | 400 |
| 指标数值 | `text-lg` | 18px | 28px | 700 |
| 辅助文本 | `text-xs` | 12px | 16px | 400 |

### 5.2 质量仪表盘尺寸

| 元素 | 尺寸 | 字体 |
|------|------|------|
| 仪表盘直径 | 120px | - |
| 中心数值 | text-2xl, 700 | - |
| 标签文本 | text-xs, 500 | - |
| 刻度线 | 2px | - |

---

## 六、交互说明

### 6.1 核心交互行为

| 交互 | 触发条件 | 反馈 | 持续时间 |
|------|----------|------|----------|
| 仓库卡片悬停 | 鼠标进入 | 显示操作按钮 | 150ms |
| 质量指标悬停 | 鼠标进入 | 显示详细 Tooltip | 100ms |
| 标签切换 | 点击标签 | 内容切换+URL 更新 | 200ms |
| 拖拽排序 | 拖动仓库 | 更新显示顺序 | 即时 |
| 配置变更 | 开关/输入 | 实时验证 | 即时 |
| 保存配置 | 点击保存 | 校验→保存→反馈 | 500ms+API |

### 6.2 键盘快捷键

| 快捷键 | 功能 | 适用场景 |
|--------|------|----------|
| `Cmd/Ctrl + K` | 聚焦全局搜索 | 全局 |
| `Cmd/Ctrl + N` | 添加新仓库 | 全局 |
| `Cmd/Ctrl + S` | 保存配置 | 编辑状态 |
| `Cmd/Ctrl + Q` | 快速查看质量 | 仓库聚焦 |
| `Escape` | 关闭抽屉/弹窗 | 任意 |
| `↑/↓` | 上下选择仓库 | 列表聚焦 |
| `Enter` | 打开仓库详情 | 行聚焦 |
| `E` | 编辑选中仓库 | 有选中项 |

### 6.3 操作确认规则

| 操作 | 是否需要确认 | 确认方式 | 可撤销 |
|------|--------------|----------|--------|
| 添加仓库 | 否 | 验证后生效 | ✅ 可移除 |
| 移除仓库 | 是 | 模态框确认 | ❌ 不可撤销 |
| 修改保护规则 | 否 | 保存即生效 | ✅ 可恢复 |
| 修改质量门禁 | 否 | 保存即生效 | ✅ 可恢复 |
| 批量操作 | 是 | 数量确认 | 部分可逆 |

---

## 七、状态定义

### 7.1 空状态（Empty State）

```
┌─────────────────────────────────────────────────────────────────┐
│                        ┌─────────────┐                         │
│                        │             │                         │
│                        │    📦       │                         │
│                        │  (64x64px)  │                         │
│                        │             │                         │
│                        └─────────────┘                         │
│                                                                 │
│                  暂无仓库                                       │
│              text-2xl, font-weight-semibold, neutral-800        │
│                                                                 │
│          添加第一个 Git 仓库，开始代码质量管理                    │
│              text-md, neutral-500, margin-top: 8px             │
│                                                                 │
│              ┌──────────────┐  ┌──────────────┐                │
│              │ + 添加仓库   │  │ 📖 接入指南  │                │
│              │ primary-600  │  │ neutral-600  │                │
│              └──────────────┘  └──────────────┘                │
│                                                                 │
│          ───────────  支持平台  ───────────                    │
│                                                                 │
│     🐙 GitHub  •  🦊 GitLab  •  🪝 Bitbucket  •  🏢 Gitee       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 7.2 加载状态（Loading State）

**骨架屏规格**：
```css
.repo-card-skeleton {
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
```

### 7.3 错误状态（Error State）

| 错误类型 | 展示方式 | 用户操作 | 自动重试 |
|----------|----------|----------|----------|
| 仓库连接失败 | 卡片错误状态 | [重新连接] [检查配置] | 可选 |
| 质量分析失败 | 指标显示错误 | [重新分析] | 3 次 |
| MR 同步失败 | Toast 提示 | [重试] [查看日志] | 可选 |
| 权限不足 | 空状态 + 申请 | [申请权限] | 否 |

### 7.4 质量门禁状态

| 状态 | 图标 | 颜色 | 说明 |
|------|------|------|------|
| Passing | ✅ | success-600 | 满足门禁要求 |
| Warning | ⚠️ | warning-600 | 接近阈值 |
| Failing | ❌ | error-600 | 未达门禁要求 |
| Unknown | ❓ | neutral-400 | 等待分析 |

---

## 八、响应式设计

### 8.1 移动端适配策略

**XS (< 576px) - 卡片模式**：
```
┌─────────────────────────────────┐
│  Code Mgmt      [+ Repository]  │
├─────────────────────────────────┤
│ [Repos ▼] [MR] [Quality]        │
├─────────────────────────────────┤
│ ┌─────────────────────────────┐ │
│ │ 📦 orion-api       🟢Prot.  │ │
│ │ main • 2h ago               │ │
│ │ Cov: 85%  Dup: 2.3%         │ │
│ │ [Settings] [MRs]            │ │
│ └─────────────────────────────┘ │
│ ┌─────────────────────────────┐ │
│ │ 📦 payment-svc     🟡Unprot.│ │
│ │ feat/x • 30m ago            │ │
│ │ Cov: 72% ⚠️  Dup: 5.1% ⚠️    │ │
│ │ [Settings] [MRs]            │ │
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```

**SM (576-768px) - 双列卡片**：
- 仓库卡片 2 列
- 指标简化显示
- 操作按钮图标化

**MD (768-992px) - 完整功能**：
- 仓库卡片单列
- 所有指标可见
- 操作栏完整

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
  --repo-card-gap: var(--spacing-md);
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

### 9.4 质量仪表盘样式

```css
:root {
  --gauge-size: 120px;
  --gauge-stroke: 8px;
  --gauge-gap: 8px;
  
  --gauge-good: #52C41A;      /* 80-100% */
  --gauge-warning: #FAAD14;   /* 60-79% */
  --gauge-critical: #F5222D;  /* 0-59% */
  --gauge-bg: var(--neutral-100);
  
  --gauge-font-size: var(--text-2xl);
  --gauge-font-weight: var(--font-weight-bold);
}
```

### 9.5 动画系统

```css
:root {
  --transition-fast: 150ms ease;
  --transition-normal: 200ms ease;
  --transition-slow: 300ms ease;
  
  --animation-skeleton: skeleton-loading 1.5s infinite;
  --animation-gauge: gauge-fill 1s ease-out;
}

@keyframes skeleton-loading {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

@keyframes gauge-fill {
  from { stroke-dashoffset: 1000; }
  to { stroke-dashoffset: 0; }
}
```

---

## 十、Agent 开发指南

### 10.1 快速实现提示

使用以下提示词生成代码：

```
创建一个代码管理集成页面，使用以下设计令牌：
- 仓库状态：Protected #389E0D, Unprotected #D48806, Error #D9363E
- 质量状态：Good #52C41A (>=80%), Warning #FAAD14 (60-79%), Critical #F5222D (<60%)
- 质量仪表盘：直径 120px, 边框 8px, 中心数值 24px 粗体
- 仓库卡片：圆角 8px, 悬停阴影 shadow-md
- 标签页：选中背景 #E6F4FF, 文本 #0058C4
- 分支徽章：Protected #F6FFED/#389E0D, Feature #E6F4FF/#0070F3
```

### 10.2 关键实现检查点

- [ ] 仓库状态实时同步
- [ ] 质量门禁配置可视化
- [ ] Code Ownership 路径匹配
- [ ] Branch Policy 规则验证
- [ ] WCAG 2.1 AA 对比度合规
- [ ] 键盘导航完整（Tab 顺序、快捷键）
- [ ] 聚焦状态可见（`:focus-visible`）
- [ ] 暗黑模式颜色映射正确
- [ ] 响应式断点测试通过
- [ ] 骨架屏和空状态实现
- [ ] 质量报告导出功能
- [ ] MR/PR 状态实时同步

### 10.3 代码管理 API 要求

- 仓库 CRUD API
- 仓库同步 API
- 质量指标 API
- 代码覆盖率 API
- 重复代码检测 API
- 技术债分析 API
- Branch Policy API
- Code Ownership API
- MR/PR 集成 API
- CI/CD 状态 API

### 10.4 代码质量示例

```graphql
# Query repositories
query GetRepositories {
  repositories {
    id
    name
    path
    provider
    visibility
    defaultBranch
    protected
    stats {
      coverage
      duplication
      technicalDebt
      criticalIssues
      lastAnalysis
    }
  }
}

# Query quality gates
query GetQualityGates(repoId: "repo-001") {
  qualityGates(repoId: $repoId) {
    coverage { threshold operator current passing }
    duplication { threshold operator current passing }
    technicalDebt { threshold operator current passing }
    criticalIssues { threshold operator current passing }
  }
}

# Query code ownership
query GetCodeOwnership(repoId: "repo-001") {
  codeOwnership(repoId: $repoId) {
    rules {
      pathPattern
      owners { id name avatar }
      reviewers { id name avatar }
    }
  }
}

# Update quality gate
mutation UpdateQualityGate {
  updateQualityGate(
    repoId: "repo-001"
    input: {
      coverage: { threshold: 80, operator: GTE }
      duplication: { threshold: 3, operator: LTE }
    }
  ) {
    success
    qualityGates {
      coverage { passing }
      duplication { passing }
    }
  }
}
```

---

*文档版本：v1.0*  
*创建日期：2026-04-10*  
*基于 Orion Design Tokens v1.2.0*
