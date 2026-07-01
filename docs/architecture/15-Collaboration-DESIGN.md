# Orion 协作通知配置设计文档

> 版本：v1.0  
> 创建日期：2026-04-10  
> 设计师：Orion Design System Team  
> 适用范围：P1 核心功能 - 协作与通知管理模块

---

## 一、页面概述

### 1.1 页面定义

协作通知配置（Collaboration Settings）是 Orion 平台的统一通知管理中心，用户在此配置通知渠道、管理通知规则、设置 On-Call 排班、管理免打扰时段和查看通知历史。页面采用配置向导与列表混合设计，兼顾灵活性和易用性。

### 1.2 目标用户

| 角色 | 核心任务 | 使用频率 | 权限级别 |
|------|----------|----------|----------|
| 运维工程师 | 配置通知渠道、设置 On-Call | 中频（每周 3-5 次） | 配置/执行 |
| 技术主管 | 审批通知规则、查看统计 | 低频（每周 1-2 次） | 审批/只读 |
| 开发工程师 | 订阅通知、设置免打扰 | 低频（每月 2-3 次） | 个人配置 |
| 产品经理 | 查看通知记录 | 低频（每周 1-2 次） | 只读 |

### 1.3 设计原则

- **渠道多样**：支持钉钉/企微/飞书/Slack/邮件等多种通知方式
- **规则灵活**：按事件类型/接收人/时间维度精细化配置
- **排班可视**：On-Call 日历直观展示，支持轮班和升级策略
- **人性设计**：免打扰时段保护，通知历史可追溯

---

## 二、布局结构

### 2.1 页面布局（ASCII）

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Top Navigation Bar                                                     │
├────────┬────────────────────────────────────────────────────────────────┤
│        │                                                                │
│ Side   │  ┌──────────────────────────────────────────────────────────┐ │
│ bar    │  │  Collaboration Settings                 [+ New Channel]  │ │
│        │  └──────────────────────────────────────────────────────────┘ │
│        │                                                                │
│        │  ┌──────────────────────────────────────────────────────────┐ │
│        │  │  [Channels] [Rules] [On-Call] [DND] [History]           │ │
│        │  └──────────────────────────────────────────────────────────┘ │
│        │                                                                │
│        │  ┌──────────────────────────────────────────────────────────┐ │
│        │  │  Notification Channels (5)                              │ │
│        │  │  ──────────────────────────────────────────────────────  │ │
│        │  │  ┌────────────────────────────────────────────────────┐  │ │
│        │  │  │ 💬 DingTalk        #general-alert     ✅ Active   │  │ │
│        │  │  │    Webhook: https://oapi.dingtalk.com/robot/...    │  │ │
│        │  │  │    [Edit] [Test] [Disable]                         │  │ │
│        │  │  └────────────────────────────────────────────────────┘  │ │
│        │  │  ┌────────────────────────────────────────────────────┐  │ │
│        │  │  │ 💬 Slack           #ops-incidents     ✅ Active   │  │ │
│        │  │  │    Workspace: orion-team    Channel ID: C012345   │  │ │
│        │  │  │    [Edit] [Test] [Disable]                         │  │ │
│        │  │  └────────────────────────────────────────────────────┘  │ │
│        │  └──────────────────────────────────────────────────────────┘ │
│        │                                                                │
│        │  ┌──────────────────────────────────────────────────────────┐ │
│        │  │  On-Call Schedule - Current Week                        │ │
│        │  │  ┌────────────────────────────────────────────────────┐  │ │
│        │  │  │ Mon  Tue  Wed  Thu  Fri  Sat  Sun                  │  │ │
│        │  │  │ ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐               │  │ │
│        │  │  │ │张│ │李 │ │王 │ │赵 │ │张 │ │李 │ │王 │          │  │ │
│        │  │  │ └──┘ └──┘ └──┘ └──┘ └──┘ └──┘ └──┘               │  │ │
│        │  │  │ Next: 张 (Mon 09:00)  Escalation: 15min → 李      │  │ │
│        │  │  └────────────────────────────────────────────────────┘  │ │
│        │  └──────────────────────────────────────────────────────────┘ │
│        │                                                                │
└────────┴────────────────────────────────────────────────────────────────┘
```

### 2.2 通知渠道配置抽屉（ASCII）

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Configure Notification Channel                           [X] [Save]    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  Basic Information                                                │  │
│  │  ───────────────────────────────────────────────────────────────  │  │
│  │  Name: [💬 DingTalk Production                ]                   │  │
│  │  Type: [DingTalk ▼]                                               │  │
│  │         • DingTalk  • WeChat Work  • Feishu  • Slack  • Email    │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  Connection Settings                                              │  │
│  │  ───────────────────────────────────────────────────────────────  │  │
│  │  Webhook URL:                                                     │  │
│  │  [https://oapi.dingtalk.com/robot/send?access_token=xxxxxxxx   ]  │  │
│  │                                                                   │  │
│  │  ☑ Enable SSL Verification     ☑ Enable Retry (3 attempts)       │  │
│  │                                                                   │  │
│  │  Timeout: [30] seconds    Retry Interval: [5] minutes            │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  Notification Template                                            │  │
│  │  ───────────────────────────────────────────────────────────────  │  │
│  │  Template: [Default Alert Template ▼]                            │  │
│  │                                                                   │  │
│  │  Preview:                                                         │  │
│  │  ┌────────────────────────────────────────────────────────────┐   │  │
│  │  │ 🔴 [P1] Production DB Connection High                      │   │  │
│  │  │ Service: payment-db                                      │   │  │
│  │  │ Time: 2026-04-10 14:25:33                                 │   │  │
│  │  │ Details: active_connections / max_connections = 92%       │   │  │
│  │  └────────────────────────────────────────────────────────────┘   │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  Test Connection                                                   │  │
│  │  ───────────────────────────────────────────────────────────────  │  │
│  │  [Send Test Message]  ✓ Last test: Success (2 minutes ago)       │  │
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
| SM | 576-768px | 卡片堆叠，标签页横向滚动，抽屉 80% 宽度 |
| MD | 768-992px | 双列布局，标签页完整，抽屉 60% 宽度 |
| LG+ | > 992px | 完整布局，所有功能可见 |

---

## 三、组件清单

### 3.1 使用组件列表

| 组件名 | 用途 | 状态数 | 设计规范 |
|--------|------|--------|----------|
| `PageHeader` | 页面标题 + 创建按钮 | 1 | 带副标题说明 |
| `TabBar` | 标签页导航 | 5 | Channels/Rules/On-Call/DND/History |
| `ChannelCard` | 渠道卡片 | 4 | Active/Inactive/Testing/Error |
| `ChannelIcon` | 渠道图标 | 5 | DingTalk/WeChat/Feishu/Slack/Email |
| `RuleTable` | 规则列表 | 3 | 支持筛选和批量操作 |
| `EventSelector` | 事件类型选择器 | 4 | 多选/搜索/分组 |
| `UserPicker` | 接收人选择器 | 3 | 单选/多选/角色 |
| `ScheduleCalendar` | 排班日历 | 4 | 周/月/季度视图 |
| `EscalationConfig` | 升级策略配置 | 2 | 时间/人员链 |
| `DNDScheduler` | 免打扰时段配置 | 3 | 固定/循环/临时 |
| `HistoryTable` | 通知历史 | 4 | 支持筛选和导出 |
| `DeliveryStatus` | 投递状态徽章 | 5 | Success/Failed/Pending/Retry/Cancelled |
| `EmptyState` | 空状态 | 4 | 无渠道/无规则/无排班 |
| `Skeleton` | 加载骨架屏 | 3 | 卡片/表格/日历 |

### 3.2 组件颜色映射

```css
/* 渠道状态颜色 - 基于 Orion Design Tokens */
:root {
  --channel-active-bg: var(--success-50);
  --channel-active-text: var(--success-600);
  --channel-active-border: var(--success-200);
  
  --channel-inactive-bg: var(--neutral-50);
  --channel-inactive-text: var(--neutral-500);
  --channel-inactive-border: var(--neutral-200);
  
  --channel-testing-bg: var(--info-50);
  --channel-testing-text: var(--info-600);
  --channel-testing-border: var(--info-200);
  
  --channel-error-bg: var(--error-50);
  --channel-error-text: var(--error-600);
  --channel-error-border: var(--error-200);
}

/* 通知投递状态颜色 */
:root {
  --delivery-success: var(--success-600);   /* #389E0D */
  --delivery-failed: var(--error-600);      /* #D9363E */
  --delivery-pending: var(--info-600);      /* #08979C */
  --delivery-retry: var(--warning-600);     /* #D48806 */
  --delivery-cancelled: var(--neutral-500); /* #8C8C8C */
}
```

---

## 四、颜色与视觉规范

### 4.1 主色调应用

| 元素 | 颜色 Token | HEX | 用途 |
|------|-----------|-----|------|
| 主按钮背景 | `primary-600` | #0058C4 | 新建渠道 |
| 主按钮悬停 | `primary-700` | #0047A0 | 按钮 Hover |
| 激活标签 | `primary-50` | #E6F4FF | 标签页选中 |
| 激活文本 | `primary-600` | #0058C4 | 标签页文字 |
| 链接文本 | `primary-500` | #0070F3 | 可点击文本 |

### 4.2 渠道状态色完整定义

```css
/* Active - 已激活 */
.channel-active {
  background-color: var(--success-50);    /* #F6FFED */
  color: var(--success-600);              /* #389E0D - 对比度 5.2:1 ✅ */
  border-color: var(--success-200);       /* #B7EB8F */
}

/* Inactive - 已禁用 */
.channel-inactive {
  background-color: var(--neutral-50);    /* #FAFAFA */
  color: var(--neutral-500);              /* #8C8C8C - 对比度 4.2:1 ✅ */
  border-color: var(--neutral-200);       /* #EBEBEB */
}

/* Testing - 测试中 */
.channel-testing {
  background-color: var(--info-50);       /* #E6FFFB */
  color: var(--info-600);                 /* #08979C */
  border-color: var(--info-200);          /* #87E8DE */
  animation: pulse-testing 1.5s infinite;
}

/* Error - 错误状态 */
.channel-error {
  background-color: var(--error-50);      /* #FFF1F0 */
  color: var(--error-600);                /* #D9363E - 对比度 5.1:1 ✅ */
  border-color: var(--error-200);         /* #FFA39E */
}

@keyframes pulse-testing {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.8; }
}
```

### 4.3 渠道品牌色

```css
/* 各通知渠道品牌色 */
:root {
  --brand-dingtalk: #0084FF;
  --brand-wechat: #07C160;
  --brand-feishu: #3370FF;
  --brand-slack: #4A154B;
  --brand-email: #1890FF;
}
```

### 4.4 暗黑模式映射

```css
.dark-mode {
  --channel-active-bg: hsl(145, 25%, 12%);
  --channel-active-text: var(--success-300);
  
  --channel-inactive-bg: hsl(0, 0%, 15%);
  --channel-inactive-text: var(--neutral-400);
  
  --channel-testing-bg: hsl(200, 30%, 15%);
  --channel-testing-text: var(--info-300);
  
  --channel-error-bg: hsl(359, 25%, 12%);
  --channel-error-text: var(--error-300);
}
```

---

## 五、字体与排版

### 5.1 字号层级

| 元素 | Token | 字号 | 行高 | 字重 |
|------|-------|------|------|------|
| 页面标题 | `text-2xl` | 24px | 32px | 600 |
| 卡片标题 | `text-lg` | 18px | 28px | 600 |
| 渠道名称 | `text-md` | 16px | 24px | 600 |
| 渠道描述 | `text-sm` | 14px | 20px | 400 |
| 辅助文本 | `text-xs` | 12px | 16px | 400 |
| 标签页 | `text-sm` | 14px | 20px | 500 |

### 5.2 排班日历单元格尺寸

| 元素 | 宽度 | 高度 | 字体 |
|------|------|------|------|
| 日单元格 | 80px | 100px | text-sm |
| 人名显示 | 72px | 24px | text-xs, 500 |
| 周标题 | 80px | 32px | text-h6, 600 |

---

## 六、交互说明

### 6.1 核心交互行为

| 交互 | 触发条件 | 反馈 | 持续时间 |
|------|----------|------|----------|
| 渠道卡片悬停 | 鼠标进入 | 显示操作按钮 | 150ms |
| 渠道测试 | 点击测试 | 发送测试消息 | 500ms+API |
| 标签切换 | 点击标签 | 内容切换+URL 更新 | 200ms |
| 排班拖拽 | 拖动人员 | 更新排班 | 即时+确认 |
| 规则切换 | 开关变更 | 立即生效 | 100ms |
| 通知历史筛选 | 条件变更 | 列表刷新 | 300ms |

### 6.2 键盘快捷键

| 快捷键 | 功能 | 适用场景 |
|--------|------|----------|
| `Cmd/Ctrl + K` | 聚焦全局搜索 | 全局 |
| `Cmd/Ctrl + N` | 新建通知渠道 | 全局 |
| `Cmd/Ctrl + T` | 测试选中渠道 | 渠道列表 |
| `Cmd/Ctrl + S` | 保存配置 | 编辑状态 |
| `Escape` | 关闭抽屉/弹窗 | 任意 |
| `↑/↓` | 上下选择渠道 | 列表聚焦 |
| `Enter` | 编辑选中渠道 | 行聚焦 |
| `T` | 测试选中渠道 | 有选中项 |

### 6.3 操作确认规则

| 操作 | 是否需要确认 | 确认方式 | 可撤销 |
|------|--------------|----------|--------|
| 新建渠道 | 否 | 保存即生效 | ✅ 可禁用 |
| 删除渠道 | 是 | 模态框 + 名称确认 | ❌ 不可撤销 |
| 修改排班 | 否 | 保存即生效 | ✅ 可恢复 |
| 启用/禁用渠道 | 否 | 直接切换 | ✅ 可反向 |
| 批量删除规则 | 是 | 数量确认 | ❌ 不可撤销 |

---

## 七、状态定义

### 7.1 空状态（Empty State）

```
┌─────────────────────────────────────────────────────────────────┐
│                        ┌─────────────┐                         │
│                        │             │                         │
│                        │    🔔       │                         │
│                        │  (64x64px)  │                         │
│                        │             │                         │
│                        └─────────────┘                         │
│                                                                 │
│                  暂无通知渠道                                    │
│              text-2xl, font-weight-semibold, neutral-800        │
│                                                                 │
│          配置第一个通知渠道，开始接收重要事件通知                 │
│              text-md, neutral-500, margin-top: 8px             │
│                                                                 │
│              ┌──────────────┐  ┌──────────────┐                │
│              │ + 配置渠道   │  │ 📖 配置指南  │                │
│              │ primary-600  │  │ neutral-600  │                │
│              └──────────────┘  └──────────────┘                │
│                                                                 │
│          ───────────  支持渠道  ───────────                    │
│                                                                 │
│     💬 钉钉  •  💬 企业微信  •  📧 飞书  •  💬 Slack  •  📧 邮件   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 7.2 加载状态（Loading State）

**骨架屏规格**：
```css
.channel-card-skeleton {
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

/* 排班日历骨架 */
.schedule-skeleton {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 8px;
  padding: 16px;
}

.schedule-cell-skeleton {
  height: 100px;
  background: var(--neutral-50);
  border-radius: var(--radius-sm);
  animation: skeleton-loading 1.5s infinite;
}
```

### 7.3 错误状态（Error State）

| 错误类型 | 展示方式 | 用户操作 | 自动重试 |
|----------|----------|----------|----------|
| 渠道连接失败 | 卡片错误状态 | [重新测试] [编辑配置] | 可选 |
| 排班冲突 | 弹窗提示 | [调整排班] [忽略] | 否 |
| 通知发送失败 | Toast + 重试 | [重试] [查看原因] | 3 次 |
| 权限不足 | 空状态 + 申请 | [申请权限] | 否 |

---

## 八、响应式设计

### 8.1 移动端适配策略

**XS (< 576px) - 卡片模式**：
```
┌─────────────────────────────────┐
│  Settings        [+ Channel]    │
├─────────────────────────────────┤
│ [Channels ▼] [Rules] [On-Call]  │
├─────────────────────────────────┤
│ ┌─────────────────────────────┐ │
│ │ 💬 DingTalk      ✅ Active  │ │
│ │ #general-alert              │ │
│ │ [Edit] [Test] [Disable]     │ │
│ └─────────────────────────────┘ │
│ ┌─────────────────────────────┐ │
│ │ 💬 Slack         ✅ Active  │ │
│ │ #ops-incidents              │ │
│ │ [Edit] [Test] [Disable]     │ │
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```

**SM (576-768px) - 双列卡片**：
- 渠道卡片 2 列
- 排班日历简化为周视图
- 操作按钮图标化

**MD (768-992px) - 完整功能**：
- 渠道卡片单列
- 排班日历完整
- 所有操作可见

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
  
  --card-padding: var(--spacing-lg);
  --card-gap: var(--spacing-lg);
  --channel-card-gap: var(--spacing-md);
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

### 9.4 排班日历样式

```css
:root {
  --calendar-cell-width: 80px;
  --calendar-cell-height: 100px;
  --calendar-cell-gap: 8px;
  --calendar-header-height: 32px;
  
  --calendar-border: 1px solid var(--neutral-200);
  --calendar-border-radius: var(--radius-sm);
  
  --calendar-today-bg: var(--primary-50);
  --calendar-today-border: var(--primary-500);
  
  --calendar-user-height: 24px;
  --calendar-user-radius: var(--radius-xs);
  --calendar-user-bg: var(--primary-100);
  --calendar-user-text: var(--primary-700);
}
```

### 9.5 动画系统

```css
:root {
  --transition-fast: 150ms ease;
  --transition-normal: 200ms ease;
  --transition-slow: 300ms ease;
  
  --animation-pulse-testing: pulse-testing 1.5s infinite;
  --animation-skeleton: skeleton-loading 1.5s infinite;
}

@keyframes pulse-testing {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.8; }
}

@keyframes skeleton-loading {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

---

## 十、Agent 开发指南

### 10.1 快速实现提示

使用以下提示词生成代码：

```
创建一个协作通知配置页面，使用以下设计令牌：
- 渠道状态：Active #389E0D, Inactive #8C8C8C, Testing #08979C, Error #D9363E
- 投递状态：Success #389E0D, Failed #D9363E, Pending #08979C, Retry #D48806
- 渠道品牌色：DingTalk #0084FF, WeChat #07C160, Feishu #3370FF, Slack #4A154B
- 排班日历：单元格 80x100px, 边框 1px, 圆角 4px
- 渠道卡片：圆角 8px, 悬停阴影 shadow-md
- 标签页：选中背景 #E6F4FF, 文本 #0058C4
```

### 10.2 关键实现检查点

- [ ] 渠道状态实时检测（Webhook 连通性）
- [ ] 排班拖拽交互流畅
- [ ] 升级策略配置可视化
- [ ] 免打扰时段冲突检测
- [ ] WCAG 2.1 AA 对比度合规
- [ ] 键盘导航完整（Tab 顺序、快捷键）
- [ ] 聚焦状态可见（`:focus-visible`）
- [ ] 暗黑模式颜色映射正确
- [ ] 响应式断点测试通过
- [ ] 骨架屏和空状态实现
- [ ] 通知历史支持导出
- [ ] 测试消息发送功能

### 10.3 通知 API 要求

- 渠道 CRUD API
- 渠道测试 API
- 通知规则 CRUD API
- 排班 CRUD API
- 升级策略 CRUD API
- 免打扰配置 API
- 通知历史查询 API
- 通知统计 API

### 10.4 通知规则示例

```graphql
# Query notification channels
query GetChannels {
  channels {
    id
    name
    type
    status
    webhook
    lastTest {
      status
      timestamp
    }
  }
}

# Query notification rules
query GetNotificationRules {
  rules {
    id
    name
    events
    receivers {
      type
      channel
      target
    }
    schedule {
      startTime
      endTime
      daysOfWeek
    }
    enabled
  }
}

# Query on-call schedule
query GetOnCallSchedule {
  schedule(week: "2026-W15") {
    days {
      date
      primary { user { id name avatar } }
      backup { user { id name avatar } }
      escalation { timeoutMinutes user { id name } }
    }
  }
}

# Send test notification
mutation SendTestNotification {
  sendTest(channelId: "channel-001") {
    success
    message
  }
}
```

---

*文档版本：v1.0*  
*创建日期：2026-04-10*  
*基于 Orion Design Tokens v1.2.0*
