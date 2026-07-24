# Orion AI Skill 市场设计文档

> 版本：v1.0  
> 创建日期：2026-04-10  
> 设计师：Orion Design System Team  
> 适用范围：P1 核心功能 - AI 能力与智能分析模块

---

## 一、页面概述

### 1.1 页面定义

AI Skill 市场（AI Skill Marketplace）是 Orion 平台的 AI 能力发现与管理中心，用户在此浏览、安装、配置和评估各类 AI Skill（包括代码生成、测试生成、日志分析、异常检测等）。页面采用电商式浏览体验，兼顾专业评估数据和配置灵活性。

### 1.2 目标用户

| 角色 | 核心任务 | 使用频率 | 权限级别 |
|------|----------|----------|----------|
| AI 工程师 | 开发自定义 Skill、评估效果 | 高频（每日 10+ 次） | 完全访问 |
| 开发工程师 | 浏览/安装 Skill、查看使用效果 | 中频（每周 5-8 次） | 安装/使用 |
| 技术主管 | 查看 Skill 使用统计、成本分析 | 低频（每周 2-3 次） | 概览/只读 |
| 运维工程师 | 监控 Skill 健康、处理异常 | 中频（每周 3-5 次） | 监控/配置 |

### 1.3 设计原则

- **发现优先**：搜索、筛选、推荐三位一体
- **效果透明**：准确率、使用次数、用户评分公开展示
- **配置灵活**：支持全局配置和技能级个性化
- **评估驱动**：A/B 测试、效果对比数据可视化

---

## 二、布局结构

### 2.1 页面布局（ASCII）

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Top Navigation Bar                                                     │
├────────┬────────────────────────────────────────────────────────────────┤
│        │                                                                │
│ Side   │  ┌──────────────────────────────────────────────────────────┐ │
│ bar    │  │  AI Skill Marketplace                   [Register Skill] │ │
│        │  └──────────────────────────────────────────────────────────┘ │
│        │                                                                │
│        │  ┌──────────────────────────────────────────────────────────┐ │
│        │  │  🔍 Search skills...  [Category ▼] [Type ▼] [Rating ▼]  │ │
│        │  │  Tags: #code-gen #test #log-analysis [Clear All]        │ │
│        │  └──────────────────────────────────────────────────────────┘ │
│        │                                                                │
│        │  ┌──────────────────────────────────────────────────────────┐ │
│        │  │  Featured Skills                                        │ │
│        │  │  ┌─────────────┬─────────────┬─────────────┬──────────┐ │ │
│        │  │  │ CodeGen Pro │ Test Master │ Log Insight │ Anomaly  │ │ │
│        │  │  │ ⭐ 4.9      │ ⭐ 4.8      │ ⭐ 4.7      │ Detect   │ │ │
│        │  │  │ 12.5k uses  │ 8.2k uses   │ 5.6k uses   │ ⭐ 4.6   │ │ │
│        │  │  │ [Install]   │ [Install]   │ [Install]   │ [Install]│ │ │
│        │  │  └─────────────┴─────────────┴─────────────┴──────────┘ │ │
│        │  └──────────────────────────────────────────────────────────┘ │
│        │                                                                │
│        │  ┌──────────────────────────────────────────────────────────┐ │
│        │  │  All Skills                                             │ │
│        │  │  ──────────────────────────────────────────────────────  │ │
│        │  │  │ Name        │ Type     │ Accur. │ Uses  │ Rating   │ │
│        │  │  │─────────────│──────────│────────│───────│──────────│ │
│        │  │  │ CodeGen Pro │ Code Gen │ 94.2%  │ 12.5k │ ⭐⭐⭐⭐⭐  │ │
│        │  │  │ Test Master │ Test     │ 91.8%  │ 8.2k  │ ⭐⭐⭐⭐⭐  │ │
│        │  │  │ Log Insight │ Analysis │ 89.5%  │ 5.6k  │ ⭐⭐⭐⭐☆  │ │
│        │  │  │ Anomaly Det │ Monitor  │ 92.1%  │ 3.4k  │ ⭐⭐⭐⭐☆  │ │
│        │  │  │ ...                                                    │ │
│        │  │  Showing 1-20 of 156 skills    [My Skills] [Analytics]  │ │
│        │  └──────────────────────────────────────────────────────────┘ │
│        │                                                                │
└────────┴────────────────────────────────────────────────────────────────┘
```

### 2.2 Skill 详情布局（ASCII）

```
┌─────────────────────────────────────────────────────────────────────────┐
│  AI Skill Marketplace / CodeGen Pro                    [X] [Install]    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  CodeGen Pro                                        [Installed]   │  │
│  │  ───────────────────────────────────────────────────────────────  │  │
│  │  Generate high-quality code from natural language descriptions   │  │
│  │                                                                     │  │
│  │  ⭐ 4.9 (2,847 reviews)  •  📥 12,543 uses  •  👤 CodeOrion Team  │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌─────────────────┐  ┌─────────────────────────────────────────────┐  │
│  │  Overview       │  │  Performance Metrics                        │  │
│  │  Configuration  │  │  ─────────────────────────────────────────  │  │
│  │  Usage Stats    │  │  Accuracy:     [████████░░] 94.2%          │  │
│  │  Reviews (847)  │  │  Completion:   [███████░░░] 87.5%          │  │
│  │                 │  │  Satisfaction: [█████████░] 96.1%          │  │
│  │                 │  │                                              │  │
│  │                 │  │  ┌──────────────────────────────────────┐   │  │
│  │                 │  │  │  Usage Trend (Last 30 days)          │   │  │
│  │                 │  │  │  [Line Chart]                        │   │  │
│  │                 │  │  └──────────────────────────────────────┘   │  │
│  └─────────────────┘  └─────────────────────────────────────────────┘  │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  Input/Output Schema                                              │  │
│  │  ───────────────────────────────────────────────────────────────  │  │
│  │  Input:  { prompt: string, language: string, style?: string }    │  │
│  │  Output: { code: string, explanation: string, confidence: number }│  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  Configuration                                                    │  │
│  │  ───────────────────────────────────────────────────────────────  │  │
│  │  Model Selection:  [GPT-4 ▼]  Temperature: [0.7 ────○────]       │  │
│  │  Max Tokens: [2048]        Timeout: [30s]                        │  │
│  │  ┌────────────────────────────────────────────────────────────┐   │  │
│  │  │ Save Configuration    [Reset to Default]    [Test Skill]   │   │  │
│  │  └────────────────────────────────────────────────────────────┘   │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.3 响应式断点布局

| 断点 | 宽度 | 布局策略 |
|------|------|----------|
| XS | < 576px | 单列卡片布局，指标折叠，筛选器底部抽屉 |
| SM | 576-768px | 双列卡片，隐藏次要指标，简化视图 |
| MD | 768-992px | 完整表格，指标面板侧边 |
| LG+ | > 992px | 完整布局，支持多面板并排 |

---

## 三、组件清单

### 3.1 使用组件列表

| 组件名 | 用途 | 状态数 | 设计规范 |
|--------|------|--------|----------|
| `PageHeader` | 页面标题 + 注册按钮 | 1 | 带统计信息 |
| `SkillSearch` | Skill 搜索框 | 4 | 支持语义搜索 |
| `CategoryFilter` | 分类筛选器 | 5 | 多选 + 标签 |
| `SkillCard` | Skill 卡片 | 4 | Featured/Normal/Installed/Disabled |
| `SkillTable` | Skill 数据表格 | 5 | 支持排序 |
| `RatingDisplay` | 评分显示 | 3 | 星星 + 数值 |
| `AccuracyBadge` | 准确率徽章 | 4 | 优秀/良好/一般/较差 |
| `UsageCounter` | 使用次数计数 | 2 | 数字 + 趋势 |
| `SkillDrawer` | Skill 详情抽屉 | 2 | 从右侧滑出 |
| `MetricsPanel` | 性能指标面板 | 3 | 仪表 + 图表 |
| `UsageChart` | 使用趋势图 | 2 | 7d/30d 切换 |
| `ConfigForm` | 配置表单 | 3 | 动态字段 |
| `InstallModal` | 安装确认弹窗 | 2 | 权限/资源提示 |
| `TestPanel` | Skill 测试面板 | 2 | 输入/输出 |
| `EmptyState` | 空状态 | 3 | 无 Skill/无搜索结果 |
| `Skeleton` | 加载骨架屏 | 4 | 卡片/表格/详情 |

### 3.2 组件颜色映射

```css
/* 准确率等级颜色 - 基于 Orion Design Tokens */
:root {
  --accuracy-excellent-bg: var(--success-50);
  --accuracy-excellent-text: var(--success-700);
  --accuracy-excellent-border: var(--success-300);
  
  --accuracy-good-bg: var(--info-50);
  --accuracy-good-text: var(--info-700);
  --accuracy-good-border: var(--info-300);
  
  --accuracy-fair-bg: var(--warning-50);
  --accuracy-fair-text: var(--warning-700);
  --accuracy-fair-border: var(--warning-300);
  
  --accuracy-poor-bg: var(--error-50);
  --accuracy-poor-text: var(--error-600);
  --accuracy-poor-border: var(--error-200);
}

/* Skill 类型颜色 */
:root {
  --type-code-gen: var(--primary-500);      /* #0070F3 */
  --type-test: var(--success-500);          /* #52C41A */
  --type-analysis: var(--info-500);         /* #13C2C2 */
  --type-monitor: var(--warning-500);       /* #FAAD14 */
  --type-security: var(--error-500);        /* #F5222D */
  --type-custom: var(--neutral-500);        /* #8C8C8C */
}
```

---

## 四、颜色与视觉规范

### 4.1 主色调应用

| 元素 | 颜色 Token | HEX | 用途 |
|------|-----------|-----|------|
| 主按钮背景 | `primary-600` | #0058C4 | 安装/注册 Skill |
| 主按钮悬停 | `primary-700` | #0047A0 | 按钮 Hover |
| 已安装状态 | `success-500` | #52C41A | 已安装徽章 |
| 评分星星 | `warning-500` | #FAAD14 | 填充星星 |
| 准确率优秀 | `success-600` | #389E0D | 准确率徽章 |

### 4.2 准确率等级完整定义

```css
/* Excellent - 优秀 (≥90%) */
.accuracy-excellent {
  background-color: var(--success-50);    /* #F6FFED */
  color: var(--success-700);              /* #237804 - 对比度 7.1:1 ✅ */
  border-color: var(--success-300);       /* #95DE64 */
}

/* Good - 良好 (80-89%) */
.accuracy-good {
  background-color: var(--info-50);       /* #E6FFFB */
  color: var(--info-700);                 /* #006D75 - 对比度 5.8:1 ✅ */
  border-color: var(--info-300);          /* #57D0C6 */
}

/* Fair - 一般 (70-79%) */
.accuracy-fair {
  background-color: var(--warning-50);    /* #FFFBE6 */
  color: var(--warning-700);              /* #AD6800 - 对比度 6.2:1 ✅ */
  border-color: var(--warning-300);       /* #FFD666 */
}

/* Poor - 较差 (<70%) */
.accuracy-poor {
  background-color: var(--error-50);      /* #FFF1F0 */
  color: var(--error-600);                /* #D9363E - 对比度 5.1:1 ✅ */
  border-color: var(--error-200);         /* #FFA39E */
}
```

### 4.3 评分星星颜色

```css
/* 星星颜色定义 */
.rating-stars {
  --star-filled: var(--warning-500);      /* #FAAD14 */
  --star-empty: var(--neutral-300);       /* #D9D9D9 */
  --star-half: linear-gradient(
    90deg,
    var(--warning-500) 50%,
    var(--neutral-300) 50%
  );
}

/* 评分数值颜色 */
.rating-value {
  color: var(--neutral-800);              /* #333333 */
  font-weight: var(--font-weight-semibold);
}
```

### 4.4 Skill 类型标签色

```css
/* 代码生成类 */
.type-code-gen {
  background-color: var(--primary-50);
  color: var(--primary-600);
  border-color: var(--primary-200);
}

/* 测试类 */
.type-test {
  background-color: var(--success-50);
  color: var(--success-600);
  border-color: var(--success-200);
}

/* 分析类 */
.type-analysis {
  background-color: var(--info-50);
  color: var(--info-600);
  border-color: var(--info-200);
}

/* 监控类 */
.type-monitor {
  background-color: var(--warning-50);
  color: var(--warning-600);
  border-color: var(--warning-200);
}

/* 安全类 */
.type-security {
  background-color: var(--error-50);
  color: var(--error-600);
  border-color: var(--error-200);
}

/* 自定义类 */
.type-custom {
  background-color: var(--neutral-50);
  color: var(--neutral-600);
  border-color: var(--neutral-200);
}
```

### 4.5 暗黑模式映射

```css
.dark-mode {
  --accuracy-excellent-bg: hsl(145, 25%, 12%);
  --accuracy-excellent-text: var(--success-300);
  --accuracy-excellent-border: hsl(145, 30%, 25%);
  
  --accuracy-good-bg: hsl(200, 25%, 12%);
  --accuracy-good-text: var(--info-300);
  
  --accuracy-fair-bg: hsl(38, 30%, 15%);
  --accuracy-fair-text: var(--warning-300);
  
  --rating-star-filled: #ffc53d;
  --rating-star-empty: #4a4a4a;
  
  --type-code-gen: #40a9ff;
  --type-test: #73d13d;
  --type-analysis: #36cfc9;
  --type-monitor: #ffc53d;
  --type-security: #ff6b6d;
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
| Skill 描述 | `text-md` | 16px | 24px | 400 |
| 表格标题 | `text-xs` | 12px | 16px | 600 |
| 表格正文 | `text-sm` | 14px | 20px | 400 |
| 评分数值 | `text-lg` | 18px | 28px | 600 |
| 准确率 | `text-xl` | 20px | 28px | 600 |

### 5.2 表格列宽定义

| 列名 | 宽度 | 对齐 | 可排序 |
|------|------|------|--------|
| 名称 | 200px | 左 | 是 |
| 类型 | 120px | 左 | 是 |
| 准确率 | 100px | 左 | 是 |
| 使用次数 | 100px | 右 | 是 |
| 评分 | 120px | 左 | 是 |
| 状态 | 80px | 居中 | 是 |
| 操作 | 120px | 右 | 否 |

---

## 六、交互说明

### 6.1 核心交互行为

| 交互 | 触发条件 | 反馈 | 持续时间 |
|------|----------|------|----------|
| Skill 卡片悬停 | 鼠标进入 | 卡片上浮 + 阴影 | 150ms |
| 点击卡片 | 点击 | 右侧抽屉滑出 | 300ms |
| 安装 Skill | 点击安装 | 确认→执行→成功提示 | 500ms+API |
| 配置 Skill | 点击配置 | 表单展开 | 200ms |
| 测试 Skill | 点击测试 | 测试面板展开 | 250ms |
| 评分筛选 | 下拉选择 | 列表刷新 | 150ms |
| 收藏 Skill | 点击星形 | 星形填充动画 | 200ms |

### 6.2 键盘快捷键

| 快捷键 | 功能 | 适用场景 |
|--------|------|----------|
| `Cmd/Ctrl + K` | 聚焦搜索框 | 全局 |
| `Cmd/Ctrl + N` | 注册新 Skill | 全局 |
| `Cmd/Ctrl + I` | 打开已安装列表 | 全局 |
| `Cmd/Ctrl + /` | 打开快捷键帮助 | 全局 |
| `Escape` | 关闭抽屉/弹窗 | 任意 |
| `↑/↓` | 上下选择 Skill | 列表聚焦 |
| `Enter` | 打开选中的 Skill | 行聚焦 |
| `I` | 安装选中的 Skill | 有选中项 |
| `C` | 配置选中的 Skill | 已安装 |
| `F` | 收藏/取消收藏 | 有选中项 |

### 6.3 安装确认规则

| 操作 | 是否需要确认 | 确认方式 | 资源影响 |
|------|--------------|----------|----------|
| 安装免费 Skill | 否 | 直接安装 | 无 |
| 安装付费 Skill | 是 | 确认价格 + 余额 | 扣除配额 |
| 安装高资源 Skill | 是 | 资源警告 + 确认 | CPU/内存增加 |
| 批量安装 (≥3) | 是 | 列表确认 | 累积资源 |
| 卸载 Skill | 是 | 确认数据保留 | 配置保留 |

---

## 七、状态定义

### 7.1 空状态（Empty State）

```
┌─────────────────────────────────────────────────────────────────┐
│                        ┌─────────────┐                         │
│                        │             │                         │
│                        │    🤖       │                         │
│                        │  (64x64px)  │                         │
│                        │             │                         │
│                        └─────────────┘                         │
│                                                                 │
│                    暂无 AI Skill                                │
│              text-2xl, font-weight-semibold, neutral-800        │
│                                                                 │
│          浏览 Skill 市场，发现适合你的 AI 能力                   │
│              text-md, neutral-500, margin-top: 8px             │
│                                                                 │
│              ┌──────────────┐  ┌──────────────┐                │
│              │ 🛒 浏览市场  │  │ 📝 注册 Skill │                │
│              │ primary-600  │  │ neutral-600  │                │
│              └──────────────┘  └──────────────┘                │
│                                                                 │
│          ───────────  热门分类  ───────────                    │
│                                                                 │
│     📝 代码生成  •  🧪 测试生成  •  📊 日志分析  •  🔍 异常检测  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 7.2 加载状态（Loading State）

**骨架屏规格**：
```css
.skill-card-skeleton {
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

/*  Featured 轮播骨架 */
.featured-skeleton {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
  margin-bottom: 24px;
}
```

**加载行数**：显示 8 个卡片骨架屏（2 行×4 列）

### 7.3 错误状态（Error State）

| 错误类型 | 展示方式 | 用户操作 | 自动重试 |
|----------|----------|----------|----------|
| 数据加载失败 | 全页错误卡片 | [重试] [检查连接] | 3 次后停止 |
| 安装失败 | Toast 错误提示 | [查看日志] [重试] | 否 |
| 配置保存失败 | 表单内错误提示 | [修改后重试] | 否 |
| 测试超时 | 测试面板错误 | [调整参数] [重试] | 可选 |
| 权限不足 | 空状态 + 申请按钮 | [申请权限] | 否 |

### 7.4 Skill 状态定义

| 状态 | 徽章颜色 | 说明 | 可操作 |
|------|----------|------|--------|
| Available | success-500 | 可用 | 安装 |
| Installed | primary-500 | 已安装 | 配置/卸载 |
| Disabled | neutral-400 | 已禁用 | 启用 |
| Deprecated | error-500 | 已废弃 | 迁移 |
| Updating | warning-500 | 更新中 | 等待 |

---

## 八、响应式设计

### 8.1 移动端适配策略

**XS (< 576px) - 卡片模式**：
```
┌─────────────────────────────────┐
│  AI Skills        [+ Register]  │
├─────────────────────────────────┤
│ 🔍 Search skills...             │
│ [Category ▼] [Type ▼]           │
├─────────────────────────────────┤
│ ┌─────────────────────────────┐ │
│ │ CodeGen Pro          ⭐ 4.9 │ │
│ │ Code Generation • 94.2%     │ │
│ │ 12.5k uses • [Install]     │ │
│ └─────────────────────────────┘ │
│ ┌─────────────────────────────┐ │
│ │ Test Master          ⭐ 4.8 │ │
│ │ Test Generation • 91.8%     │ │
│ │ 8.2k uses • [Install]      │ │
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
- 指标面板侧边

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
  
  /* Skill 卡片悬停阴影 */
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
```

### 9.5 指标进度条

```css
:root {
  --metric-height: 8px;
  --metric-radius: 4px;
  
  --metric-excellent: var(--success-500);   /* ≥90% */
  --metric-good: var(--info-500);           /* 80-89% */
  --metric-fair: var(--warning-500);        /* 70-79% */
  --metric-poor: var(--error-500);          /* <70% */
}
```

---

## 十、Agent 开发指南

### 10.1 快速实现提示

使用以下提示词生成代码：

```
创建一个 AI Skill 市场页面，使用以下设计令牌：
- 准确率等级：Excellent #237804 (≥90%), Good #006D75 (80-89%), Fair #AD6800 (70-79%), Poor #D9363E (<70%)
- Skill 类型色：Code-Gen #0070F3, Test #52C41A, Analysis #13C2C2, Monitor #FAAD14, Security #F5222D
- 评分星星：填充 #FAAD14, 空白 #D9D9D9
- 卡片悬停：上浮 4px + shadow-lg
- 圆角：8px (radius-md)
```

### 10.2 关键实现检查点

- [ ] Skill 卡片悬停动画流畅
- [ ] 评分星星支持半颗星显示
- [ ] 准确率颜色根据数值动态变化
- [ ] 安装确认提示资源影响
- [ ] WCAG 2.1 AA 对比度合规
- [ ] 键盘导航完整（Tab 顺序、快捷键）
- [ ] 聚焦状态可见（`:focus-visible`）
- [ ] 暗黑模式颜色映射正确
- [ ] 响应式断点测试通过
- [ ] 骨架屏和空状态实现
- [ ] 测试面板支持实时输出
- [ ] 配置表单支持动态字段

### 10.3 Skill API 要求

- Skill 注册 API（元数据、schema、端点）
- Skill 安装/卸载 API
- Skill 配置 CRUD API
- Skill 测试执行 API
- 使用统计 API（次数、成功率、延迟）
- 效果评估 API（准确率、满意度）
- 批量操作 API

### 10.4 Skill 元数据 schema

```yaml
name: codegen-pro
version: 1.2.0
type: code-generation
description: Generate high-quality code from natural language
author: CodeOrion Team
rating: 4.9
uses: 12543
metrics:
  accuracy: 94.2
  completion: 87.5
  satisfaction: 96.1
input:
  type: object
  properties:
    prompt: { type: string }
    language: { type: string, enum: [typescript, python, go] }
    style: { type: string }
output:
  type: object
  properties:
    code: { type: string }
    explanation: { type: string }
    confidence: { type: number }
config:
  model: { type: string, default: "gpt-4" }
  temperature: { type: number, default: 0.7, min: 0, max: 1 }
  maxTokens: { type: number, default: 2048 }
  timeout: { type: string, default: "30s" }
```

---

*文档版本：v1.0*  
*创建日期：2026-04-10*  
*基于 Orion Design Tokens v1.2.0*
