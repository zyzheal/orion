# ChatOps 默认看板设计文档

> 日期: 2026-05-19
> 状态: 已确认
> 分支: feat/frontend-gap-implementation

## 1. 需求背景

当前 `/console/chatops` 页面仅包含对话工作台（聊天界面），用户进入后只能看到空白的对话输入区域，缺乏对 ChatOps 使用情况的数据洞察。需要增加默认看板，展示执行统计、趋势分析等数据，让用户一进入页面就能了解 ChatOps 的运行状态。

## 2. 设计方案

### 2.1 页面结构

采用 Tab 分页结构，将 ChatOps 页面分为 4 个子页面：

| Tab | 标题 | 内容 | 加载策略 |
|-----|------|------|----------|
| 1 | 总览看板 | 指标卡片 + 趋势图 + 热门命令 + 平台分布 + 最近执行 | 预加载 |
| 2 | 对话工作台 | 现有 ChatOps 对话界面 | 预加载 |
| 3 | 执行记录 | 现有 ExecutionDashboard | 预加载 |
| 4 | 审计日志 | 现有 AuditLogViewer | 懒加载 |

### 2.2 总览看板布局

```
┌─────────────────────────────────────────────────────────────┐
│  [时间选择器: 7天 | 30天 | 本月 | 自定义]           [刷新]   │
├─────────────┬─────────────┬─────────────┬───────────────────┤
│  总执行数    │   成功率     │   失败数     │   平均响应时间     │
│   128 ↑12%  │   94% ↑3%   │   8 ↓5%     │   4.2s ↓0.8s     │
├─────────────┴─────────────┴─────────────┴───────────────────┤
│ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐ │
│ │  活跃度趋势      │ │  热门命令 TOP5  │ │  平台分布        │ │
│ │  (柱状图)        │ │  (列表+进度条)   │ │  (饼图)         │ │
│ │                 │ │                 │ │  用户活跃排行    │ │
│ └─────────────────┘ └─────────────────┘ └─────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│  最近执行记录 (最近5条)                                      │
│  ┌────────┬────────┬────────┬────────┬────────┬────────┐   │
│  │ 命令    │ 平台    │ 用户    │ 状态    │ 时间    │ 操作   │   │
│  └────────┴────────┴────────┴────────┴────────┴────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 2.3 指标定义

| 指标 | 计算方式 | 数据源 |
|------|----------|--------|
| 总执行数 | count(executions) where status IN (all) | ChatOpsExecutionRepository |
| 成功率 | count(status='completed') / count(all) * 100 | ChatOpsExecutionRepository |
| 失败数 | count(status='failed') | ChatOpsExecutionRepository |
| 平均响应时间 | avg(endTime - startTime) where status='completed' | ChatOpsExecutionRepository |
| 环比变化 | (本期值 - 上期值) / 上期值 * 100 | 同上，对比前一个时间窗口 |

### 2.4 时间范围

- **7天**（默认）— 日粒度
- **30天** — 日粒度
- **本月** — 日粒度（从本月1日到今天）
- **自定义** — 日期范围选择器，最小粒度日，最大跨度90天

### 2.5 加载策略

- **预加载**：页面首次渲染时同时请求总览看板和执行记录的数据
- **懒加载**：审计日志 Tab 在用户首次切换到该 Tab 时才请求数据
- **切换时间范围**：总览看板显示 loading skeleton，避免数据跳变

## 3. 技术实现

### 3.1 前端变更

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `orion-frontend/src/pages/ChatOps/index.tsx` | 重构 | 改为 Tab 容器，拆分现有内容为子组件 |
| `orion-frontend/src/pages/ChatOps/ChatDashboard.tsx` | 新建 | 总览看板组件 |
| `orion-frontend/src/pages/ChatOps/ChatOpsSettings.tsx` | 保留 | 已有，作为 Tab 4 内容 |
| `orion-frontend/src/api/chatops.ts` | 新增 | 添加 `getDashboardStats()` API 调用 |
| `orion-frontend/src/tokens/` | 确认 | 复用现有 Design Token 配色 |

### 3.2 后端变更

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `orion-platform-service/src/api/chatops-routes.ts` | 新增路由 | `GET /dashboard/stats` |
| `orion-platform-service/src/services/chatops/DashboardService.ts` | 新建 | 聚合统计服务 |
| `orion-platform-service/src/repositories/ChatOpsRepository.ts` | 新增方法 | `getStatsByTimeRange()`, `getTopCommands()`, `getPlatformDistribution()` |

### 3.3 后端 API 设计

```
GET /api/v1/chatops/dashboard/stats?range=7d|30d|month|custom&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD

Response:
{
  "metrics": {
    "totalExecutions": 128,
    "successRate": 94,
    "failedCount": 8,
    "avgResponseTime": 4.2
  },
  "trends": [
    { "date": "2026-05-13", "executions": 15, "successRate": 93 },
    ...
  ],
  "topCommands": [
    { "command": "deploy", "count": 72, "successRate": 96 },
    ...
  ],
  "platformDistribution": [
    { "platform": "web", "count": 56 },
    ...
  ],
  "recentExecutions": [
    { "id": "...", "commandId": "deploy", "status": "completed", "startTime": "..." },
    ...
  ],
  "comparison": {
    "totalExecutions": 12,
    "successRate": 3,
    "failedCount": -5,
    "avgResponseTime": -0.8
  }
}
```

### 3.4 图表库选型

使用项目已有的 **echarts** + **echarts-for-react**（已在 `package.json` 中），无需额外依赖。

## 4. 交互设计

### 4.1 交互细节

| 元素 | 交互行为 |
|------|----------|
| 指标卡片 | Hover 显示 tooltip（计算口径说明） |
| 趋势图 | 鼠标悬停柱状图显示具体数值和日期 |
| 热门命令 | 点击命令名跳转到"执行记录"Tab 并自动过滤该命令 |
| 最近执行 | 点击行展开查看执行详情 |
| 时间切换 | 切换时显示 loading skeleton，避免数据跳变 |
| 空状态 | 无数据时显示引导提示 |

### 4.2 响应式降级

| 屏幕宽度 | 布局调整 |
|----------|----------|
| ≥ 1200px | 三栏布局（趋势图:热门命令:平台分布 = 2:1:1） |
| 768px-1199px | 两栏布局，平台分布移到下方 |
| < 768px | 单栏垂直堆叠 |

## 5. 错误处理

| 场景 | 处理方式 |
|------|----------|
| 后端不可用 | 显示 Empty 组件 + "后端服务暂不可用" + 刷新按钮 |
| 数据加载中 | 显示 Skeleton 组件（卡片骨架屏 + 表格骨架屏） |
| 自定义范围超限 | 前端校验，最大跨度 90 天，超限提示 |
| 接口超时 | 10 秒超时，重试 1 次，失败后显示错误提示 |

## 6. 测试策略

| 测试类型 | 测试内容 |
|----------|----------|
| 单元测试 | DashboardService 聚合逻辑、环比计算 |
| 组件测试 | ChatDashboard 渲染、时间切换交互、空状态 |
| 集成测试 | GET /dashboard/stats 端点响应格式 |
| E2E 测试 | 页面加载 → 指标展示 → Tab 切换 → 数据过滤 |
