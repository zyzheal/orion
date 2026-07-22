# ADR-0003: 事件驱动架构

## Status

**Accepted** — 2026-06-28

## Context

Orion 平台包含多个需要跨模块通信的场景：

1. **Pipeline 执行**：Pipeline 启动 → 通知 → 更新制品 → 触发 CI/CD
2. **告警处理**：指标采集 → 告警评估 → 通知 → 自动修复 → 工单
3. **审批流程**：提交 → 审批 → 执行 → 通知结果
4. **配置变更**：配置更新 → 缓存刷新 → 服务重启

传统调用模式（同步 RPC）存在以下问题：

- **紧耦合**：模块 A 调用模块 B，A 必须知道 B 的存在和接口
- **级联故障**：B 故障导致 A 也失败
- **扩展困难**：新增消费者需要修改生产者代码
- **性能瓶颈**：同步调用阻塞生产者

## Decision

采用 **事件驱动架构 (Event-Driven Architecture)**，以 NATS 作为事件总线，实现模块间的异步解耦通信。

### 架构概览

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  Pipeline   │     │   告警中心   │     │  CI/CD      │
│  Engine     │────▶│              │◀────│  触发器     │
└─────────────┘     │              │     └─────────────┘
                    │   NATS Jet   │
                    │   Stream     │
┌─────────────┐     │              │     ┌─────────────┐
│  通知服务   │◀────│              │────▶│  制品仓库   │
└─────────────┘     └──────────────┘     └─────────────┘
```

### 事件类型

```
events/
├── pipeline/    # Pipeline 事件
│   ├── start
│   ├── complete
│   ├── fail
│   └── stage-complete
├── code/        # 代码仓库事件
│   ├── push
│   ├── merge
│   └── webhook-received
├── config/      # 配置变更事件
│   ├── update
│   └── delete
├── deployment/  # 部署事件
│   ├── start
│   ├── complete
│   └── rollback
└── incident/    # 故障事件
    ├── create
    ├── update
    └── resolve
```

### 事件结构

```typescript
interface OrionEvent {
  id: string;           // UUID
  type: string;         // 事件类型
  version: string;      // 事件 schema 版本
  timestamp: Date;
  tenantId: string;     // 租户隔离
  source: string;       // 事件来源
  payload: any;         // 事件负载
  correlationId: string;// 关联请求 ID (跨模块追踪)
  causationId?: string; // 因果链 ID
}
```

### 事件处理规范

1. **幂等性**：事件处理器必须幂等，重复消费同一事件不产生副作用
2. **顺序性**：同一 source 的事件保证顺序，不同 source 不保证
3. **持久化**：关键事件 (Pipeline、告警、审批) 持久化到 NATS JetStream
4. **重试**：事件处理失败自动重试，最大重试次数 3 次
5. **死信**：超过重试次数的事件路由到死信队列，人工处理

### 依赖关系

| 模块 | 依赖 |
|------|------|
| TS 服务 | `orion-platform-service/src/events/` (事件发布者) |
| Go 微服务 | `nats.go` (NATS 客户端) |
| AI 服务 | `orion-ai-service` (Python + NATS) |

### 与 Repository 模式的关系

Repository 层负责数据持久化，事件层负责跨模块通知：

```
Service
├── 更新数据 → Repository
└── 发布事件 → EventPublisher
```

## Consequences

### 正面
- **解耦**：模块间通过事件通信，生产者无需知道消费者
- **容错**：消费者故障不影响生产者
- **扩展**：新增消费者无需修改生产者
- **异步**：非关键操作异步执行，提升响应速度
- **审计**：所有事件持久化，可追溯

### 负面
- **最终一致性**：事件驱动架构默认最终一致性，不适合强一致场景
- **调试复杂**：分布式追踪需要 correlationId 串联
- **事件风暴**：循环依赖或死循环可能导致事件风暴
- **NATS 依赖**：NATS 故障影响所有事件驱动功能

### 风险与缓解

| 风险 | 缓解措施 |
|------|---------|
| NATS 故障 | 本地队列缓冲，NATS 恢复后重放 |
| 事件丢失 | JetStream 持久化 + 消费者确认机制 |
| 事件风暴 | 最大重试次数 + 死信队列 |
| 延迟 | 关键事件使用优先队列 |

## 相关 ADR

- ADR-0002: Repository 模式 — 数据访问层与事件层分离
- ADR-0004: 多租户隔离 — 事件通过 tenantId 隔离
