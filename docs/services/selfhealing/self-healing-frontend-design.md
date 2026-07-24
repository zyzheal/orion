# 自愈引擎 Kintsugi - 前端设计文档

## 页面结构

| 路由 | 页面 | 说明 |
|------|------|------|
| `/self-healing` | 主布局 | 侧边栏菜单导航 |
| `/self-healing/incidents` | 事件列表 | 当前告警事件 |
| `/self-healing/incidents/:id` | 事件详情 | 时间线视图 |
| `/self-healing/history` | 自愈历史 | 可过滤历史记录 |
| `/self-healing/strategies` | 策略管理 | 策略列表 |
| `/self-healing/strategies/:id` | 策略详情 | 动作列表构建器 |
| `/self-healing/approvals` | 审批队列 | 待审批操作 |
| `/self-healing/approvals/:id` | 审批详情 | 详情 + 审批操作 |
| `/self-healing/effectiveness` | 效果仪表盘 | MTTR、成功率等指标 |

## 组件清单

`SelfHealingLayout` — 页面骨架
`IncidentList` — 事件列表表格 + 类型/严重级别过滤
`IncidentDetail` — 事件详情 + 时间线
`IncidentTimeline` — 事件处理时间线（告警接收 → 策略匹配 → 审批 → 执行 → 结果）
`HealingHistory` — 自愈历史表格 + 日期范围选择器
`StrategyList` — 策略表格 + 置信度展示
`StrategyModal` — 策略创建/编辑（动作列表动态增减）
`StrategyDetail` — 策略详情（展开显示动作详情）
`ApprovalQueue` — 审批队列（优先级排序 + 内联审批按钮）
`ApprovalDetail` — 审批详情 + 原因输入框
`ApprovalResponseModal` — 审批响应弹窗
`EffectivenessDashboard` — 效果仪表盘（统计卡片 + 趋势图表）

## API 契约

基础路径：`/api/v1/self-healing`

### 事件
```
POST   /v1/self-healing/incidents         # 创建事件 (body: type, severity, appName, environment)
GET    /v1/self-healing/incidents/:id     # 事件详情
```

### 历史
```
GET    /v1/self-healing/history?appName=&environment=&type=&status=&startDate=&endDate=  # 列表
```

### 效果
```
GET    /v1/self-healing/effectiveness?appName=&startDate=&endDate=  # 指标
```

### 策略
```
GET    /v1/self-healing/strategies         # 全部策略
GET    /v1/self-healing/strategies/:id     # 策略详情
POST   /v1/self-healing/strategies         # 注册自定义策略
POST   /v1/self-healing/strategies/:id/toggle  # 启用/禁用
```

### 审批
```
GET    /v1/self-healing/approvals?status=  # 审批列表
GET    /v1/self-healing/approvals/:id      # 审批详情
POST   /v1/self-healing/approvals/:id/respond  # 审批响应 (body: approved, reason)
```

## 数据流

```
API (axios via api/self-healing.ts)
  -> useEffect 触发请求
  -> useState 管理 loading/data/error
  -> Ant Design 组件渲染
```

效果页面将数据聚合为统计卡片。审批队列使用定时轮询或 WebSocket 实时更新。

## UI 布局

- **事件**: 表格 + 类型徽章 + 严重级别颜色编码（critical=红, warning=橙, info=蓝）
- **事件详情**: 时间线视图（告警 → 策略匹配 → 审批 → 执行 → 结果），可展开查看动作详情
- **历史**: 可过滤表格 + 日期范围选择器
- **策略**: 表格（名称、触发类型、置信度、启用状态、动作数）；可展开行显示动作详情
- **审批**: 队列布局（优先级排序）+ 内联审批/拒绝按钮
- **效果**: Statistic 卡片（自愈率、平均 MTTR、总事件数、成功率）+ 趋势图表

## 关键交互

- 手动创建事件：表单带类型/严重级别选择器
- 策略注册：表单带动作列表构建器（动态添加/删除动作）
- 审批响应：带原因输入框 + 批准/拒绝按钮
- 策略切换：即时视觉反馈
- 历史/效果页面：日期范围过滤

## API 客户端文件

`orion-frontend/src/api/self-healing.ts` — 约 13 个函数。
