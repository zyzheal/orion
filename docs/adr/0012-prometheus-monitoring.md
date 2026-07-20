# ADR-0012: Prometheus 监控集成

## Status

**Proposed** — 待补充

## Context

Orion 已集成 Prometheus 客户端库 (`github.com/prometheus/client_golang`)，Prometheus 中间件 (`orion-platform-svc-go/internal/middleware/prometheus.go`) 记录 HTTP 请求指标。需要统一的监控架构决策。

## Decision

待架构委员会补充：

- [ ] 标准监控指标集合定义（Request Count, Latency, Status Code, Error Rate）
- [ ] `/metrics` 端点的安全策略（内网暴露 vs 认证保护）
- [ ] 业务自定义指标的注册机制和命名规范
- [ ] 与告警系统（Alert Manager）的集成模式
- [ ] 指标数据保留策略和采样间隔
- [ ] 服务级指标与系统级指标（CPU, Memory, Disk）的分离

## Consequences

- 正向：统一的指标体系支持容量规划和故障预警
- 风险：指标定义不当导致监控噪声；指标采集频率影响性能

## 相关

- 当前实现：`orion-platform-svc-go/internal/middleware/prometheus.go`
- 架构设计：`docs/architecture/14-Observability-DESIGN.md`
- 服务规格：`docs/specs/monitor-svc-spec.md`
- ADR-0009 (Gin 中间件栈)
- ADR-0011 (OpenTelemetry)
