# ADR-0010: API 网关架构决策

## Status

**Proposed** — 待补充

## Context

Orion 使用 `orion-api-gateway/` (Node.js + Fastify + http-proxy) 作为 API 网关，负责请求路由、认证前置和流量管理。网关与后端服务的交互模式需要统一的架构决策。

## Decision

待架构委员会补充：

- [ ] 网关路由规则：静态路由 vs 动态路由（SubApp 注册）
- [ ] 网关与后端服务的通信协议（HTTP Proxy vs gRPC）
- [ ] JWT 认证在网关层与后端服务层的职责边界
- [ ] API 版本管理策略（URL Path vs Header）
- [ ] 网关的降级与熔断策略
- [ ] 网关与前端 Orion-MF 微前端的协同方式

## Consequences

- 正向：统一的入口降低后端服务认证负担
- 风险：网关成为单点故障；需要高可用部署

## 相关

- 网关实现：`orion-api-gateway/`
- 前端微前端：`orion-frontend/src/router/routes.tsx`
- 服务规格：`docs/specs/traceability-matrix.md`
