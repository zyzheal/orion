# ADR-0006: Saga 分布式事务补偿

## Status

**Proposed** — 待补充

## Context

Orion 平台中存在跨服务操作场景（Pipeline 编排、Saga 协调），需要可靠的分布式事务补偿机制。PipelineEngine 已通过 SagaCoordinator 实现正向执行与失败回滚，但缺乏统一的 ADR 决策记录。

## Decision

待架构委员会补充：

- [ ] 明确 Saga 模式在 Orion 中的适用范围
- [ ] 定义补偿函数签名规范（`StepCompensator` / `StepRegistry`）
- [ ] 确认与 `orion-platform-svc-go/internal/saga/` 现有实现的架构对齐
- [ ] 定义 Saga 事务日志持久化策略（TransactionLog + PostgreSQL）
- [ ] 处理 Saga 中的幂等性保障与重试机制

## Consequences

- 正向：确保跨服务操作的一致性和可回滚性
- 风险：补偿函数需正确实现幂等，避免二次补偿导致数据损坏

## 相关

- 当前实现：`orion-platform-svc-go/internal/saga/` (SagaCoordinator, TransactionLog)
- Pipeline 集成：PipelineEngine.SagaCoordinator
- ADR-0003 (事件驱动架构)
