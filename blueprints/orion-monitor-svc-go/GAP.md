# Gap Analysis: orion-monitor-svc → orion-monitor-svc-go

> Generated: 2026-07-24 | Agent-2

## 现状

| 指标 | 值 |
|------|-----|
| TS 源文件 | 38 |
| Go 文件 | 20 |
| Go 域数 | 6 (alert, metric, notification, trace, dashboard, escalation) |
| 缺失域数 | 19 |

## 已覆盖域 (Go)

| Go 域 | 功能 | 文件数 |
|-------|------|--------|
| alert | 告警查询、创建、解决 | 5 |
| metric | 指标查询、注册、聚合 | 4 |
| notification | 通知渠道、历史记录 | 3 |
| trace | 分布式追踪 | 1 |
| dashboard | 仪表盘配置、聚合 | 2 |
| escalation | 升级策略 | 1 |

## 缺失域 (需补全)

### P0 — 核心监控功能

| TS 服务 | TS 文件 | 功能描述 | 优先级 |
|---------|---------|---------|--------|
| MonitoringService | monitoring.ts, MonitoringService.ts | Prometheus 指标查询 (instant/range) | P0 |
| PrometheusService | PrometheusService.ts | Prometheus API 代理 | P0 |
| AlertRuleService | AlertRuleService.ts | 告警规则 CRUD | P0 |
| AlertSilenceService | AlertSilenceService.ts | 告警静默管理 | P0 |
| OnCallService | OnCallService.ts | On-Call 排班管理 | P0 |
| SelfHealingService | SelfHealingService.ts | 自愈动作 | P0 |
| RootCauseAnalysisService | RootCauseAnalysisService.ts | 根因分析 | P0 |
| AlertCorrelationService | AlertCorrelationService.ts | 告警关联 | P1 |
| AlertDeduplication | AlertDeduplication.ts | 告警去重 | P1 |
| AlertSuppressionService | AlertSuppressionService.ts | 告警抑制 | P1 |
| CacheMonitorService | CacheMonitorService.ts | 缓存监控 | P1 |
| MonitoringRuleRepository | MonitoringRuleRepository.ts | 监控规则仓库 | P1 |
| MonitoringController | MonitoringController.ts | 监控控制器 | P1 |
| AlertTypes | AlertTypes.ts | 告警类型定义 | P1 |

### P2 — 增强功能

| TS 文件 | 功能描述 |
|---------|---------|
| AlertRepository.ts | 告警数据访问 (Go 已有 alert_repository.go) |
| OnCallRepository.ts | On-Call 排班数据访问 |
| SelfHealingRepository.ts | 自愈动作数据访问 |
| AlertRuleRepository.ts | 告警规则数据访问 |
| AlertSilenceRepository.ts | 告警静默数据访问 |

## 实施计划

### Phase 1 (Day 1): P0 核心
- [ ] 实现 alert-rule 域 (handler/service/repository/models)
- [ ] 实现 alert-silence 域 (handler/service/repository/models)
- [ ] 实现 monitoring 域 (handler/service/repository/models)
- [ ] 实现 prometheus-proxy 域 (handler/service)
- [ ] 实现 on-call 域 (handler/service/repository/models)

### Phase 2 (Day 2): P0 续 + P1
- [ ] 实现 self-healing 域 (handler/service/repository/models)
- [ ] 实现 rca 域 (handler/service/repository/models)
- [ ] 实现 alert-correlation 域 (handler/service)
- [ ] 实现 alert-deduplication 域 (handler/service)
- [ ] 实现 cache-monitor 域 (handler/service)

### Phase 3 (Day 3-4): 完善 + 验证
- [ ] 补充所有 model 定义
- [ ] 补充 wiring (main.go DI 组装)
- [ ] go build 验证
- [ ] 路由数对等验证
- [ ] 更新 TRACKER.md
