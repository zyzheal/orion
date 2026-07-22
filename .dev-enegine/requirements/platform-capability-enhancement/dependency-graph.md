# 依赖关系图 (Dependency Graph)

## Mermaid DAG

```mermaid
graph TD
    %% Phase 1 P0 - Circuit Breaker
    F001["F001: 通用熔断器服务层"]
    F002["F002: 熔断器 Fastify 中间件"]
    F003["F003: 熔断器 API 路由"]
    F004["F004: Pipeline 集成熔断器"]

    %% Phase 2 P1 - Message Queue
    F005["F005: 消息队列核心服务"]
    F006["F006: 延迟队列 + 死信队列"]
    F007["F007: 消费者组"]
    F008["F008: 消息队列 API 路由"]
    F009["F009: MQ 与 NATS 集成"]

    %% Phase 2 P1 - Cache Strategy
    F010["F010: L1 内存缓存层"]
    F011["F011: 多级缓存服务"]
    F012["F012: 缓存防护策略"]
    F013["F013: 缓存预热与失效"]
    F014["F014: 缓存管理 API"]
    F015["F015: Pipeline 缓存加速"]

    %% Phase 3 P2 - Disaster Recovery
    F016["F016: 统一容灾策略引擎"]
    F017["F017: 容灾演练编排器"]
    F018["F018: RTO/RPO 跟踪告警"]
    F019["F019: 容灾管理 API"]

    %% Frontend
    F020["F020: 熔断器面板前端"]
    F021["F021: 消息队列面板前端"]
    F022["F022: 容灾管理面板前端"]
    F023["F023: Pipeline 列表增加熔断列"]
    F024["F024: 缓存监控增加多级统计"]
    F025["F025: 备份管理增加演练入口"]

    %% Dependencies
    F001 --> F002
    F001 --> F003
    F001 --> F004
    F002 --> F004
    F003 --> F020
    F004 --> F023

    F005 --> F006
    F005 --> F007
    F005 --> F008
    F005 --> F009
    F006 --> F008
    F008 --> F021

    F010 --> F011
    F011 --> F012
    F011 --> F013
    F011 --> F015
    F012 --> F015
    F013 --> F014
    F014 --> F021
    F014 --> F024

    F016 --> F017
    F016 --> F018
    F016 --> F019
    F017 --> F019
    F018 --> F019
    F019 --> F022
    F022 --> F025

    F020 --> F023
    F003 --> F020
    F008 --> F021
    F019 --> F022
    F014 --> F024

    classDef p0 fill:#ff6b6b,stroke:#c0392b,stroke-width:2px
    classDef p1 fill:#ffa502,stroke:#e67e22,stroke-width:2px
    classDef p2 fill:#7bed9f,stroke:#27ae60,stroke-width:2px
    classDef frontend fill:#70a1ff,stroke:#2980b9,stroke-width:2px
    classDef infra fill:#a29bfe,stroke:#6c5ce7,stroke-width:2px

    class F001,F002,F004 p0
    class F005,F006,F007,F010,F011,F012,F013,F016 p1
    class F003,F008,F009,F014,F015,F017,F018,F019 p2
    class F020,F021,F022,F023,F024,F025 frontend
```

## 并发执行机会

| 可并发组 | Features | 说明 |
|---------|----------|------|
| G1 | F001, F005, F010, F016 | 四条独立基础设施线，无依赖关系 |
| G2 | F002, F006, F011, F017 | 各自依赖 G1 中的对应 Feature |
| G3 | F003, F007, F012, F018 | 各自依赖 G2 中的对应 Feature |
| G4 | F008, F014, F019 | 各自的 API 路由层 |
| G5 | F009, F015, F023, F024, F025 | 最终集成层 |
| G6 | F020, F021, F022 | 前端页面层（各自独立） |

## 执行顺序建议

### Phase 1 (P0 - 熔断器)
1. F001 → F002 + F003 → F004 → F020 → F023

### Phase 2 (P1 - 消息队列 + 缓存)
1. F005 → F006 + F007 → F008 → F021
2. F010 → F011 → F012 + F013 → F014 → F024
3. F015 (依赖 F011 + F012)

### Phase 3 (P2 - CI/CD 增强 + 容灾)
1. F016 → F017 + F018 → F019 → F022 → F025
2. F009 (依赖 F005)
3. F004 (依赖 F001 + F002) - 已在 Phase 1 完成
