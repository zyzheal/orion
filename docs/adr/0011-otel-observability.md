# ADR-0011: OpenTelemetry 可观测性集成

## Status

**Proposed** — 待补充

## Context

Orion 已集成 OpenTelemetry 进行分布式追踪，Tracing 中间件 (`orion-platform-svc-go/internal/middleware/tracing.go`) 在请求路径中创建 Span。需要统一的追踪架构决策。

## Decision

待架构委员会补充：

- [ ] Tracing 与 Timeout 中间件的协作模式（Tracing 继承 Timeout 的 Deadline）
- [ ] 跨服务追踪的 Header 传递协议（`X-Trace-ID`）
- [ ] Span 创建规范：哪些操作需要创建 Span，命名约定
- [ ] Trace 数据上报目标（Jaeger / Zipkin / 自建）
- [ ] 与 Prometheus 指标、Structured Logger 的关联（trace_id 关联）
- [ ] 手动 Span vs 自动 Span 的使用原则

## Consequences

- 正向：统一的追踪链支持端到端性能分析和故障定位
- 风险：Span 创建不当导致性能开销；追踪数据量过大

## 相关

- 当前实现：`orion-platform-svc-go/internal/middleware/tracing.go`
- 公共追踪：`orion/go-common/pkg/otel/`
- ADR-0009 (Gin 中间件栈)
- 架构设计：`docs/architecture/14-Observability-DESIGN.md`
