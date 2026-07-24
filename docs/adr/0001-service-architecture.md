# ADR-0001: 微服务架构决策

## Status

**Accepted** — 2026-05-25

## Context

Orion 平台初期以 `orion-platform-service` (Node.js + TypeScript + Fastify) 单体应用为基础构建，包含 131 个服务模块和 100 个路由。随着平台功能扩展至 AI 平台、可观测性、治理、CMDB 等 44+ 模块，单体架构面临以下挑战：

1. **部署耦合**：任意模块变更需要重启整个服务，灰度发布风险高
2. **技术栈不匹配**：APM 性能监控需要 Go 原生高并发；AI/ML 能力需要 Python 生态；Webhook 高频场景需要 Rust
3. **团队扩展**：不同团队无法独立开发、测试、部署各自模块
4. **容错隔离**：单个模块 OOM 或死循环可能拖垮整个平台
5. **微服务蓝图已有 87 个目录** (37 TS + 47 Go + 2 Python + 1 Rust)，但均未独立部署，仅有编译单元

## Decision

采用 **渐进式微服务架构**，分三个层次演进：

### 层次一：单体 + 模块路由 (当前)

```
orion-api-gateway (端口 3000)
    │
    ├── 模块路由层 (module-routing.ts)
    │   └── 基于 MODULE_ROUTING 环境变量分发
    │       - /api/v1/notify → Go 服务 (8080)
    │       - /api/v1/other → TS 单体 (3001)
    │
    └── orion-platform-service (端口 3001)
        └── 131 个服务模块 (全部 Node.js)
```

- API 网关作为统一入口，通过模块级路由实现部分流量切换到 Go 微服务
- TS 单体仍是权威实现，Go 微服务为灰度目标

### 层次二：独立部署 + Redis 动态配置 (Phase 5)

```
orion-api-gateway
    │
    ├── Redis 动态配置 (gray-release.service.ts)
    │   └── 基于 Redis Pub/Sub 的热加载路由规则
    │       - 权重分发 (0-100%)
    │       - Header 精确路由
    │       - 最长前缀匹配
    │
    ├── orion-platform-service (TS 单体)
    │
    └── orion-platform-svc-go (Go 独立进程)
        └── 93 个模块 (独立部署)
```

- Go 微服务独立部署，通过 API 网关灰度路由实现渐进切换
- Redis Pub/Sub 实现路由配置热更新，无需重启网关

### 层次三：完全微服务 (远期)

```
orion-api-gateway
    │
    ├── Service Mesh (Istio/Consul Connect)
    │   └── 服务发现 + 流量治理 + mTLS
    │
    ├── 独立 TS 微服务 (API 网关、CMDB)
    ├── 独立 Go 微服务 (93 个模块)
    └── 独立 Python 微服务 (AI 平台)
```

### 技术栈分工

| 技术栈 | 适用模块 | 理由 |
|--------|---------|------|
| Go | 性能关键、K8s 集成、安全模块 | 高并发、原生 K8s 支持、编译时类型安全 |
| Node.js/TS | Webhook、API 网关、CMDB | 生态成熟、Fastify 轻量 |
| Python | AI/ML、LLM Trace、RAG | LangChain/LlamaIndex/Faiss 生态 |
| Rust | 高频 Webhook、流处理 | 极致性能、内存安全 |

## Consequences

### 正面
- **独立部署**：每个微服务可独立开发、测试、部署
- **技术栈灵活**：按模块特性选择最适合的语言
- **容错隔离**：故障不影响其他服务
- **团队自治**：不同团队可并行开发
- **渐进迁移**：从单体到微服务平滑过渡，无大爆炸式重构

### 负面
- **运维复杂度**：需要管理多个进程、服务发现、负载均衡
- **分布式事务**：跨服务操作需要 Saga 模式或事件驱动
- **API 一致性**：需要统一的 API 规范和文档
- **调试困难**：跨服务请求追踪需要分布式 tracing
- **开发成本**：初期需要维护两套代码 (TS + Go)

### 风险与缓解

| 风险 | 缓解措施 |
|------|---------|
| TS/Go 代码重复 | 统一数据模型定义，自动生成代码 |
| 迁移中断 | 灰度发布 + 快速回滚机制 |
| 团队学习曲线 | Go 模块优先选择核心团队熟悉的功能 |
