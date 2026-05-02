# 多 Agent 实现 P0 缺失功能设计

> 日期: 2026-04-23
> 状态: 已批准

## 目标

使用 6 个并行 Agent 实现评审报告中最关键的 6 个独立 P0 缺失功能，零冲突并行。

## Agent 分组

### 第一批：6 个完全独立领域

| # | Agent | 领域 | 核心输出文件 | 依赖 |
|---|-------|------|-------------|------|
| 1 | API 路径修复 | 修复 ~30 处前后端路径不一致 | `orion-frontend/src/api/*.ts` | 无 |
| 2 | AI 向量数据库 | Milvus/Qdrant 集成 + 语义检索 | `services/ai/vector-store.ts` | 无 |
| 3 | Prompt 注入防护 | 过滤引擎 + 检测规则 | `services/ai/prompt-security.ts` | 无 |
| 4 | OnCall 排班系统 | 排班 CRUD + 规则引擎 | `services/scheduler/oncall.ts` | 无 |
| 5 | 制品状态机 | 5 阶段晋升 + 多级审批 | `services/artifact/promotion.ts` | 无 |
| 6 | NATS 消息总线 | EventBus 真实集成 | `services/event-bus-service.ts` | 无 |

## 每个 Agent 约束

- 仅修改指定文件，不碰其他代码
- 遵循现有代码风格（Fastify + TypeScript）
- 所有新服务必须包含测试
- 不使用 Map() 模拟，直接写真实实现框架（预留 DB 接口）

## 执行顺序

第一批 6 Agent 并行 → 收集结果 → 验证无冲突 → 调度第二批
