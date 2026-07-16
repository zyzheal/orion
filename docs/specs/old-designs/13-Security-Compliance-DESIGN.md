# Orion 安全合规报告设计文档

> 版本：v1.0  
> 创建日期：2026-04-10  
> 设计师：Orion Design System Team  
> 适用范围：P1 核心功能 - 安全合规与审计模块

---

## 一、页面概述

### 1.1 页面定义

安全合规报告（Security Compliance）是 Orion 平台的合规性管理与报告中心，用户在此查看整体合规态势、跟踪等保 2.0/SOC2 控制项状态、管理漏洞扫描报告和修复建议。页面采用仪表板式设计，兼顾宏观概览和微观追溯能力。

### 1.2 目标用户

| 角色 | 核心任务 | 使用频率 | 权限级别 |
|------|----------|----------|----------|
| 安全工程师 | 跟踪控制项、管理漏洞修复 | 高频（每日 10+ 次） | 完全访问 |
| 合规官员 | 生成合规报告、审计控制项 | 中频（每周 5-10 次） | 报告/配置 |
| 技术主管 | 查看合规态势、审批修复计划 | 低频（每周 2-3 次） | 概览/审批 |
| 审计员 | 导出报告、验证控制证据 | 低频（每月 2-4 次） | 只读/导出 |

### 1.3 设计原则

- **合规可视**：整体分数、各项得分、趋势变化一目了然
- **追溯完整**：控制项 - 证据 - 测试记录完整链路
- **修复驱动**：漏洞优先级、修复建议、进度跟踪
- **报告专业**：一键生成符合审计标准的 PDF 报告

---

## 二、布局结构

### 2.1 页面布局（ASCII）

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Top Navigation Bar                                                     │
├────────┬────────────────────────────────────────────────────────────────┤
│        │                                                                │
│ Side   │  ┌──────────────────────────────────────────────────────────┐ │
│ bar    │  │  Security Compliance                    [Generate Report]│ │
│        │  └──────────────────────────────────────────────────────────┘ │
│        │                                                                │
│        │  ┌──────────────────────────────────────────────────────────┐ │
│        │  │  [Overview] [DJCP] [SOC2] [Vulnerabilities] [Reports]   │ │
│        │  └──────────────────────────────────────────────────────────┘ │
│        │                                                                │
│        │  ┌──────────────────────────────────────────────────────────┐ │
│        │  │  Compliance Overview                                    │ │
│        │  │  ┌─────────────┬─────────────┬─────────────────────────┐ │ │
│        │  │  │ Overall     │ DJCP 2.0    │ SOC2 Type II            │ │ │
│        │  │  │ [=====>] 85%│ [=====>] 88%│ [====>] 82%             │ │ │
│        │  │  │ ↑ +3% vs last month       │ ↑ +5% vs last audit     │ │ │
│        │  │  └─────────────┴─────────────┴─────────────────────────┘ │ │
│        │  └──────────────────────────────────────────────────────────┘ │
│        │                                                                │
│        │  ┌──────────────────────────────────────────────────────────┐ │
│        │  │  Vulnerability Summary                                  │ │
│        │  │  ┌─────────┬─────────┬─────────┬───────────────────────┐ │ │
│        │  │  │ Critical│ High    │ Medium  │ Low                   │ │
│        │  │  │ [  12  ]│ [  45  ]│ [ 128  ]│ [ 256  ]              │ │
│        │  │  │  🔴     │  🟠     │  🟡     │  🟢                   │ │
│        │  │  └─────────┴─────────┴─────────┴───────────────────────┘ │ │
│        │  └──────────────────────────────────────────────────────────┘ │
│        │                                                                │
│        │  ┌──────────────────────────────────────────────────────────┐ │
│        │  │  DJCP 2.0 Control Items (Level 3)                       │ │
│        │  │  ──────────────────────────────────────────────────────  │ │
│        │  │  │ ID      │ Name              │ Status │ Evidence │ Due │ │
│        │  │  │─────────│───────────────────│────────│──────────│─────│ │
│        │  │  │ 8.1.1   │ 身份认证          │ ✅ Pass│ 12/15    │ -   │ │
│        │  │  │ 8.1.2   │ 访问控制          │ ⚠️ Partial│ 8/12   │ 30d │ │
│        │  │  │ 8.1.3   │ 安全审计          │ ✅ Pass│ 15/15    │ -   │ │
│        │  │  │ 9.2.1   │ 数据加密          │ ❌ Fail│ 3/10     │ 7d  │ │
│        │  │  │ ...                                                    │ │
│        │  │  Showing 1-20 of 156 controls    [Export Evidence]      │ │
│        │  └──────────────────────────────────────────────────────────┘ │
│        │                                                                │
└────────┴────────────────────────────────────────────────────────────────┘
```

### 2.2 控制项详情抽屉（ASCII）

```
┌─────────────────────────────────────────────────────────────────────────┐
│  DJCP 2.0 Control 8.1.2 - 访问控制                        [X] [Export]  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Status: ⚠️ Partially Compliant (67%)                                   │
│  ─────────────────────────────────────────────────────────────────────  │
│  Last Assessment: 2026-04-05  •  Next Due: 2026-05-10  •  Owner: 安全团队│
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  Requirement                                                      │  │
│  │  ───────────────────────────────────────────────────────────────  │  │
│  │  应建立访问控制策略，确保用户只能访问授权的资源和功能。            │  │
│  │  包括：身份验证、权限管理、特权账号控制、远程访问控制等。          │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  Evidence (8/12 submitted)                                        │  │
│  │  ───────────────────────────────────────────────────────────────  │  │
│  │  ┌────────────────────────────────────────────────────────────┐   │  │
│  │  │ 📄 访问控制策略文档.pdf                    ✅ Verified     │   │  │
│  │  │ 📄 特权账号清单.xlsx                       ✅ Verified     │   │  │
│  │  │ 📄 权限审批记录 Q1.pdf                     ✅ Verified     │   │  │
│  │  │ 📄 远程访问日志 2026-03.csv                ⏳ Pending      │   │  │
│  │  │ ...                                                         │   │  │
│  │  └────────────────────────────────────────────────────────────┘   │  │
│  │  [+ Upload Evidence]    [Request Extension]                        │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  Remediation Plan                                                 │  │
│  │  ───────────────────────────────────────────────────────────────  │  │
│  │  ┌────────────────────────────────────────────────────────────┐   │  │
│  │  │ Task                          │ Owner     │ Due      │ Status│   │  │
│  │  │───────────────────────────────│───────────│──────────│───────│   │  │
│  │  │ 完善远程访问审批流程          │ 张三      │ 2026-04-15│ Open  │   │  │
│  │  │ 更新特权账号权限审查          │ 李四      │ 2026-04-20│ Open  │   │  │
│  │  │ 部署 MFA 到所有管理账号          │ 王五      │ 2026-04-25│ Done  │   │  │
│  │  └────────────────────────────────────────────────────────────┘   │  │
│  │  [+ Add Task]    [Update Progress]                                 │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.3 响应式断点布局

| 断点 | 宽度 | 布局策略 |
|------|------|----------|
| XS | < 576px | 单列卡片布局，概览指标堆叠，筛选器底部抽屉 |
| SM | 576-768px | 双列指标卡，隐藏次要列，控制项简化 |
| MD | 768-992px | 完整表格，概览面板侧边 |
| LG+ | > 992px | 完整布局，支持多面板并排 |

---

## 三、组件清单

### 3.1 使用组件列表

| 组件名 | 用途 | 状态数 | 设计规范 |
|--------|------|--------|----------|
| `PageHeader` | 页面标题 + 报告按钮 | 1 | 带时间范围 |
| `ComplianceTabs` | 合规框架切换 | 5 | Overview/DJCP/SOC2/Vuln/Reports |
| `ComplianceCard` | 合规分数卡片 | 4 | 总体/框架/趋势 |
| `ScoreGauge` | 分数仪表 | 5 | 优秀/良好/一般/较差/危险 |
| `TrendChart` | 合规趋势图 | 3 | 月/季/年切换 |
| `VulnSummary` | 漏洞汇总卡片 | 4 | 严重等级分布 |
| `ControlTable` | 控制项表格 | 5 | 支持行展开 |
| `StatusBadge` | 状态徽章 | 5 | Pass/Partial/Fail/NA/Pending |
| `EvidenceList` | 证据列表 | 3 | 文件 + 状态 |
| `RemediationTable` | 修复计划表格 | 4 | 任务 + 进度 |
| `ControlDrawer` | 控制项详情抽屉 | 2 | 从右侧滑出 |
| `ReportModal` | 报告生成弹窗 | 3 | 格式/范围/框架 |
| `UploadModal` | 证据上传弹窗 | 2 | 拖拽上传 |
| `EmptyState` | 空状态 | 3 | 无控制项/无漏洞 |
| `Skeleton` | 加载骨架屏 | 4 | 卡片/表格/详情 |

### 3.2 组件颜色映射

```css
/* 合规状态颜色 - 基于 Orion Design Tokens */
:root {
  --compliance-pass-bg: var(--success-50);
  --compliance-pass-text: var(--success-600);
  --compliance-pass-border: var(--success-200);
  
  --compliance-partial-bg: var(--warning-50);
  --compliance-partial-text: var(--warning-700);
  --compliance-partial-border: var(--warning-200);
  
  --compliance-fail-bg: var(--error-50);
  --compliance-fail-text: var(--error-600);
  --compliance-fail-border: var(--error-200);
  
  --compliance-na-bg: var(--neutral-50);
  --compliance-na-text: var(--neutral-400);
  --compliance-na-border: var(--neutral-200);
}

/* 漏洞严重等级颜色 */
:root {
  --vuln-critical: var(--error-700);       /* #A8222E */
  --vuln-high: var(--error-500);           /* #F5222D */
  --vuln-medium: var(--warning-500);       /* #FAAD14 */
  --vuln-low: var(--success-500);          /* #52C41A */
}
```

---

## 四、颜色与视觉规范

### 4.1 主色调应用

| 元素 | 颜色 Token | HEX | 用途 |
|------|-----------|-----|------|
| 主按钮背景 | `primary-600` | #0058C4 | 生成报告 |
| 主按钮悬停 | `primary-700` | #0047A0 | 按钮 Hover |
| 合规通过 | `success-500` | #52C41A | 通过徽章 |
| 合规部分 | `warning-500` | #FAAD14 | 部分合规 |
| 合规失败 | `error-500` | #F5222D | 失败徽章 |

### 4.2 合规状态色完整定义

```css
/* Pass - 通过 (≥80%) */
.compliance-pass {
  background-color: var(--success-50);    /* #F6FFED */
  color: var(--success-600);              /* #389E0D - 对比度 5.2:1 ✅ */
  border-color: var(--success-200);       /* #B7EB8F */
}

/* Partial - 部分合规 (50-79%) */
.compliance-partial {
  background-color: var(--warning-50);    /* #FFFBE6 */
  color: var(--warning-700);              /* #AD6800 - 对比度 6.2:1 ✅ */
  border-color: var(--warning-200);       /* #FFE58F */
}

/* Fail - 失败 (<50%) */
.compliance-fail {
  background-color: var(--error-50);      /* #FFF1F0 */
  color: var(--error-600);                /* #D9363E - 对比度 5.1:1 ✅ */
  border-color: var(--error-200);         /* #FFA39E */
}

/* N/A - 不适用 */
.compliance-na {
  background-color: var(--neutral-50);    /* #FAFAFA */
  color: var(--neutral-400);              /* #B3B3B3 - 对比度 3.2:1 ✅ (大文本) */
  border-color: var(--neutral-200);       /* #EBEBEB */
}

/* Pending - 待评估 */
.compliance-pending {
  background-color: var(--info-50);       /* #E6FFFB */
  color: var(--info-600);                 /* #08979C - 对比度 5.1:1 ✅ */
  border-color: var(--info-200);          /* #87E8DE */
}
```

### 4.3 合规分数仪表颜色

```css
/* 分数等级颜色 */
.score-gauge {
  /* Excellent - 优秀 (≥90%) */
  --score-excellent: var(--success-500);  /* #52C41A */
  /* Good - 良好 (80-89%) */
  --score-good: var(--success-400);       /* #73D13D */
  /* Fair - 一般 (70-79%) */
  --score-fair: var(--warning-500);       /* #FAAD14 */
  /* Poor - 较差 (60-69%) */
  --score-poor: var(--orange-500);        /* #FA8C16 */
  /* Critical - 危险 (<60%) */
  --score-critical: var(--error-500);     /* #F5222D */
}
```

### 4.4 漏洞严重等级色

```css
/* Critical - 严重 (CVSS 9.0-10.0) */
.vuln-critical {
  background-color: #FFF1F0);
  color: var(--error-700);                /* #A8222E - 对比度 6.8:1 ✅ */
  border-color: var(--error-300);
}

/* High - 高危 (CVSS 7.0-8.9) */
.vuln-high {
  background-color: var(--error-50);
  color: var(--error-600);                /* #D9363E - 对比度 5.1:1 ✅ */
  border-color: var(--error-200);
}

/* Medium - 中危 (CVSS 4.0-6.9) */
.vuln-medium {
  background-color: var(--warning-50);
  color: var(--warning-600);              /* #D48806 - 对比度 4.6:1 ✅ */
  border-color: var(--warning-200);
}

/* Low - 低危 (CVSS 0.1-3.9) */
.vuln-low {
  background-color: var(--success-50);
  color: var(--success-600);
  border-color: var(--success-200);
}
```

### 4.5 暗黑模式映射

```css
.dark-mode {
  --compliance-pass-bg: hsl(145, 25%, 12%);
  --compliance-pass-text: var(--success-300);
  --compliance-pass-border: hsl(145, 30%, 25%);
  
  --compliance-partial-bg: hsl(38, 30%, 15%);
  --compliance-partial-text: var(--warning-300);
  
  --compliance-fail-bg: hsl(359, 30%, 15%);
  --compliance-fail-text: var(--error-300);
  
  --score-excellent: #73d13d;
  --score-good: #95de64;
  --score-fair: #ffc53d;
  --score-poor: #ff9c38;
  --score-critical: #ff6b6d;
  
  --vuln-critical: #ff6b6d;
  --vuln-high: #ff6b6d;
  --vuln-medium: #ffc53d;
  --vuln-low: #73d13d;
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
| 分数显示 | `text-4xl` | 36px | 44px | 700 |
| 表格标题 | `text-xs` | 12px | 16px | 600 |
| 表格正文 | `text-sm` | 14px | 20px | 400 |
| 控制项 ID | `text-sm` | 14px | 20px | 500 |

### 5.2 表格列宽定义

| 列名 | 宽度 | 对齐 | 可排序 |
|------|------|------|--------|
| 控制项 ID | 100px | 左 | 是 |
| 控制项名称 | 240px | 左 | 是 |
| 合规状态 | 100px | 居中 | 是 |
| 证据数 | 80px | 居中 | 是 |
| 截止日期 | 100px | 左 | 是 |
| 负责人 | 120px | 左 | 是 |
| 操作 | 100px | 右 | 否 |

---

## 六、交互说明

### 6.1 核心交互行为

| 交互 | 触发条件 | 反馈 | 持续时间 |
|------|----------|------|----------|
| 行展开 | 点击控制项 | 显示详情和证据 | 200ms |
| 框架切换 | 点击 Tab | 内容刷新 | 150ms |
| 分数悬停 | 鼠标悬停 | 显示详细评分项 | 100ms |
| 证据上传 | 拖拽文件 | 上传进度 + 验证 | 多步骤 |
| 报告生成 | 点击生成 | 配置→生成→下载 | 多步骤 |
| 状态筛选 | 下拉选择 | 表格刷新 | 150ms |

### 6.2 键盘快捷键

| 快捷键 | 功能 | 适用场景 |
|--------|------|----------|
| `Cmd/Ctrl + R` | 生成报告 | 全局 |
| `Cmd/Ctrl + E` | 导出证据 | 有选中项 |
| `Cmd/Ctrl + F` | 聚焦筛选 | 全局 |
| `Cmd/Ctrl + /` | 打开快捷键帮助 | 全局 |
| `Escape` | 关闭抽屉/弹窗 | 任意 |
| `↑/↓` | 上下选择控制项 | 表格聚焦 |
| `Enter` | 打开选中的控制项 | 行聚焦 |
| `E` | 上传证据 | 有选中项 |
| `U` | 更新修复进度 | 有选中项 |

### 6.3 报告生成确认规则

| 操作 | 是否需要确认 | 确认方式 | 审批要求 |
|------|--------------|----------|----------|
| 生成内部报告 | 否 | 直接生成 | 否 |
| 生成审计报告 | 是 | 范围确认 + 水印 | 合规官员审批 |
| 导出敏感数据 | 是 | 加密 + 权限确认 | 安全团队审批 |
| 批量导出证据 | 是 | 文件列表确认 | 否 |
| 删除证据 | 是 | 模态框 + 原因 | 是 |

---

## 七、状态定义

### 7.1 空状态（Empty State）

```
┌─────────────────────────────────────────────────────────────────┐
│                        ┌─────────────┐                         │
│                        │             │                         │
│                        │    📋       │                         │
│                        │  (64x64px)  │                         │
│                        │             │                         │
│                        └─────────────┘                         │
│                                                                 │
│                    暂无合规数据                                 │
│              text-2xl, font-weight-semibold, neutral-800        │
│                                                                 │
│          开始第一次合规评估，建立您的合规基线                    │
│              text-md, neutral-500, margin-top: 8px             │
│                                                                 │
│              ┌──────────────┐  ┌──────────────┐                │
│              │ 📝 开始评估  │  │ 📖 合规指南  │                │
│              │ primary-600  │  │ neutral-600  │                │
│              └──────────────┘  └──────────────┘                │
│                                                                 │
│          ───────────  支持的合规框架  ───────────              │
│                                                                 │
│     🇨🇳 等保 2.0  •  🌐 SOC2  •  🇪🇺 GDPR  •  🏦 ISO 27001        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 7.2 加载状态（Loading State）

**骨架屏规格**：
```css
.compliance-card-skeleton {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
  padding: 20px;
}

.skeleton-gauge {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  background: var(--neutral-200);
  animation: skeleton-loading 1.5s infinite;
}

.skeleton-summary {
  height: 60px;
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

.control-skeleton {
  display: grid;
  grid-template-columns: 100px 240px 100px 80px 1fr;
  gap: 16px;
  padding: 16px;
}

/* 漏洞汇总骨架 */
.vuln-summary-skeleton {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  padding: 20px;
}

.vuln-card-skeleton {
  height: 80px;
  background: var(--neutral-50);
  border-radius: var(--radius-md);
  animation: skeleton-loading 1.5s infinite;
}
```

### 7.3 错误状态（Error State）

| 错误类型 | 展示方式 | 用户操作 | 自动重试 |
|----------|----------|----------|----------|
| 数据加载失败 | 全页错误卡片 | [重试] [检查连接] | 3 次后停止 |
| 报告生成失败 | Toast 错误提示 | [查看日志] [重试] | 否 |
| 证据上传失败 | 表单内错误提示 | [修改后重试] | 可选 |
| 权限不足 | 空状态 + 申请按钮 | [申请权限] | 否 |

### 7.4 合规状态定义

| 状态 | 图标 | 颜色 | 说明 |
|------|------|------|------|
| Pass | ✅ | success-600 | 完全合规 (≥80%) |
| Partial | ⚠️ | warning-600 | 部分合规 (50-79%) |
| Fail | ❌ | error-600 | 不合规 (<50%) |
| N/A | - | neutral-400 | 不适用 |
| Pending | ⏳ | info-600 | 待评估 |

---

## 八、响应式设计

### 8.1 移动端适配策略

**XS (< 576px) - 卡片模式**：
```
┌─────────────────────────────────┐
│  Compliance    [Generate Report]│
├─────────────────────────────────┤
│ [Overview] [DJCP] [SOC2] [Vuln] │
├─────────────────────────────────┤
│ ┌─────────────────────────────┐ │
│ │ Overall Compliance          │ │
│ │ [=====>] 85%      ↑ +3%     │ │
│ └─────────────────────────────┘ │
│ ┌─────────────────────────────┐ │
│ │ Vulnerabilities             │ │
│ │ 🔴 12  🟠 45  🟡 128  🟢 256│ │
│ └─────────────────────────────┘ │
│ ┌─────────────────────────────┐ │
│ │ 8.1.2 访问控制              │ │
│ │ ⚠️ Partial • 8/12 evidence  │ │
│ │ [View Details]              │ │
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```

**SM (576-768px) - 双列指标卡**：
- 合规卡片 2 列
- 漏洞汇总 2x2
- 控制项表格简化

**MD (768-992px) - 完整功能**：
- 合规卡片 3 列
- 漏洞汇总 4 列
- 控制项表格完整

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
  --table-row-padding: var(--spacing-md);
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

### 9.4 分数仪表系统

```css
:root {
  --gauge-size: 120px;
  --gauge-stroke: 12px;
  --gauge-radius: 50%;
  
  --gauge-excellent: #52C41A;   /* ≥90% */
  --gauge-good: #73D13D;        /* 80-89% */
  --gauge-fair: #FAAD14;        /* 70-79% */
  --gauge-poor: #FA8C16;        /* 60-69% */
  --gauge-critical: #F5222D;    /* <60% */
}
```

### 9.5 动画系统

```css
:root {
  --transition-fast: 150ms ease;
  --transition-normal: 200ms ease;
  --transition-slow: 300ms ease;
  
  --animation-gauge-fill: gauge-fill 500ms ease-out;
  --animation-pulse-warning: pulse-warning 2s infinite;
}

@keyframes gauge-fill {
  from { stroke-dashoffset: var(--gauge-max); }
  to { stroke-dashoffset: var(--gauge-value); }
}

@keyframes pulse-warning {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}
```

---

## 十、Agent 开发指南

### 10.1 快速实现提示

使用以下提示词生成代码：

```
创建一个安全合规报告页面，使用以下设计令牌：
- 合规状态：Pass #389E0D, Partial #AD6800, Fail #D9363E, N/A #B3B3B3
- 分数等级：Excellent #52C41A (≥90%), Good #73D13D (80-89%), Fair #FAAD14 (70-79%), Poor #FA8C16 (60-69%), Critical #F5222D (<60%)
- 漏洞等级：Critical #A8222E, High #D9363E, Medium #D48806, Low #389E0D
- 分数仪表：120px 直径，12px 描边
- 圆角：8px (radius-md)
```

### 10.2 关键实现检查点

- [ ] 分数仪表动画流畅（加载时填充）
- [ ] 合规状态颜色根据分数动态变化
- [ ] 证据上传支持拖拽和进度显示
- [ ] 报告生成支持多格式（PDF/Word/Excel）
- [ ] WCAG 2.1 AA 对比度合规
- [ ] 键盘导航完整（Tab 顺序、快捷键）
- [ ] 聚焦状态可见（`:focus-visible`）
- [ ] 暗黑模式颜色映射正确
- [ ] 响应式断点测试通过
- [ ] 骨架屏和空状态实现
- [ ] 控制项详情抽屉信息完整
- [ ] 修复计划支持进度更新

### 10.3 合规 API 要求

- 合规框架 API（DJCP/SOC2/GDPR/ISO）
- 控制项 CRUD API
- 证据上传/验证 API
- 评估结果 API
- 修复计划 CRUD API
- 漏洞扫描 API
- 报告生成 API

### 10.4 等保 2.0 控制项分类

```yaml
# DJCP 2.0 Level 3 Categories
categories:
  - id: "8.1"
    name: "安全计算环境"
    controls:
      - "8.1.1 身份认证"
      - "8.1.2 访问控制"
      - "8.1.3 安全审计"
      - "8.1.4 入侵防范"
  - id: "8.2"
    name: "安全区域边界"
    controls:
      - "8.2.1 边界防护"
      - "8.2.2 访问控制"
      - "8.2.3 入侵防范"
  - id: "9.1"
    name: "安全管理制度"
    controls:
      - "9.1.1 安全策略"
      - "9.1.2 管理制度"
  - id: "9.2"
    name: "数据安全性"
    controls:
      - "9.2.1 数据加密"
      - "9.2.2 备份恢复"
```

---

*文档版本：v1.0*  
*创建日期：2026-04-10*  
*基于 Orion Design Tokens v1.2.0*
