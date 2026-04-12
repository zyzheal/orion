# Orion 安全审计中心设计文档

> 版本：v1.0  
> 创建日期：2026-04-10  
> 设计师：Orion Design Team  
> 适用范围：P1 核心功能 - 安全与合规模块

---

## 一、页面概述

### 1.1 页面定义

安全审计中心（Security Audit Center）是 Orion 平台的安全监控与合规管理核心界面，提供安全事件追踪、审计日志查询、合规报告生成和 UEBA 用户行为分析功能。页面采用高信息密度设计，兼顾安全分析的深度和日常监控的效率。

### 1.2 目标用户

| 角色 | 核心任务 | 使用频率 | 权限级别 |
|------|----------|----------|----------|
| 安全工程师 | 调查安全事件、分析异常行为 | 高频（每日 15+ 次） | 完全访问 |
| 合规官员 | 生成合规报告、跟踪修复进度 | 中频（每周 5-10 次） | 报告/只读 |
| 技术主管 | 查看安全态势概览 | 低频（每周 2-3 次） | 概览/只读 |
| 审计员 | 导出审计日志、验证控制项 | 低频（每月 2-4 次） | 导出/只读 |

### 1.3 设计原则

- **安全优先**：敏感操作二次确认，数据脱敏展示
- **追溯完整**：所有操作留痕，时间线精确到秒
- **效率兼顾**：常用查询预设，支持 SQL 高级筛选
- **合规保障**：SOC2/等保 2.0/GDPR 标准对齐

---

## 二、布局结构

### 2.1 页面布局（ASCII）

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Top Navigation Bar                                                     │
├────────┬────────────────────────────────────────────────────────────────┤
│        │                                                                │
│ Side   │  ┌──────────────────────────────────────────────────────────┐ │
│ bar    │  │  Security Audit Center                    [Export Report]│ │
│        │  └──────────────────────────────────────────────────────────┘ │
│        │                                                                │
│        │  ┌──────────────────────────────────────────────────────────┐ │
│        │  │  [Overview] [Events] [Logs] [Compliance] [UEBA]         │ │
│        │  └──────────────────────────────────────────────────────────┘ │
│        │                                                                │
│        │  ┌──────────────────────────────────────────────────────────┐ │
│        │  │  🔍 Search events...   [Severity ▼] [Time Range ▼] [+]  │ │
│        │  │  Last 24h | Last 7d | Last 30d | Custom                 │ │
│        │  └──────────────────────────────────────────────────────────┘ │
│        │                                                                │
│        │  ┌──────────────────────────────────────────────────────────┐ │
│        │  │  Security Events                                        │ │
│        │  │  ──────────────────────────────────────────────────────  │ │
│        │  │  │ Time      │ Type      │ Severity │ Source    │ User │ │
│        │  │  │───────────│───────────│──────────│───────────│──────│ │
│        │  │  │ 14:32:15  │ Login Fail│ 🔴 High  │ Auth Svc  │ u123 │ │
│        │  │  │ 14:28:01  │ Data Access│ 🟡 Medium│ DB Proxy  │ u456 │ │
│        │  │  │ 14:15:44  │ Config Chg│ 🟠 Low   │ Admin API │ u789 │ │
│        │  │  │ 13:58:22  │ Priv Esc  │ 🔴 High  │ IAM       │ u123 │ │
│        │  │  │ ...                                                    │ │
│        │  │  Showing 1-20 of 1,247 events    [Export] [Alert Setup] │ │
│        │  └──────────────────────────────────────────────────────────┘ │
│        │                                                                │
│        │  ┌──────────────────────────────────────────────────────────┐ │
│        │  │  UEBA Behavior Score                                    │ │
│        │  │  ┌─────────────────┐  ┌─────────────────────────────────┐│ │
│        │  │  │   Risk Meter    │  │   User Risk Trend (7d)         ││ │
│        │  │  │   [=====>] 72   │  │   [Line Chart]                 ││ │
│        │  │  │   High Risk     │  │                                ││ │
│        │  │  └─────────────────┘  └─────────────────────────────────┘│ │
│        │  └──────────────────────────────────────────────────────────┘ │
│        │                                                                │
└────────┴────────────────────────────────────────────────────────────────┘
```

### 2.2 响应式断点布局

| 断点 | 宽度 | 布局策略 |
|------|------|----------|
| XS | < 576px | 单列卡片布局，UEBA 模块折叠，筛选器底部抽屉 |
| SM | 576-768px | 双列卡片，隐藏次要列，时间范围简化 |
| MD | 768-992px | 完整表格，UEBA 面板右侧固定 |
| LG+ | > 992px | 完整布局，支持多面板并排分析 |

---

## 三、组件清单

### 3.1 使用组件列表

| 组件名 | 用途 | 状态数 | 设计规范 |
|--------|------|--------|----------|
| `PageHeader` | 页面标题 + 导出操作 | 1 | 含时间戳显示 |
| `TabNavigation` | 5 个视图切换 | 2 | 带未读徽章 |
| `EventTable` | 安全事件表格 | 5 | 支持时间线展开 |
| `SeverityBadge` | 严重等级徽章 | 4 | 高/中/低/信息 |
| `TimeRangePicker` | 时间范围选择 | 4 | 预设 + 自定义 |
| `LogSearch` | 审计日志搜索 | 3 | 支持 Lucene 语法 |
| `ComplianceCard` | 合规分数卡片 | 3 | SOC2/等保/GDPR |
| `RiskMeter` | UEBA 风险计 | 5 | 动画仪表盘 |
| `TrendChart` | 风险趋势图 | 2 | 7d/30d 切换 |
| `UserDrawer` | 用户详情抽屉 | 2 | 从右侧滑出 |
| `ExportModal` | 导出配置弹窗 | 3 | 格式/范围/字段 |
| `AlertConfig` | 告警配置面板 | 2 | 阈值/通知方式 |
| `EmptyState` | 空状态 | 3 | 无事件/无日志/无数据 |
| `Skeleton` | 加载骨架屏 | 4 | 表格/图表/卡片 |

### 3.2 组件颜色映射

```css
/* 严重等级颜色 - 基于 Orion Design Tokens */
:root {
  --severity-critical-bg: var(--error-50);
  --severity-critical-text: var(--error-700);
  --severity-critical-border: var(--error-300);
  
  --severity-high-bg: var(--error-50);
  --severity-high-text: var(--error-600);
  --severity-high-border: var(--error-200);
  
  --severity-medium-bg: var(--warning-50);
  --severity-medium-text: var(--warning-700);
  --severity-medium-border: var(--warning-200);
  
  --severity-low-bg: var(--info-50);
  --severity-low-text: var(--info-700);
  --severity-low-border: var(--info-200);
  
  --severity-info-bg: var(--neutral-50);
  --severity-info-text: var(--neutral-600);
  --severity-info-border: var(--neutral-200);
}
```

---

## 四、颜色与视觉规范

### 4.1 主色调应用

| 元素 | 颜色 Token | HEX | 用途 |
|------|-----------|-----|------|
| 主按钮背景 | `primary-600` | #0058C4 | 导出报告按钮 |
| 主按钮悬停 | `primary-700` | #0047A0 | 按钮 Hover 状态 |
| 严重事件高亮 | `error-50` | #FFF1F0 | 高危事件背景 |
| 风险计警告 | `warning-500` | #FAAD14 | 中等风险 |
| 风险计危险 | `error-500` | #F5222D | 高风险 |

### 4.2 严重等级色完整定义

```css
/* 严重等级 - Critical (危急) */
.severity-critical {
  background-color: var(--error-50);    /* #FFF1F0 */
  color: var(--error-700);              /* #A8222E - 对比度 6.8:1 ✅ */
  border-color: var(--error-300);       /* #FF7875 */
  box-shadow: 0 2px 8px rgba(217, 54, 62, 0.15);
}

/* 严重等级 - High (高) */
.severity-high {
  background-color: var(--error-50);    /* #FFF1F0 */
  color: var(--error-600);              /* #D9363E - 对比度 5.1:1 ✅ */
  border-color: var(--error-200);       /* #FFA39E */
}

/* 严重等级 - Medium (中) */
.severity-medium {
  background-color: var(--warning-50);  /* #FFFBE6 */
  color: var(--warning-700);            /* #AD6800 - 对比度 6.2:1 ✅ */
  border-color: var(--warning-200);     /* #FFE58F */
}

/* 严重等级 - Low (低) */
.severity-low {
  background-color: var(--info-50);     /* #E6FFFB */
  color: var(--info-700);               /* #006D75 - 对比度 5.8:1 ✅ */
  border-color: var(--info-200);        /* #87E8DE */
}

/* 严重等级 - Info (信息) */
.severity-info {
  background-color: var(--neutral-50);  /* #FAFAFA */
  color: var(--neutral-600);            /* #666666 - 对比度 5.7:1 ✅ */
  border-color: var(--neutral-200);     /* #EBEBEB */
}
```

### 4.3 风险计颜色梯度

```css
.risk-meter {
  /* 0-30: 安全 */
  --risk-safe: var(--success-500);      /* #52C41A */
  /* 31-60: 注意 */
  --risk-caution: var(--warning-500);   /* #FAAD14 */
  /* 61-85: 高风险 */
  --risk-high: var(--orange-500);       /* #FA8C16 */
  /* 86-100: 危急 */
  --risk-critical: var(--error-500);    /* #F5222D */
}
```

### 4.4 暗黑模式映射

```css
.dark-mode {
  --severity-critical-bg: hsl(359, 30%, 15%);
  --severity-critical-text: var(--error-300);
  --severity-critical-border: hsl(359, 40%, 25%);
  
  --severity-high-bg: hsl(359, 25%, 14%);
  --severity-high-text: var(--error-400);
  
  --severity-medium-bg: hsl(38, 30%, 15%);
  --severity-medium-text: var(--warning-300);
  
  --risk-meter-gradient: linear-gradient(
    90deg,
    #2d5a27 0%,    /* 安全 */
    #8a6d0b 50%,   /* 注意 */
    #a85407 75%,   /* 高 */
    #9b1c26 100%   /* 危急 */
  );
}
```

---

## 五、字体与排版

### 5.1 字号层级

| 元素 | Token | 字号 | 行高 | 字重 |
|------|-------|------|------|------|
| 页面标题 | `text-2xl` | 24px | 32px | 600 |
| 卡片标题 | `text-lg` | 18px | 28px | 600 |
| 表格标题 | `text-xs` | 12px | 16px | 600 |
| 表格正文 | `text-sm` | 14px | 20px | 400 |
| 时间戳 | `text-xs` | 12px | 16px | 400 |
| 风险分数 | `text-4xl` | 36px | 44px | 700 |

### 5.2 表格列宽定义

| 列名 | 宽度 | 对齐 | 可排序 |
|------|------|------|--------|
| 时间 | 100px | 左 | 是 |
| 事件类型 | 140px | 左 | 是 |
| 严重等级 | 90px | 左 | 是 |
| 来源服务 | 120px | 左 | 是 |
| 用户 ID | 100px | 左 | 是 |
| IP 地址 | 140px | 左 | 是 |
| 操作 | 100px | 右 | 否 |

---

## 六、交互说明

### 6.1 核心交互行为

| 交互 | 触发条件 | 反馈 | 持续时间 |
|------|----------|------|----------|
| 事件行展开 | 点击行 | 显示详细时间线 | 200ms |
| 严重等级筛选 | 下拉选择 | 表格刷新 | 150ms |
| 用户 ID 点击 | 点击 | 右侧抽屉滑出 | 300ms |
| 时间范围切换 | 点击预设 | 数据刷新 | 200ms |
| 风险计悬停 | 鼠标悬停 | 显示详细评分项 | 100ms |
| 导出配置 | 点击导出 | 弹窗选择 | 即时 |

### 6.2 键盘快捷键

| 快捷键 | 功能 | 适用场景 |
|--------|------|----------|
| `Cmd/Ctrl + K` | 聚焦搜索框 | 全局 |
| `Cmd/Ctrl + E` | 导出当前视图 | 全局 |
| `Cmd/Ctrl + /` | 打开快捷键帮助 | 全局 |
| `Escape` | 关闭抽屉/弹窗 | 任意 |
| `T` | 切换时间范围选择器 | 全局 |
| `1-5` | 切换 Tab (1=Overview, 5=UEBA) | 全局 |
| `↑/↓` | 上下选择事件行 | 表格聚焦 |
| `Enter` | 展开选中事件详情 | 行聚焦 |
| `E` | 导出选中事件 | 有选中项 |

### 6.3 安全确认规则

| 操作 | 是否需要确认 | 确认方式 | 审计记录 |
|------|--------------|----------|----------|
| 导出日志 | 是（超过 1000 条） | 模态框 + 原因填写 | ✅ 记录 |
| 删除告警 | 是 | 模态框确认 | ✅ 记录 |
| 查看敏感数据 | 是 | 二次认证 | ✅ 记录 |
| 修改告警阈值 | 是 | 模态框确认 | ✅ 记录 |

---

## 七、状态定义

### 7.1 空状态（Empty State）

```
┌─────────────────────────────────────────────────────────────────┐
│                        ┌─────────────┐                         │
│                        │             │                         │
│                        │    🛡️       │                         │
│                        │  (64x64px)  │                         │
│                        │             │                         │
│                        └─────────────┘                         │
│                                                                 │
│                    暂无安全事件                                 │
│              text-2xl, font-weight-semibold, neutral-800        │
│                                                                 │
│          当前时间范围内未检测到安全事件，系统运行正常            │
│              text-md, neutral-500, margin-top: 8px             │
│                                                                 │
│              ┌──────────────────────────────────────────────┐  │
│              │  时间范围：过去 24 小时    [清除筛选]          │  │
│              └──────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 7.2 加载状态（Loading State）

**骨架屏规格**：
```css
.event-skeleton {
  display: grid;
  grid-template-columns: 100px 140px 90px 120px 1fr;
  gap: 16px;
  padding: 16px;
}

.skeleton-cell {
  height: 20px;
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

/* 图表骨架屏 */
.chart-skeleton {
  height: 200px;
  background: var(--neutral-100);
  border-radius: var(--radius-md);
  position: relative;
  overflow: hidden;
}

.chart-skeleton::after {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255,255,255,0.4) 50%,
    transparent 100%
  );
  animation: shimmer 1.5s infinite;
}
```

### 7.3 错误状态（Error State）

| 错误类型 | 展示方式 | 用户操作 | 自动重试 |
|----------|----------|----------|----------|
| 数据加载失败 | 全页错误卡片 | [重试] [联系支持] | 3 次后停止 |
| 导出失败 | Toast 错误提示 | [重新导出] | 否 |
| 权限不足 | 空状态 + 申请按钮 | [申请权限] | 否 |
| 查询超时 | 部分结果 + 提示 | [优化查询] | 可选 |

---

## 八、响应式设计

### 8.1 移动端适配策略

**XS (< 576px) - 卡片模式**：
```
┌─────────────────────────────────┐
│  Security Audit    [Export]     │
├─────────────────────────────────┤
│ [Events] [Logs] [Compliance]    │
├─────────────────────────────────┤
│ ┌─────────────────────────────┐ │
│ │ 🔴 High                     │ │
│ │ Login Failure               │ │
│ │ 14:32:15 • Auth Svc        │ │
│ │ user: u123 • 192.168.1.100 │ │
│ │ [View Details]              │ │
│ └─────────────────────────────┘ │
│ ┌─────────────────────────────┐ │
│ │ 🟡 Medium                   │ │
│ │ Data Access                 │ │
│ │ 14:28:01 • DB Proxy        │ │
│ │ [View Details]              │ │
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```

**SM (576-768px) - 紧凑表格**：
- 隐藏 IP 地址列
- UEBA 模块垂直堆叠
- 筛选器简化为图标

**MD (768-992px) - 完整功能**：
- 显示所有列
- UEBA 面板底部固定
- 支持双指缩放图表

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
}
```

### 9.2 圆角系统

```css
:root {
  --radius-xs: 2px;    /* Badge, Checkbox */
  --radius-sm: 4px;    /* Button, Input */
  --radius-md: 8px;    /* Card, Dropdown */
  --radius-lg: 12px;   /* Drawer, Modal */
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
  
  --animation-pulse: pulse 2s infinite;
  --animation-shimmer: shimmer 1.5s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

@keyframes shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}
```

---

## 十、Agent 开发指南

### 10.1 快速实现提示

使用以下提示词生成代码：

```
创建一个安全审计中心页面，使用以下设计令牌：
- 严重等级色：critical #A8222E, high #D9363E, medium #AD6800, low #006D75
- 风险计：0-30 安全 (#52C41A), 31-60 注意 (#FAAD14), 61-85 高 (#FA8C16), 86-100 危急 (#F5222D)
- 表格行高：52px（比常规高，便于分析）
- 圆角：8px (radius-md)
- 字体：等宽字体显示时间戳和 ID
```

### 10.2 关键实现检查点

- [ ] 敏感数据脱敏（用户 ID、IP 地址）
- [ ] 所有操作记录审计日志
- [ ] 导出功能需要二次确认
- [ ] 时间戳精确到秒，支持时区切换
- [ ] WCAG 2.1 AA 对比度合规
- [ ] 键盘导航完整（Tab 顺序、快捷键）
- [ ] 聚焦状态可见（`:focus-visible`）
- [ ] 暗黑模式颜色映射正确
- [ ] 响应式断点测试通过
- [ ] 骨架屏和空状态实现
- [ ] UEBA 图表支持无障碍阅读

### 10.3 安全合规要求

- 所有导出文件加密（AES-256）
- 审计日志不可篡改（WORM 存储）
- 会话超时自动登出（15 分钟无操作）
- 敏感操作需要 MFA 验证
- 数据保留策略可配置（默认 90 天）

---

*文档版本：v1.0*  
*创建日期：2026-04-10*  
*基于 Orion Design Tokens v1.2.0*
