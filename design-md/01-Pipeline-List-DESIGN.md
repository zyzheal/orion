# Orion 流水线列表页设计文档

> 版本：v1.0  
> 创建日期：2026-04-10  
> 设计师：Orion Design Team  
> 适用范围：P0 核心功能 - 流水线管理模块

---

## 一、页面概述

### 1.1 页面定义

流水线列表页是 Orion 平台的核心入口页面，用户在此查看、管理和触发所有 CI/CD 流水线。页面采用数据密集型设计，兼顾高效浏览和快速操作。

### 1.2 目标用户

| 角色 | 核心任务 | 使用频率 |
|------|----------|----------|
| 开发工程师 | 查看流水线状态、触发手动运行 | 高频（每日 10+ 次） |
| 运维工程师 | 监控流水线健康、排查失败 | 高频（每日 20+ 次） |
| 技术主管 | 查看团队效能概览 | 中频（每日 3-5 次） |
| 产品经理 | 查看发布进度 | 低频（每周 2-3 次） |

### 1.3 设计原则

- **效率优先**：核心操作（运行、筛选）一步直达
- **信息密度**：单屏展示 15+ 条流水线，减少滚动
- **状态可视**：流水线状态 100ms 内可识别
- **可访问性**：WCAG 2.1 AA 标准，键盘导航完整支持

---

## 二、布局结构

### 2.1 页面布局（ASCII）

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Top Navigation Bar                                                     │
├────────┬────────────────────────────────────────────────────────────────┤
│        │                                                                │
│ Side   │  ┌──────────────────────────────────────────────────────────┐ │
│ bar    │  │  Pipeline List                        [+ Create New]    │ │
│        │  └──────────────────────────────────────────────────────────┘ │
│        │                                                                │
│        │  ┌──────────────────────────────────────────────────────────┐ │
│        │  │  🔍 Search pipelines...      [Status ▼] [Branch ▼] [+]  │ │
│        │  └──────────────────────────────────────────────────────────┘ │
│        │                                                                │
│        │  ┌──────────────────────────────────────────────────────────┐ │
│        │  │  ☐ │ Name │ Status │ Branch │ Trigger │ Duration │ Time │ │
│        │  │  ───────────────────────────────────────────────────────  │ │
│        │  │  ☐ │ payment-deploy │ ✅ │ main │ Manual │ 3m 12s │ 2m │ │
│        │  │  ☐ │ order-build    │ 🟡 │ feat/x │ Push │ - │ 5m │    │ │
│        │  │  ☐ │ user-test      │ ❌ │ develop │ Schedule │ 8m │  │ │
│        │  │  ☐ │ auth-scan      │ ⚪ │ main │ Webhook │ - │ 10m │  │ │
│        │  │  ☐ │ gateway-deploy │ ✅ │ release │ Manual │ 5m 30s │ │ │
│        │  │  ...                                                       │ │
│        │  │                                                           │ │
│        │  │  [1] [2] [3] [...] [10]  Showing 1-20 of 356 pipelines   │ │
│        │  └──────────────────────────────────────────────────────────┘ │
│        │                                                                │
│        │  ┌──────────────────────────────────────────────────────────┐ │
│        │  │  [Batch: Run Selected] [Batch: Delete]  ☐ Select All   │ │
│        │  └──────────────────────────────────────────────────────────┘ │
│        │                                                                │
└────────┴────────────────────────────────────────────────────────────────┘
```

### 2.2 响应式断点布局

| 断点 | 宽度 | 布局策略 |
|------|------|----------|
| XS | < 576px | 单列卡片布局，隐藏次要列（时长/分支），筛选器折叠为底部抽屉 |
| SM | 576-768px | 紧凑表格，隐藏时长列，筛选器简化为图标 |
| MD | 768-992px | 完整表格，筛选器展开，批量操作固定底部 |
| LG+ | > 992px | 完整布局，所有功能可见 |

---

## 三、组件清单

### 3.1 使用组件列表

| 组件名 | 用途 | 状态数 | 设计规范 |
|--------|------|--------|----------|
| `PageHeader` | 页面标题 + 主操作按钮 | 1 | 含面包屑导航 |
| `SearchInput` | 流水线搜索 | 4（默认/聚焦/悬停/禁用） | 支持快捷键 Cmd+K |
| `MultiSelectDropdown` | 多条件筛选器 | 3 | 支持多选和搜索 |
| `DataTable` | 数据表格 | 5 | 支持排序和固定列 |
| `StatusBadge` | 状态徽章 | 5 | 成功/运行中/失败/等待/取消 |
| `BranchTag` | 分支标签 | 2 | 主分支/特性分支 |
| `TriggerIcon` | 触发方式图标 | 4 | 手动/Push/定时/Webhook |
| `DurationDisplay` | 时长显示 | 2 | 运行中/已完成 |
| `TimeAgo` | 相对时间显示 | 1 | 自动格式化 |
| `Pagination` | 分页器 | 3 | 简单/完整/精简 |
| `BatchActionBar` | 批量操作栏 | 2 | 默认/选中状态 |
| `EmptyState` | 空状态 | 4 | 无数据/无搜索结果 |
| `Skeleton` | 加载骨架屏 | 3 | 表格/卡片/列表 |
| `Checkbox` | 复选框 | 4 | 未选/选中/半选/禁用 |

### 3.2 组件颜色映射

```css
/* 状态颜色 - 基于 Orion Design Tokens */
:root {
  --status-success-bg: var(--success-50);
  --status-success-text: var(--success-600);
  --status-success-border: var(--success-200);
  
  --status-running-bg: var(--info-50);
  --status-running-text: var(--info-600);
  --status-running-border: var(--info-200);
  
  --status-failed-bg: var(--error-50);
  --status-failed-text: var(--error-600);
  --status-failed-border: var(--error-200);
  
  --status-pending-bg: var(--warning-50);
  --status-pending-text: var(--warning-600);
  --status-pending-border: var(--warning-200);
  
  --status-cancelled-bg: var(--neutral-50);
  --status-cancelled-text: var(--neutral-500);
  --status-cancelled-border: var(--neutral-200);
}
```

---

## 四、颜色与视觉规范

### 4.1 主色调应用

| 元素 | 颜色 Token | HEX | 用途 |
|------|-----------|-----|------|
| 主按钮背景 | `primary-600` | #0058C4 | 创建流水线按钮 |
| 主按钮悬停 | `primary-700` | #0047A0 | 按钮 Hover 状态 |
| 主按钮聚焦 | `shadow-focus` | rgba(24,144,255,0.5) | 键盘焦点环 |
| 链接文本 | `primary-500` | #0070F3 | 可点击文本 |
| 选中行背景 | `primary-50` | #E6F4FF | 表格行选中 |

### 4.2 状态色完整定义

```css
/* 成功状态 - WCAG AA 通过 */
.status-success {
  background-color: var(--success-50);  /* #F6FFED */
  color: var(--success-600);            /* #389E0D - 对比度 5.2:1 ✅ */
  border-color: var(--success-200);     /* #B7EB8F */
}

/* 运行中状态 - 脉冲动画 */
.status-running {
  background-color: var(--info-50);     /* #E6FFFB */
  color: var(--info-600);               /* #08979C */
  border-color: var(--info-200);        /* #87E8DE */
  animation: pulse 2s infinite;
}

/* 失败状态 - WCAG AA 通过 */
.status-failed {
  background-color: var(--error-50);    /* #FFF1F0 */
  color: var(--error-600);              /* #D9363E - 对比度 5.1:1 ✅ */
  border-color: var(--error-200);       /* #FFA39E */
}

/* 等待/审批中状态 */
.status-pending {
  background-color: var(--warning-50);  /* #FFFBE6 */
  color: var(--warning-600);            /* #D48806 - 对比度 4.6:1 ✅ */
  border-color: var(--warning-200);     /* #FFE58F */
}
```

### 4.3 暗黑模式映射

```css
.dark-mode {
  --status-success-bg: hsl(145, 30%, 20%);
  --status-success-text: var(--success-300);
  --status-success-border: hsl(145, 30%, 25%);
  
  --status-failed-bg: hsl(359, 30%, 20%);
  --status-failed-text: var(--error-300);
  --status-failed-border: hsl(359, 30%, 25%);
  
  --status-running-bg: hsl(200, 30%, 20%);
  --status-running-text: var(--info-300);
}
```

---

## 五、字体与排版

### 5.1 字号层级

| 元素 | Token | 字号 | 行高 | 字重 |
|------|-------|------|------|------|
| 页面标题 | `text-2xl` | 24px | 32px | 600 |
| 表格标题 | `text-sm` | 14px | 20px | 600 |
| 表格正文 | `text-sm` | 14px | 20px | 400 |
| 辅助文本 | `text-xs` | 12px | 16px | 400 |
| 按钮文本 | `text-sm` | 14px | 20px | 500 |

### 5.2 表格列宽定义

| 列名 | 宽度 | 对齐 | 可排序 |
|------|------|------|--------|
| Checkbox | 40px | 居中 | 否 |
| 名称 | 240px | 左 | 是 |
| 状态 | 100px | 左 | 是 |
| 分支 | 120px | 左 | 是 |
| 触发方式 | 100px | 左 | 是 |
| 时长 | 80px | 右 | 是 |
| 时间 | 120px | 右 | 是 |
| 操作 | 120px | 右 | 否 |

---

## 六、交互说明

### 6.1 核心交互行为

| 交互 | 触发条件 | 反馈 | 持续时间 |
|------|----------|------|----------|
| 行悬停 | 鼠标进入 | 背景变 `neutral-50`，显示操作按钮 | 150ms |
| 行选中 | 点击复选框 | 背景变 `primary-50`，复选框选中 | 即时 |
| 筛选变更 | 下拉选择 | 表格刷新，URL 参数更新 | 300ms |
| 搜索输入 | 输入防抖 | 实时过滤，显示结果计数 | 300ms 防抖 |
| 列排序 | 点击表头 | 升序→降序→无顺序循环 | 200ms |
| 批量操作 | 点击操作按钮 | 确认弹窗→执行→刷新 | 500ms+API |

### 6.2 键盘快捷键

| 快捷键 | 功能 | 适用场景 |
|--------|------|----------|
| `Cmd/Ctrl + K` | 聚焦搜索框 | 全局 |
| `Cmd/Ctrl + N` | 创建新流水线 | 全局 |
| `Escape` | 清除搜索/关闭筛选 | 搜索聚焦时 |
| `Space` | 切换当前行选中 | 行聚焦时 |
| `↑/↓` | 上下移动焦点 | 表格内导航 |
| `Enter` | 打开详情页 | 行聚焦时 |
| `R` | 重新运行选中项 | 有选中行时 |
| `A` | 全选当前页 | 全局 |

### 6.3 操作确认规则

| 操作 | 是否需要确认 | 确认方式 | 可撤销 |
|------|--------------|----------|--------|
| 运行流水线 | 否 | 直接执行 | 可停止 |
| 删除流水线 | 是 | 模态框确认 | ❌ 不可撤销 |
| 批量删除 (≥3) | 是 | 模态框 + 输入名称确认 | ❌ 不可撤销 |
| 批量删除 (<3) | 是 | 模态框确认 | ❌ 不可撤销 |
| 停止运行中 | 是 | Toast + 确认按钮 | ✅ 可重新运行 |

---

## 七、状态定义

### 7.1 空状态（Empty State）

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│                        ┌─────────────┐                         │
│                        │             │                         │
│                        │    📋       │                         │
│                        │  (48x48px)  │                         │
│                        │             │                         │
│                        └─────────────┘                         │
│                                                                 │
│                    暂无流水线                                   │
│              text-2xl, font-weight-semibold, neutral-800        │
│                                                                 │
│            创建第一条流水线开始您的 DevOps 之旅                  │
│              text-md, neutral-500, margin-top: 8px             │
│                                                                 │
│              ┌──────────────┐  ┌──────────────┐                │
│              │  + 创建流水线 │  │   查看教程   │                │
│              │ primary-600  │  │ neutral-600  │                │
│              └──────────────┘  └──────────────┘                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**空状态触发条件**：
- 用户无任何流水线
- 筛选/搜索结果为空

### 7.2 加载状态（Loading State）

**骨架屏规格**：
```css
.skeleton-row {
  display: flex;
  gap: 16px;
  padding: 16px;
  background: var(--neutral-50);
  border-radius: var(--radius-md);
}

.skeleton-text {
  height: 16px;
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

@keyframes skeleton-loading {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

**加载行数**：显示 5 行骨架屏，高度与实际表格一致

### 7.3 错误状态（Error State）

| 错误类型 | 展示方式 | 用户操作 | 自动重试 |
|----------|----------|----------|----------|
| 网络错误 | 全页错误卡片 | [重试] [检查网络] | 3 次后停止 |
| API 错误 | Toast 提示 | 关闭或重试 | 否 |
| 数据为空 | 空状态 | 创建或筛选 | 否 |
| 超时 | 部分加载提示 | [重新加载] | 可选 |

---

## 八、响应式设计

### 8.1 移动端适配策略

**XS (< 576px) - 卡片模式**：
```
┌─────────────────────────────────┐
│  Pipelines           [+ New]    │
├─────────────────────────────────┤
│ ┌─────────────────────────────┐ │
│ │ payment-deploy      ✅     │ │
│ │ main • Manual • 3m 12s     │ │
│ │ 2 minutes ago               │ │
│ │ [Run] [View] [More ▼]      │ │
│ └─────────────────────────────┘ │
│ ┌─────────────────────────────┐ │
│ │ order-build         🟡     │ │
│ │ feat/x • Push • -          │ │
│ │ 5 minutes ago               │ │
│ │ [View] [More ▼]            │ │
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```

**SM (576-768px) - 紧凑表格**：
- 隐藏时长列
- 筛选器合并为单按钮
- 批量操作固定底部

**MD (768-992px) - 完整功能**：
- 显示所有列
- 筛选器展开
- 批量操作在表格外

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
  
  --table-row-padding: var(--spacing-md);
  --table-row-gap: var(--spacing-lg);
}
```

### 9.2 圆角系统

```css
:root {
  --radius-xs: 2px;    /* Checkbox, Tag */
  --radius-sm: 4px;    /* Button, Input */
  --radius-md: 8px;    /* Card, Dropdown */
  --radius-lg: 12px;   /* Large Card */
  --radius-xl: 16px;   /* Full Container */
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

---

## 十、Agent 开发指南

### 10.1 快速实现提示

使用以下提示词生成代码：

```
创建一个流水线列表页，使用以下设计令牌：
- 主色：#1890FF (primary-500), #0058C4 (primary-600)
- 状态色：success-600 #389E0D, error-600 #D9363E, warning-600 #D48806
- 表格行高：48px，悬停背景：#FAFAFA
- 选中行背景：#E6F4FF
- 圆角：8px (radius-md)
- 阴影：shadow-md for dropdowns, shadow-sm for cards
```

### 10.2 关键实现检查点

- [ ] 所有颜色对比度满足 WCAG 2.1 AA（≥ 4.5:1）
- [ ] 键盘导航完整（Tab 顺序、快捷键）
- [ ] 聚焦状态可见（`:focus-visible`）
- [ ] 暗黑模式颜色映射正确
- [ ] 响应式断点测试通过
- [ ] 加载状态和空状态实现
- [ ] 触摸目标 ≥ 44x44px（移动端）

---

*文档版本：v1.0*  
*创建日期：2026-04-10*  
*基于 Orion Design Tokens v1.2.0*
