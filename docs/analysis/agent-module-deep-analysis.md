# Agent 模块深度分析报告

**生成日期**: 2026-07-03
**分析模块**: `orion-platform-service/src/services/agent/`、`docs/services/agent/`

---

## 模块概述

Agent 模块承担 **AI Agent 编排、执行、沙箱隔离** 三大职责。当前实现处于**早期原型阶段**：核心领域模型、Repository 层、Service 层已建立，但功能深度有限，缺乏与 AI 生态（LLM、Tool、Memory）的深度集成。

| 子域 | 目录/文件 | 当前状态 |
|------|----------|----------|
| Agent 注册中心 | `AgentService.ts` + `AgentRepository.ts` | ⚠️ 基础 CRUD（PostgreSQL） |
| Agent 沙箱执行 | `AgentSandbox.ts` + `sandbox-worker.ts` | ⚠️ 模拟执行（setTimeout 300ms） |
| Agent 运行历史 | `AgentRepository.ts` | ✅ 持久化（PostgreSQL） |

---

## 架构设计

### 分层结构

```
API Routes (待补充)
    ↓
Service Layer (AgentService)
    ↓
Repository Layer (AgentRepository)
    ↓
PostgreSQL (agent_profiles, agent_runs)
```

### 关键设计模式

- **Repository Pattern**：使用 `AgentRepository` 封装 PostgreSQL 操作
- **Sandbox 隔离**：`AgentSandbox` 提供执行环境，但当前为模拟实现
- **EventEmitter**：沙箱基于事件驱动架构

---

## 功能完整性评估

### Agent 注册中心

| 功能 | 状态 | 说明 |
|------|------|------|
| 创建 Agent Profile | ✅ | 支持 name/type/capabilities/config |
| 查询列表 | ✅ | 按 tenantId 过滤 |
| 更新状态 | ⚠️ | 服务层无 updateProfile 方法 |
| 删除 Agent | ❌ | 未实现 |
| 能力管理 | ⚠️ | capabilities 字段存在但无独立管理接口 |

### Agent 执行引擎

| 功能 | 状态 | 说明 |
|------|------|------|
| 执行任务 | ⚠️ | 模拟执行（setTimeout 300ms + 固定输出） |
| 超时控制 | ❌ | 未实现真正超时机制 |
| 输入验证 | ❌ | 未实现 |
| 输出 DLP 检测 | ❌ | 未实现 |
| 资源监控 | ❌ | 未实现 |
| 执行记录持久化 | ✅ | agent_runs 表记录执行结果 |

### Agent 编排

| 功能 | 状态 | 说明 |
|------|------|------|
| 多 Agent 协作 | ❌ | 未实现 |
| 任务分发 | ❌ | 未实现 |
| 结果聚合 | ❌ | 未实现 |
| 错误重试 | ❌ | 未实现 |

---

## API 端点清单

### 当前已实现（推测）

| 方法 | 路径 | 功能 | 说明 |
|------|------|------|------|
| POST | `/api/v1/agents` | 创建 Agent | 需验证路由是否存在 |
| GET | `/api/v1/agents` | Agent 列表 | 需验证路由是否存在 |
| POST | `/api/v1/agents/:id/run` | 执行 Agent | 需验证路由是否存在 |
| GET | `/api/v1/agents/:id/runs` | 运行历史 | 需验证路由是否存在 |

**待确认**：当前 `docs/services/agent/` 下仅有设计文档 `ai-agent-orchestration-design.md`，无独立路由文件。

---

## 数据模型

### Agent Profile

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| tenant_id | UUID | 租户 ID |
| name | string | Agent 名称 |
| type | string | Agent 类型 |
| capabilities | string[] | 能力列表 |
| config | JSONB | 配置（模型参数、工具等） |
| status | enum | active/inactive/error |
| created_at | timestamp | 创建时间 |

### Agent Run

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| agent_id | UUID | 关联 Agent |
| tenant_id | UUID | 租户 ID |
| task | string | 任务描述 |
| input | JSONB | 输入参数 |
| output | JSONB | 输出结果 |
| status | enum | pending/running/completed/failed |
| error_message | text | 错误信息 |
| started_at | timestamp | 开始时间 |
| completed_at | timestamp | 完成时间 |

---

## 依赖关系

| 模块 | 集成点 | 状态 |
|------|--------|------|
| AI/LLM | 调用 LLM 完成推理 | ❌ 未集成 |
| Tool/Skill | 调用外部工具 | ❌ 未集成 |
| Knowledge | 检索知识库 | ❌ 未集成 |
| Pipeline | 作为 Pipeline 阶段执行 | ❌ 未集成 |
| Tenant | 多租户隔离 | ✅ tenant_id 字段存在 |

---

## 问题清单

### P0 级（阻塞生产）

| 问题 | 影响 | 建议修复 |
|------|------|----------|
| 执行引擎为模拟实现 | 无法执行真实 AI 任务 | 接入 LLM + Tool 调用框架 |
| 缺少 API 路由 | 前端无法调用 | 创建 agent-routes.ts |
| 缺少认证授权 | 安全风险 | 接入 authenticateUser + requirePermission |

### P1 级（高优先级）

| 问题 | 影响 | 建议修复 |
|------|------|----------|
| 无多 Agent 编排 | 无法处理复杂任务流 | 实现 DAG 编排器 |
| 无 Memory/上下文管理 | Agent 无记忆能力 | 实现 ConversationMemory |
| 无工具调用框架 | Agent 无法使用外部工具 | 实现 ToolRegistry + 调用协议 |
| 无流式输出 | 用户体验差 | 实现 SSE 流式返回 |
| 沙箱资源监控缺失 | 无法限制资源使用 | 实现 CPU/Memory 监控 |

### P2 级（改进项）

| 问题 | 影响 | 建议修复 |
|------|------|----------|
| 无 Agent 版本管理 | 无法回滚/灰度 | 实现 Agent 版本化 |
| 无 A/B 测试框架 | 无法评估 Agent 效果 | 实现流量分桶 |
| 无执行审计日志 | 无法追溯 Agent 行为 | 增强审计日志 |
| 无成本统计 | 无法计算 Token 消耗成本 | 实现 CostTracker |

---

## 技术债务

| 类别 | 债务项 | 风险 | 建议 |
|------|--------|------|------|
| 模拟执行 | AgentSandbox setTimeout 300ms | 高 | 接入真实 LLM 调用 |
| 缺少路由 | 无 agent-routes.ts | 高 | 创建路由并注册 |
| 缺少授权 | 无权限中间件 | 高 | 接入认证授权 |
| 单例 Repository | AgentRepository 无接口抽象 | 中 | 定义 IAgentRepository 接口 |
| 无错误分类 | AgentServiceError 简单继承 | 低 | 完善错误码体系 |

---

## 与其他模块集成点

| 模块 | 集成点 | 状态 |
|------|--------|------|
| AI/LLM | 调用 LLM 完成推理 | ❌ 未集成 |
| Tool/Skill | 调用外部工具 | ❌ 未集成 |
| Knowledge | 检索知识库 | ❌ 未集成 |
| Pipeline | 作为 Pipeline 阶段执行 | ❌ 未集成 |
| Notification | Agent 执行结果通知 | ❌ 未集成 |
| Audit | 执行审计日志 | ❌ 未集成 |

---

## 建议优先级

### Phase 1：基础能力补全（2-3 周）

1. 创建 agent-routes.ts，暴露 Agent CRUD + 执行 API
2. 接入 authenticateUser + requirePermission
3. 接入真实 LLM 调用（OpenAI/Anthropic/本地模型）
4. 实现基础 Tool 调用框架（HTTP/Function Calling）

### Phase 2：编排与记忆（3-4 周）

5. 实现多 Agent DAG 编排器
6. 实现 ConversationMemory（Redis + PostgreSQL）
7. 实现流式输出（SSE）
8. 实现资源监控 + 超时控制

### Phase 3：企业级能力（4-6 周）

9. 实现 Agent 版本管理 + A/B 测试
10. 实现执行审计 + 成本统计
11. 与 Pipeline/Knowledge/Skill 模块深度集成
12. 实现 Agent 市场（Marketplace）

---

## 结论

Agent 模块当前处于**早期原型阶段**，核心 CRUD 和模拟执行已实现，但缺乏与 Orion AI 生态的深度集成。

**关键缺失**：真实 LLM 调用、Tool 框架、多 Agent 编排、Memory 管理。

建议优先接入 LLM + Tool 调用，建立基础可执行能力，再逐步完善编排和企业级特性。
