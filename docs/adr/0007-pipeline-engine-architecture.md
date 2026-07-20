# ADR-0007: Pipeline Engine 架构

## Status

**Proposed** — 待补充

## Context

Pipeline 是 Orion 的核心交付引擎。当前存在 `orion-platform-svc-go/internal/pipeline-engine/` 主实现和 `orion-platform-svc-go/cmd/pipeline-engine/` 独立部署入口。需要统一的架构决策记录。

## Decision

待架构委员会补充：

- [ ] Pipeline Engine 在单体 vs 独立部署两种模式下的架构边界
- [ ] StageExecutor → TaskRunner 执行模型决策
- [ ] SSE 实时日志流（Pipeline SSE）的传输架构
- [ ] Pipeline Template 的加载与版本管理策略
- [ ] Pipeline 执行结果与 Artifact 的版本关联机制

## Consequences

- 正向：Pipeline 作为核心能力统一架构，避免多版本实现漂移
- 风险：独立部署需独立中间件栈（当前缺少 Timeout/Tracing 中间件，已在 Phase 2.6 修复）

## 相关

- 当前实现：`orion-platform-svc-go/internal/pipeline-engine/`
- 独立部署：`orion-platform-svc-go/cmd/pipeline-engine/main.go`
- ADR-0003 (事件驱动架构)
- 服务规格：`docs/specs/pipeline-template-svc-spec.md`
