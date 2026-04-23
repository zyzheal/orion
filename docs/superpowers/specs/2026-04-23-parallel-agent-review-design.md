# 并行 Agent 全量评审设计

> 日期: 2026-04-23
> 状态: 已批准

## 目标

使用 12 个并行 Agent 对 Orion 项目 44+ 模块、260 份设计文档进行全量评审，输出实现状态对比、缺失功能清单和代码质量评分。

## Agent 分组

### 并行批次 1 (Agent 1-6)

| # | Agent 名称 | 文档路径 | 代码路径 | 输出文件 |
|---|-----------|---------|---------|---------|
| 1 | 核心架构评审 | docs/architecture/, docs/adr/ | orion-platform-service/src/engine/, saga/ | docs/review/agent-01-architecture.md |
| 2 | AI算法评审 | docs/ai/ | orion-platform-service/src/api/ai-*, services/ | docs/review/agent-02-ai.md |
| 3 | SRE运维评审 | docs/sre/ | services/monitoring/, services/alert/ | docs/review/agent-03-sre.md |
| 4 | 安全领域评审 | docs/security/ | services/security/, api/ai-security-routes.ts | docs/review/agent-04-security.md |
| 5 | 前端设计评审 | docs/frontend/, docs/ui/ | orion-frontend/src/ | docs/review/agent-05-frontend.md |
| 6 | 数据库评审 | docs/db/, docs/migration/ | services/database.ts, migrations/ | docs/review/agent-06-database.md |

### 并行批次 2 (Agent 7-12)

| # | Agent 名称 | 文档路径 | 代码路径 | 输出文件 |
|---|-----------|---------|---------|---------|
| 7 | 集成事件评审 | docs/integration/, docs/event-bus/, docs/cmdb/ | events/, services/event-bus* | docs/review/agent-07-integration.md |
| 8 | 效能度量评审 | docs/efficiency/ | services/efficiency/ | docs/review/agent-08-efficiency.md |
| 9 | 制品管理评审 | docs/artifact/, docs/cache/ | services/artifact/, services/cache/ | docs/review/agent-09-artifact.md |
| 10 | CICD Pipeline | docs/cicd/, docs/qa/ | engine/, services/pipeline/ | docs/review/agent-10-cicd.md |
| 11 | IaC基础设施 | docs/iac/, docs/tasks/ | services/iac/ | docs/review/agent-11-iac.md |
| 12 | API需求评审 | docs/api/, docs/requirements/, docs/collaboration/ | api/routes.ts, api/*-routes.ts | docs/review/agent-12-api.md |

## 每个 Agent 统一输出模板

```markdown
# 评审报告: {领域名称}

## 1. 实现状态对比表
| 设计功能 | 实现程度(%) | 已实现代码 | 缺失部分 |
|----------|-------------|-----------|---------|

## 2. 缺失功能清单
### P0 (紧急)
- 功能名: 设计文档引用 -> 影响说明

### P1 (重要)
- ...

### P2 (完善)
- ...

## 3. 代码质量评分
| 维度 | 评分(1-5) | 评分依据 |
|------|-----------|---------|
| 代码结构 | X/5 | ... |
| 错误处理 | X/5 | ... |
| 测试覆盖 | X/5 | ... |
| 文档一致性 | X/5 | ... |
| **综合评分** | **X/5** | |
```

## 执行流程

1. 批次 1: Agent 1-6 并行执行
2. 批次 2: Agent 7-12 并行执行（可与批次 1 并行）
3. 汇总: 合并所有 12 份报告 → 生成 docs/review/full-review-2026-04-23.md

## 约束

- 每个 Agent 仅读取其对应领域的文档和代码
- Agent 之间无共享状态，无文件冲突
- 每个 Agent 必须完成全部 3 项输出（实现状态对比、缺失功能清单、代码质量评分）
- 评分必须有具体依据，不能只给分数
