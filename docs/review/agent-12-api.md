# 评审报告: API/需求

> 评审日期: 2026-04-23
> 评审 Agent: Agent 12

## 1. 实现状态对比表

| 设计功能 | 实现程度(%) | 已实现代码 | 缺失部分 |
|----------|-------------|-----------|---------|
| 路由注册 | 90 | `api/routes.ts` 34 个路由注册 | 集中式注册 |
| Pipeline 路由 | 85 | `POST/GET/PUT/DELETE /pipelines` 完整 CRUD | 真实执行 |
| Build 路由 | 60 | `api/build-routes.ts` | 后端逻辑 |
| Deploy 路由 | 40 | `api/deploy-routes.ts` | 基础框架 |
| Monitoring 路由 | 50 | `api/monitoring-routes.ts` | 部分实现 |
| Ticketing 路由 | 60 | `api/ticketing-routes.ts` | 路由完整 |
| FinOps V2 路由 | 60 | `api/finops-v2-routes.ts` | 路由完整 |
| 前后端路径一致 | 70 | ~70% 一致 | ~30 处路径不一致 |
| 控制器实现 | 60 | `api/controllers/` 多个控制器 | 多数仅 CRUD |
| API 版本管理 | 15 | ADR-012 设计 | 无 /v1/v2 版本化 |
| 确认工作台 | 30 | `api/confirmation-routes.ts` | 基础框架 |
| 工单路由 | 55 | `api/ticketing-routes.ts` | 路由完整，DispatchEngine 实现 |

## 2. 缺失功能清单

### P0 (紧急)
- **API 路径一致性**: ~30 处前后端路径不一致 | 影响: 运行时 404 错误，阻断功能

### P1 (重要)
- **API 版本管理**: 设计文档 → ADR-012 | 影响: 无 /v1/v2 版本化，升级风险
- **控制器深层逻辑**: 多数控制器仅 CRUD | 影响: 业务逻辑缺失

### P2 (完善)
- **确认工作台**: 设计文档 → `confirmation-routes.ts` 对应设计 | 影响: 手动确认流程不完整

## 3. 代码质量评分

| 维度 | 评分(1-5) | 评分依据 |
|------|-----------|---------|
| 代码结构 | 3/5 | routes.ts 集中注册 30+ 路由，但文件过长（280 行），建议拆分 |
| 错误处理 | 3/5 | 控制器有基础 try-catch，但缺少统一错误响应格式 |
| 测试覆盖 | 1/5 | API 层几乎无端到端测试 |
| 文档一致性 | 2/5 | ~30 处前后端路径不一致是最严重的一致性问题 |
| **综合评分** | **2/5** | |

## 4. 关键发现

1. **API 路径不一致是跨领域问题**: 前后端 ~30 处路径不一致影响多个模块
2. **路由注册文件过长**: routes.ts 280 行注册 30+ 路由，维护困难
3. **控制器实现不均衡**: Pipeline/FinOps/Ticketing 控制器较完整，Build/Deploy/Canary 仅框架
4. **API 版本化未实现**: ADR-012 设计了版本管理，但所有路由无 /v1/ 前缀
