# 监控可观测性 - 前端设计文档

## 页面结构

| 路由 | 页面 | 说明 |
|------|------|------|
| `/monitoring` | 主布局 | 侧边栏菜单导航 |
| `/monitoring/dashboard` | 监控仪表盘 | 指标概览 |
| `/monitoring/metrics` | 指标管理 | 已注册指标列表 |
| `/monitoring/metrics/:name` | 指标详情 | 时序图表 |
| `/monitoring/alerts` | 告警列表 | 活跃/历史告警 |
| `/monitoring/alerts/:id` | 告警详情 | 触发详情 + 处理记录 |
| `/monitoring/rules` | 告警规则 | 规则列表 + 条件构建器 |
| `/monitoring/rules/:id` | 规则详情 | 规则编辑 |
| `/monitoring/channels` | 通知渠道 | 渠道管理 |
| `/monitoring/escalation` | 升级策略 | 升级策略管理 |
| `/monitoring/notifications` | 通知历史 | 发送记录 |

## 组件清单

`MonitoringLayout` — 页面骨架
`MonitoringDashboard` — 仪表盘（摘要卡片 + 指标图表 + 活跃告警列表）
`MetricList` — 指标列表表格
`MetricDetail` — 指标详情 + 时序折线图
`MetricChart` — 可复用时序图表组件
`AlertList` — 告警表格 + 严重级别颜色编码
`AlertDetail` — 告警详情 + 触发时间线
`AlertRuleList` — 规则表格 + 条件展示
`AlertRuleModal` — 规则创建/编辑（条件构建器）
`NotificationChannelList` — 渠道列表
`ChannelModal` — 渠道创建/编辑（类型专属表单）
`EscalationPolicyList` — 升级策略列表
`EscalationPolicyModal` — 升级策略表单
`NotificationHistory` — 通知发送记录表格
`AnomalyDetector` — 异常检测结果展示
`WidgetConfig` — 仪表盘小组件配置

## API 契约

基础路径：`/api/v1/monitoring`

### 服务控制
```
POST   /v1/monitoring/start|stop           # 启动/停止监控
GET    /v1/monitoring/health               # 健康检查
```

### 指标
```
GET    /v1/monitoring/metrics                          # 已注册指标
POST   /v1/monitoring/metrics                          # 上报指标
POST   /v1/monitoring/metrics/register                 # 注册指标
GET    /v1/monitoring/metrics/:name/series?t=&start=&end=  # 时序数据
GET    /v1/monitoring/metrics/:name/summary            # 摘要数据
POST   /v1/monitoring/collect                          # 采集系统指标
```

### 告警规则
```
GET    /v1/monitoring/rules                             # 全部规则
POST   /v1/monitoring/rules                             # 创建规则
GET/PUT/DELETE /v1/monitoring/rules/:id                 # 单条 CRUD
PATCH  /v1/monitoring/rules/:id/toggle                  # 启用/禁用
POST   /v1/monitoring/rules/evaluate                    # 手动评估
POST   /v1/monitoring/rules/:id/suppress|unsuppress     # 抑制/取消抑制
```

### 告警
```
GET    /v1/monitoring/alerts?status=&severity=          # 列表
GET    /v1/monitoring/alerts/active                     # 活跃告警
GET    /v1/monitoring/alerts/:id                        # 详情
POST   /v1/monitoring/alerts/:id/acknowledge            # 确认
POST   /v1/monitoring/alerts/:id/resolve                # 解决
POST   /v1/monitoring/alerts/:id/escalate               # 升级
```

### 渠道与升级
```
GET/POST   /v1/monitoring/channels                      # 渠道 CRUD
PATCH      /v1/monitoring/channels/:id/toggle           # 启用/禁用
GET/POST   /v1/monitoring/escalation                    # 升级策略 CRUD
```

### 通知与仪表盘
```
GET    /v1/monitoring/notifications?alertId=&status=    # 通知历史
GET    /v1/monitoring/dashboard                         # 仪表盘数据
GET/POST /v1/monitoring/dashboard/widgets               # 小组件配置
GET    /v1/monitoring/dashboard/aggregated              # 聚合指标
GET    /v1/monitoring/anomalies?metric=&threshold=      # 异常检测
GET    /v1/monitoring/anomalies/summary                 # 异常摘要
```

## 数据流

```
API (axios via api/monitoring.ts)
  -> useEffect 触发请求
  -> useState 管理 loading/data/error
  -> Ant Design + 图表库 (ECharts/AntV G2) 渲染
```

仪表盘使用聚合数据渲染图表。指标详情页使用时序数据渲染折线图。

## UI 布局

- **仪表盘**: 摘要卡片行（活跃告警数、总指标数、异常数、系统健康度）+ 指标图表 + 活跃告警列表
- **指标**: 表格展示已注册指标，点击跳转详情页（带时序折线图）
- **告警**: 表格 + 严重级别颜色编码（critical=红, warning=橙, info=蓝）+ 状态过滤 + 确认/解决操作
- **规则**: 表格（条件展示如 "cpu_usage > 80"）+ 启用切换 + 抑制操作
- **渠道**: 表格（类型图标 email/slack/webhook）+ 配置摘要 + 启用切换
- **升级策略**: 列表 + 步骤可视化（step1 → step2 → step3）

## 关键交互

- 告警确认/解决：内联按钮操作
- 规则创建：条件构建器（指标 + 运算符 + 阈值）
- 渠道创建：类型专属表单（email 输入地址，webhook 输入 URL，slack 输入频道+token）
- 手动触发规则评估
- 仪表盘小组件自定义配置

## API 客户端文件

`orion-frontend/src/api/monitoring.ts` — 约 25 个函数，覆盖所有资源组。
