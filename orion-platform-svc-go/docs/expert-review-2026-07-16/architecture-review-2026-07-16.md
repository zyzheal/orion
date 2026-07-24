---
title: 2026-07-16 架构深度评审 + P0 修复记录
created: "2026-07-16"
---

# 架构深度评审总结

**综合评分：C+ → B-** （P0 修复后预期）

## 维度评分

| 维度 | 评分 | 核心问题 |
|------|------|---------|
| DDD 架构 | C | Apply 不完整 → replay 状态错误（已修复 P0-3/P0-4） |
| CQRS 架构 | C+ | 聚合类型常量不一致（已修复 P0-1） |
| Saga 分布式事务 | D | SagaCoordinator 无实现，补偿为空 |
| 集成能力完整性 | C | NATS+ComposedPublisher 双重写入 |
| 代码质量 | C | loadAggregate 复制粘贴 |
| 安全风险 | C+ | 租户隔离完整，追踪 ID 未写入 |
| 可观测性 | B- | EventStream 已提供 |
| 性能评估 | B- | SnapshotStore 未集成 |

## P0 修复（已完成）

| # | 问题 | 修复 | 文件 |
|---|------|------|------|
| P0-1 | 聚合类型常量大小写不一致 | 统一为小写 | `queries/query.go` |
| P0-3 | PipelineApply 未处理 CreatedEvent | 添加 Created case | `pipeline.go` |
| P0-4 | ApprovalApply 未处理 Level 事件 | 添加 LevelApproved/Rejected case | `approval.go` |

## P1 待修复

| # | 问题 |
|---|------|
| P1-1 | correlation_id/causation_id 写入空字符串 |
| P1-2 | NATS 事件序列化不包含 payload |
| P1-3 | 测试用 mock 而非真实 DB |
| P1-4 | loadAggregate 在 3 个 handler 中复制粘贴 |
| P1-5 | 聚合根 → handler/service 接入（main.go 注入） |

## P2 待修复

| # | 问题 |
|---|------|
| P2-1 | generateID 用 UnixNano 非 UUID |
| P2-2 | SnapshotStore 未集成 |
| P2-3 | CommandBus 无类型安全 |
| P2-4 | storedEvent.Version() 永远返回 0 |

## 总体评价

骨架完整，接口设计规范，租户隔离一致实现。但 Saga 协调器无实现、Apply 不完整、双重写入等问题导致当前代码不可用于生产。P0 修复后提升至 B-。
