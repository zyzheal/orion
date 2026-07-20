# ADR-0009: Gin 中间件栈设计

## Status

**Proposed** — 待补充

## Context

Orion 后端使用 Gin 作为 HTTP 框架，中间件栈是安全、可观测性、限流等横切关注点的载体。当前 `orion-platform-svc-go/internal/middleware/` 已包含 6 个中间件（RequestID, StructuredLogger, Timeout, Tracing, CORS, SecurityHeaders, RateLimit），但缺乏统一的架构决策记录。

## Decision

待架构委员会补充：

- [ ] 中间件注册顺序的规范要求（Timeout → Tracing → Auth → RateLimit）
- [ ] 每个中间件的职责边界和错误处理策略
- [ ] 中间件的配置管理方式（环境变量 vs Config 对象）
- [ ] 全局中间件 vs 路由级中间件的使用原则
- [ ] 新中间件的注册流程和质量门禁

## Consequences

- 正向：统一的中间件栈确保所有请求路径一致性
- 风险：中间件注册顺序错误可能导致功能失效（如 Timeout 必须在 Tracing 之前）

## 相关

- 当前实现：`orion-platform-svc-go/internal/middleware/`
- 主服务注册：`orion-platform-svc-go/cmd/server/main.go` (line 1656-1676)
- Pipeline 引擎：`orion-platform-svc-go/cmd/pipeline-engine/main.go`
- ADR-0011 (OpenTelemetry)
- ADR-0012 (Prometheus)
