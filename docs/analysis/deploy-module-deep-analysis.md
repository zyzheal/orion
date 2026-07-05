# Deploy 模块深度分析报告

**生成日期**: 2026-07-02
**分析模块**: `orion-platform-service/src/services/deploy/` 及 smart-deploy

---

## 模块概览

Deploy 模块实现了完整的应用部署系统，包含基础部署 CRUD、渐进式发布（两套实现冲突）、智能部署策略引擎（Blue-Green/Canary/Rolling/Recreate）、自动回滚、紧急部署审批、部署窗口管理、版本说明生成等能力。采用 PostgreSQL Repository 持久化，但 SmartDeployService 存在内存 Map 状态存储。

### 核心文件

| 文件 | 职责 |
|------|------|
| `DeployService.ts` | 部署核心业务逻辑（CRUD、启动、取消、回滚、事件记录） |
| `DeployRepository.ts` | Deploy 数据访问层（deployments + deployment_events） |
| `ProgressiveDeployService.ts` | 基于阶段的渐进式发布（多阶段、流量百分比、阶段推进） |
| `ProgressiveDeploymentService.ts` | 基于流量的渐进式发布（简化版，自动回滚、流量计算） |
| `EmergencyDeployService.ts` | 紧急部署审批流 |
| `DeployWindowService.ts` | 部署窗口管理（Cron 表达式校验、时间窗口检查） |
| `ReleaseNotesService.ts` | 部署版本说明自动生成与持久化 |
| `SmartDeployService.ts` | 智能部署服务（策略引擎 + 运行时状态） |
| `DeploymentStrategyEngine.ts` | 四类策略执行引擎（Blue-Green/Canary/Rolling/Recreate） |
| `DeploymentWorkflow.ts` | 部署工作流编排（预检→执行→验证→自动回滚） |
| `RollbackService.ts` | 回滚执行服务 |
| `DeploymentVerifier.ts` | 部署验证报告生成 |

---

## 架构设计

### 关键发现：双重实现冲突

**ProgressiveDeployService vs ProgressiveDeploymentService**

| 维度 | ProgressiveDeployService | ProgressiveDeploymentService |
|------|--------------------------|-------------------------------|
| 定位 | 阶段式（Stage-based）多阶段部署 | 流量式（Traffic-based）渐进发布 |
| 数据模型 | deploy_progressive_stages 表 | progressive_deployments 表 |
| 流量控制 | 通过 traffic_percent 字段在阶段上递增 | 通过 currentTrafficPercent 直接控制 |
| 自动回滚 | 无内置自动回滚 | 内置 autoRollback + rollbackThreshold |
| 阶段推进 | 手动调用 advanceStage | 自动 incrementTraffic + 冷却时间 |

**冲突点**：两者均属于 deploy 模块，但数据模型、状态机完全不同。`DeployController` 目前只使用 `SmartDeployService`，这两个 Progressive 服务**没有任何 Controller 直接暴露**。

### 部署流程

```
用户触发 POST /deploy
    ↓
DeployController.deploy()
    ↓
SmartDeployService.deploy()
    ├─ 构建策略 Stages（blue-green/canary/rolling/recreate）
    ├─ 同步执行预检 Stage（模拟）
    ├─ 写入 DeploymentHistoryRepository (deployments 表)
    ├─ 写入内存 Map (activeDeployments)
    └─ 启动 simulateDeploymentProgress() 异步推进
```

---

## 功能完整性评估

| 功能 | 状态 | 说明 |
|------|------|------|
| 基础部署 CRUD | ✅ | DeployService + DeployRepository |
| 部署生命周期 | ✅ | pending → deploying → success/failed/cancelled |
| 回滚（基于历史） | ✅ | DeployService.rollback 查找上一成功版本 |
| 渐进式发布（阶段式） | ⚠️ | 功能完整但**无 API 入口** |
| 渐进式发布（流量式） | ⚠️ | 功能完整但**无 API 入口** |
| 双渐进实现冲突 | ❌ | 两套服务、两套表、两套状态机 |
| Blue-Green / Canary / Rolling / Recreate | ✅ | DeploymentStrategyEngine 四种策略 |
| 自动回滚（策略失败） | ✅ | DeploymentWorkflow.handleDeploymentFailure |
| 自动回滚（流量错误率） | ✅ | ProgressiveDeploymentService.checkAndAutoRollback |
| 手动回滚 | ✅ | POST /deploy/:id/rollback |
| 部署窗口（Cron） | ✅ | DeployWindowService |
| 紧急部署审批 | ✅ | EmergencyDeployService |
| 版本说明 | ✅ | ReleaseNotesService 生成 + 持久化 |
| 部署历史查询 | ✅ | GET /deploy/history |
| 部署指标统计 | ✅ | GET /deploy/metrics |
| 环境锁 | ✅ | DeploymentWorkflow 集成 EnvironmentLockService |
| 真实 K8s/Tekton 执行 | ❌ | 所有执行均为 setTimeout 模拟 |
| 审计日志持久化 | ❌ | SmartDeployService 的 auditTrails 存在内存 Map |

---

## API 端点清单

Smart Deploy 路由（`deploy-routes.ts`，前缀 `/api/v1/deploy`）：**8 个端点**

| 方法 | 路径 | 功能 |
|------|------|------|
| POST | /deploy | 创建并执行部署 |
| GET | /deploy/:id | 查询部署状态 |
| GET | /deploy/history | 部署历史 |
| GET | /deploy/latest/:appName/:environment | 最新部署 |
| GET | /deploy/metrics | 部署指标统计 |
| POST | /deploy/:id/rollback | 触发回滚 |
| GET | /deploy/:id/rollbacks | 回滚历史 |
| POST | /deploy/:id/cancel | 取消部署 |
| GET | /deploy/:id/audit | 审计日志 |

**缺失的 API 暴露**：ProgressiveDeployService / ProgressiveDeploymentService / EmergencyDeployService / DeployWindowService / ReleaseNotesService 均无对应路由。

---

## 缺失功能

| 缺失项 | 严重程度 | 影响 |
|--------|---------|------|
| 真实 K8s/Tekton 执行 | P0 | 所有部署均为 setTimeout 模拟 |
| 双渐进发布实现冲突 | P0 | 两套独立系统导致状态分散 |
| Progressive 服务无 API | P1 | 功能完整但无法被前端/外部调用 |
| 审计日志未持久化 | P1 | SmartDeployService 的 auditTrails 内存 Map |
| 部署事件仅内存 | P1 | rollbackHistory 存在内存 Map |
| 环境锁集成不完整 | P1 | SmartDeployService 路径未集成环境锁 |
| 无真实健康检查执行 | P1 | simulateStepExecution 无 HTTP 调用 |
| 无真实流量切换 | P1 | RollbackService 仅调用外部 API 或模拟 |
| 版本说明无 Git 集成 | P2 | 使用默认 changes，无真实 commit 解析 |

---

## 技术债务

| 问题 | 影响 | 建议 |
|------|------|------|
| SmartDeployService 运行时内存 Map | 进程重启后运行中部署状态丢失 | 将 activeDeployments 同步到 deployments 表 |
| 双渐进实现冲突 | 维护成本翻倍 | 选择一套实现，删除另一套 |
| 模拟执行弥漫全模块 | 无法用于生产 | 抽象 IDeploymentExecutor 接口 |
| DeploymentWorkflow 与 SmartDeployService 路径分裂 | DeploymentWorkflow 成为死代码风险 | 合并能力到 SmartDeployService |
| commit_sha 存储在 config JSONB | 无法高效查询 | 使用独立字段或 JSONB 路径索引 |

---

## 与其他模块集成点

| 模块 | 集成方式 | 状态 |
|------|----------|------|
| Pipeline | pipeline_run_id 关联 | ⚠️ 有字段无自动触发 |
| Artifact/Build | build_id 关联 | ⚠️ 有字段无自动触发 |
| Environment Lock | DeploymentWorkflow → EnvironmentLockService | ✅（仅 Workflow 路径） |
| Monitoring/APM | IEventPublisher 接口预留 | ⚠️ 接口定义但无实现 |
| Approval | EmergencyDeployService 独立审批流 | ✅ |

---

## 建议优先级

1. **P0**: 消除双渐进实现冲突
2. **P0**: SmartDeployService 内存状态持久化
3. **P1**: 统一部署执行路径
4. **P1**: 暴露 Progressive 服务 API
5. **P1**: 替换模拟执行为真实 K8s/Tekton 调用
