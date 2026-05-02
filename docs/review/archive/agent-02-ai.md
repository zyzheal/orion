# 评审报告: AI/算法

> 评审日期: 2026-04-23
> 评审 Agent: Agent 02

## 1. 实现状态对比表

| 设计功能 | 实现程度(%) | 已实现代码 | 缺失部分 |
|----------|-------------|-----------|---------|
| AI Gateway 熔断器 | 60 | `api/ai-gateway-routes.ts`, `services/ai/` 基础熔断器 | 无真实 LLM 调用 |
| AI Code Review | 35 | `api/ai-review-routes.ts` | 后端仅路由，无真实 review 逻辑 |
| AI 安全扫描 | 30 | `api/ai-security-routes.ts` | 基础路由，无真实扫描引擎 |
| AI 成本优化 | 25 | `api/ai-cost-routes.ts` | 仅路由框架，无 Token 计费 SDK |
| Rule Engine 降级规则 | 70 | `services/ai/` 有 16 场景降级规则 | 无 DSL 解析、无热更新 |
| Skill 管理 CRUD | 40 | `services/skill/SkillService.ts`, `api/skill-routes.ts` | 无搜索/推荐/审核/沙箱 |
| AI Agent 编排 | 15 | `services/agent/` 目录存在 | 仅框架结构，无实际编排逻辑 |
| 向量存储 | 0 | - | 设计 Milvus/Qdrant 集成，无代码 |
| XGBoost 风险模型 | 0 | - | `算法设计详解.md` 设计完整但无代码 |
| 模型测试层 | 0 | - | 无测试集管理、无评估器 |
| AI Review 前端 | 60 | `orion-frontend/src/pages/AIReview/` | 前端已实现，后端脱节 |
| AI Gateway 前端 | 50 | `orion-frontend/src/pages/AIGateway/` | 前端有 UI，后端仅框架 |

## 2. 缺失功能清单

### P0 (紧急)
- **向量数据库集成**: 设计文档 → `向量存储生产方案.md` | 影响: 无语义检索能力，AI 核心功能缺失
- **Token 计费 SDK**: 设计文档 → `ai-cost-control-design.md` | 影响: 无法追溯 AI 成本
- **XGBoost 风险模型**: 设计文档 → `算法设计详解.md` | 影响: AI 风险评估仅靠规则引擎，无 ML

### P1 (重要)
- **真实 LLM 调用**: 设计文档 → `ai-gateway-design.md` | 影响: AIGateway 仅框架，无法实际推理
- **Skill 搜索/审核/沙箱**: 设计文档 → `skill-marketplace-design.md` | 影响: 无法运营 Skill 市场
- **AI Review 后端**: 设计文档 → `ai-review-routes.ts` 对应设计 | 影响: 前端已实现但后端无逻辑

### P2 (完善)
- **DSL 规则引擎热更新**: 设计文档 → `ai-降级方案设计.md` | 影响: 规则变更需重启服务
- **模型漂移监控**: 设计文档 → `算法设计详解.md` | 影响: 模型性能无法追踪

## 3. 代码质量评分

| 维度 | 评分(1-5) | 评分依据 |
|------|-----------|---------|
| 代码结构 | 3/5 | `services/ai/` 模块化但 `orion-ai-service` 定位模糊，TS 主服务与 Python 服务职责不清 |
| 错误处理 | 3/5 | 基础错误处理存在，但缺少对 LLM API 失败的重试/降级逻辑 |
| 测试覆盖 | 2/5 | AI 模块测试覆盖率低，多数服务无对应测试文件 |
| 文档一致性 | 2/5 | 20 份 AI 设计文档详尽，但实现仅 35%，前端优于后端 |
| **综合评分** | **3/5** | |

## 4. 关键发现

1. **前后端脱节严重**: AI Review 和 AI Gateway 前端页面已实现，但后端仅路由框架，无实际业务逻辑
2. **向量存储是最大缺口**: 整个 AI 语义检索基础完全缺失，影响所有 AI 功能
3. **规则引擎是亮点**: 16 场景降级规则已实现，是 AI 模块中最成熟的部分
4. **Python/TS 双服务架构**: `orion-ai-service` Python 服务与 TypeScript 主服务职责边界不清，建议明确分工
