# 监控模块深度分析报告

**生成日期**: 2026-07-02
**分析模块**: `orion-platform-service/src/services/monitoring/` 及 alert 服务

---

## 模块概览

监控模块实现了完整的可观测性平台，包含指标采集与存储、告警规则引擎、告警通知与升级、仪表盘、告警关联与根因分析、分布式追踪、数据库 Profiler 等能力。MetricCollector 已完成 PostgreSQL 迁移，AlertCorrelationService 完全基于 PostgreSQL。

### 核心文件

| 文件 | 职责 |
|------|------|
| `MonitoringService.ts` | 监控服务门面，组合所有子服务 |
| `MetricCollector.ts` | 指标采集器，系统/应用/自定义指标采集与存储 |
| `AlertRuleEngine.ts` | 告警规则引擎，评估规则并生成告警 |
| `AlertNotificationService.ts` | 告警通知服务（email/webhook/Slack + 升级策略） |
| `MonitoringDashboard.ts` | 仪表盘生成，聚合统计和 z-score 异常检测 |
| `MetricStorageRepository.ts` | 指标数据的 PostgreSQL Repository（已迁移） |
| `MonitoringRepository.ts` | 监控配置/告警/规则/渠道/策略的 Repository |
| `TracingService.ts` | 分布式追踪服务，W3C Trace Context 支持 |
| `DatabaseProfiler.ts` | 数据库慢查询 Profiler |
| `AlertCorrelationService.ts` | 告警关联服务（聚类、拓扑、根因分析） |

---

## 架构设计

### MetricCollector 存储策略

**已完成迁移**：构造函数强制要求 `MetricStorageRepository`（PostgreSQL），否则抛出错误。

**存储分层**：
- 实时查询：内存 `metricStorage` Map，毫秒级响应
- 历史查询：`getMetricSeriesAsync()` 走 PostgreSQL
- 数据保留：`retentionMs` 默认 24 小时

### 双写与降级机制

`MonitoringController` 和 `MonitoringService` 中存在大量 `try-catch NO_DATABASE` 模式：
- 数据库可用时：走 Repository 持久化（主路径）
- 数据库不可用时：降级到内存 Map（兼容路径）

---

## 功能完整性评估

| 功能域 | 功能 | 状态 | 说明 |
|--------|------|------|------|
| 指标采集 | 系统指标（CPU/内存/磁盘/网络） | ⚠️ | CPU 基于 load average 估算，磁盘返回固定 0，网络逻辑错误 |
| | 应用指标（延迟/错误率/吞吐量） | ✅ | recordLatency/recordError/recordThroughput |
| | 自定义指标注册 | ✅ | registerMetric |
| 指标查询 | 时序数据查询（带标签过滤） | ✅ | getMetricSeries + getMetricSeriesAsync |
| | 聚合统计（avg/max/min/p95/p99） | ✅ | getMetricSummary |
| 告警规则 | CRUD | ✅ | create/get/update/delete/toggle |
| | 条件判断 | ✅ | evaluateCondition（> < >= <= == != rate_of_change） |
| | 冷却期防 flooding | ✅ | cooldownMs + isCooldownExpired |
| | 评估窗口 | ⚠️ | evaluationWindowMs 字段存在但未在引擎中使用 |
| 告警生命周期 | 触发/确认/解决/抑制 | ✅ | acknowledgeAlert/resolveAlert/suppressRule |
| 通知渠道 | Email/Webhook/Slack | ❌ | 仅 logger.info 模拟，未接入真实发送 |
| 升级策略 | 多步骤升级+重复 | ✅ | startEscalation + executeEscalationStep |
| 仪表盘 | Widget 配置 + 聚合指标 + 异常检测 | ✅ | MonitoringDashboard + z-score |
| 告警关联 | 聚类（Jaccard 相似度）+ 拓扑 + 根因分析 | ✅ | AlertCorrelationService 完整实现 |
| 告警去重 | 指纹生成 + 去重分组 | ✅ | AlertDeduplication |
| 告警抑制 | 维护窗口 + 已知问题 + 节点故障 | ✅ | 完整实现 |
| 分布式追踪 | W3C Trace Context + Span 持久化 | ✅ | TracingService |
| 数据库 Profiler | 慢查询记录 + 查询模式聚合 | ✅ | DatabaseProfiler |

---

## API 端点清单

### Monitoring 路由（`/api/v1/monitoring`）：约 30 个端点

| 方法 | 路径 | 功能 | 权限 |
|------|------|------|------|
| POST | /monitoring/start | 启动监控服务 | monitoring:write |
| POST | /monitoring/stop | 停止监控服务 | monitoring:write |
| GET | /monitoring/health | 健康检查 | 认证即可 |
| POST | /monitoring/metrics | 记录指标 | monitoring:write |
| POST | /monitoring/metrics/register | 注册自定义指标 | monitoring:write |
| GET | /monitoring/metrics | 获取已注册指标列表 | monitoring:read |
| GET | /monitoring/metrics/:name/series | 获取时序数据 | monitoring:read |
| GET | /monitoring/metrics/:name/summary | 获取聚合统计 | monitoring:read |
| POST | /monitoring/rules | 创建告警规则 | monitoring:write |
| GET | /monitoring/rules | 获取规则列表 | monitoring:read |
| PUT | /monitoring/rules/:id | 更新规则 | monitoring:write |
| DELETE | /monitoring/rules/:id | 删除规则 | monitoring:write |
| PATCH | /monitoring/rules/:id/toggle | 启用/禁用规则 | monitoring:write |
| POST | /monitoring/rules/:id/suppress | 抑制规则 | monitoring:write |
| GET | /monitoring/alerts | 获取告警列表 | monitoring:read |
| GET | /monitoring/alerts/active | 获取活跃告警 | monitoring:read |
| POST | /monitoring/alerts/:id/acknowledge | 确认告警 | monitoring:write |
| POST | /monitoring/alerts/:id/resolve | 解决告警 | monitoring:write |
| POST | /monitoring/alerts/:id/escalate | 启动升级 | monitoring:write |
| POST | /monitoring/channels | 创建通知渠道 | monitoring:write |
| PATCH | /monitoring/channels/:id/toggle | 启用/禁用渠道 | monitoring:write |
| POST | /monitoring/escalation | 创建升级策略 | monitoring:write |
| GET | /monitoring/notifications | 获取通知历史 | monitoring:read |
| GET | /monitoring/dashboard | 获取仪表盘数据 | monitoring:read |
| GET | /monitoring/anomalies | 检测异常 | monitoring:read |
| POST | /monitoring/collect | 手动采集系统指标 | monitoring:write |

### Alert 路由（`/api/v1/alert`）：约 16 个端点

告警关联、去重、抑制、根因分析等端点。

---

## 缺失功能

| 缺失项 | 严重程度 | 影响 |
|--------|---------|------|
| 真实邮件/Webhook/Slack 发送 | P0 | 告警无法真正触达用户 |
| 磁盘/网络真实采集 | P1 | 监控数据失真 |
| 告警通知自动触发 | P1 | onAlert 回调为空，告警不会自动通知 |
| evaluationWindowMs 未使用 | P2 | 规则评估只看当前值，不看窗口内趋势 |
| 升级状态不持久 | P2 | escalationStates 是纯内存 Map |
| 实时指标流（SSE/WebSocket） | P2 | 仅支持轮询式 REST 查询 |
| 前端页面不完整 | P1 | monitor-svc/Monitoring 仅基础占位 |

---

## 技术债务

| 问题 | 影响 | 建议 |
|------|------|------|
| CPU/磁盘/网络采集为近似值 | 监控数据失真 | 引入 systeminformation 或 prom-client |
| 通知渠道未真实发送 | 监控体系失效 | 接入 nodemailer/fetch/Slack SDK |
| onAlert 回调为空 | 告警不会自动通知 | 在 start() 中注入真实通知逻辑 |
| 双写一致性风险 | 内存与 DB 状态可能不一致 | 以 DB 为主，内存为只读缓存 |
| 告警升级状态不持久 | 重启后升级流程丢失 | 持久化到 alert_escalation_states 表 |

---

## 与其他模块集成点

| 模块 | 集成方式 | 状态 |
|------|----------|------|
| Self-Healing | 通过 alert-routes.ts 接收外部告警 | ✅ 接口存在 |
| APM | TracingService 独立采集 spans | ✅ |
| Pipeline | metricCollector.recordThroughput | ✅ |
| ChatOps | 告警可通过 webhook 推送 | ⚠️ 需确认 |
| SLO/SLI | monitoring_configs 表 | ✅ 表结构存在 |

---

## 建议优先级

1. **P0**: 实现真实通知发送（SMTP/fetch/Slack SDK）
2. **P0**: 注入 onAlert 回调，连接规则引擎与通知服务
3. **P1**: 修复系统指标采集（引入 systeminformation）
4. **P1**: 实现 evaluationWindowMs 窗口内聚合
5. **P2**: 持久化 escalationStates
