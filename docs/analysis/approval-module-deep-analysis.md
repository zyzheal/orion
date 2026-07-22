# 审批模块深度分析报告

**生成日期**: 2026-07-02
**分析模块**: `orion-platform-service/src/services/approval/`

---

## 模块概览

审批模块实现了一个完整的多级审批工作流引擎，支持串行/并行审批、审批人动态解析、降级链推导、AI 辅助审批、紧急审批通道、超时自动处理等能力。采用 PostgreSQL Repository 持久化，集成低代码工作流引擎和 Pipeline 审批门禁。

### 核心文件

| 文件 | 职责 |
|------|------|
| `ApprovalService.ts` | 基础审批服务（创建、批准、拒绝、查询） |
| `MultiLevelApprovalService.ts` | 多级串行/并行审批工作流 |
| `ApprovalFlowEngine.ts` | 系统级通用审批流程引擎（流程匹配、启动、节点执行） |
| `ApproverResolver.ts` | 审批人动态解析（角色/部门/汇报线/值班/固定用户）+ 降级链推导 |
| `EmergencyApprovalService.ts` | 紧急审批通道（超时自动批准） |
| `ApprovalTemplateService.ts` | 审批模板管理 |
| `ApprovalTimeoutScheduler.ts` | 审批超时自动处理调度器 |
| `ApprovalAgentPlugin.ts` / `DefaultApprovalAgent.ts` | AI 审批插件接口与默认实现 |
| `ApprovalRepository.ts` | 审批数据访问层（approvals + approval_steps 表） |
| `ApprovalFlowConfigRepository.ts` | 审批流程配置数据访问层 |
| `ApprovalGateRepository.ts` | Pipeline 审批门禁数据访问层 |

---

## 架构设计

### 数据模型

**审批请求（Approval）**
```typescript
interface Approval {
  id, tenant_id, definition_id, resource_type, resource_id
  title, status, requested_by
  current_step, total_steps, required_approvals
  result(JSONB), completed_at, created_at
}
```

**审批步骤（ApprovalStep）**
```typescript
interface ApprovalStep {
  id, approval_id, step_index
  approver_id, status, comment, acted_at
}
```

**审批流程配置（ApprovalFlowConfig）**
```typescript
interface ApprovalFlowConfig {
  id, tenant_id, flow_id, name, description, enabled
  capability_ids(JSONB), environments(JSONB)
  min_risk_level, max_risk_level, priority
  nodes(JSONB), version, created_by, created_at, updated_at
}
```

**Pipeline 审批门禁（ApprovalGate）**
```typescript
interface ApprovalGate {
  id, tenant_id, run_id, stage_id
  status, requested_by, requested_at
  reviewed_by, reviewed_at, comment
  approver_ids(JSONB), metadata(JSONB)
}
```

### 状态机

```
pending ──approved──→ approved (completed)
   │
   └──rejected──→ rejected (completed)
   │
   └──cancelled──→ cancelled (completed)
```

- 串行模式：逐级审批，后一级步骤状态为 waiting，当前级批准后激活下一级
- 并行模式：所有步骤同时为 pending，满足 requiredApprovals 即通过
- 降级链：主审批人不可用 → 备份审批人 → 降级推导（直属领导 → 部门负责人 → 角色升级 → 自动批准）

---

## 功能完整性评估

| 功能 | 状态 | 说明 |
|------|------|------|
| 基础审批 CRUD | ✅ | create/get/approve/reject 完整 |
| 多级串行审批 | ✅ | MultiLevelApprovalService 支持 |
| 多级并行审批 | ✅ | ApprovalMode.PARALLEL 支持 |
| 审批流程匹配 | ✅ | ApprovalFlowEngine.matchFlow 按 capability/environment/riskLevel 匹配 |
| 审批流程配置 CRUD | ✅ | create/get/update/delete/list 完整 |
| 审批人动态解析 | ✅ | role/user/oncall/department/reporting-line |
| 降级链推导 | ✅ | manager → dept-head → role-escalation → auto-approve |
| 紧急审批 | ✅ | EmergencyApprovalService + 超时自动批准 |
| 审批模板 | ✅ | 创建/查询/默认模板 |
| 超时自动处理 | ✅ | ApprovalTimeoutScheduler（提醒/自动批准/自动拒绝） |
| AI 自动审批分析 | ✅ | DefaultApprovalAgent（规则 + LLM 降级） |
| Pipeline 审批门禁 | ✅ | ApprovalGateService（按 run/stage 查询/审批） |
| 审批历史 | ✅ | getApprovalHistory 返回步骤历史 |
| 待审批列表 | ✅ | getPendingApprovals 支持按用户/租户查询 |
| 撤回/取消审批 | ❌ | 缺少 cancel/withdraw 方法 |
| 审批委托/转交 | ❌ | 缺少 delegation 功能 |
| 审批统计/报表 | ❌ | 缺少统计 endpoint |
| 批量审批 | ❌ | 缺少批量操作 |
| 审批规则可视化编辑器 | ❌ | 前端缺失 |
| 审批通知 | ⚠️ | ApprovalTimeoutScheduler 有 NotificationSender 接口但未实际集成 NotificationService |

---

## API 端点清单

| 方法 | 路径 | 功能 | 权限 |
|------|------|------|------|
| POST | /v1/approvals/requests | 提交审批请求 | approval:write |
| GET | /v1/approvals/requests | 审批列表 | approval:read |
| GET | /v1/approvals/requests/:id | 审批详情 | approval:read |
| POST | /v1/approvals/requests/:id/review | 审批操作 | approval:approve |
| POST | /v1/approvals/requests/:id/approve | 审批通过 | approval:approve |
| POST | /v1/approvals/requests/:id/reject | 审批拒绝 | approval:approve |
| GET | /v1/approvals/requests/:id/history | 审批历史 | approval:read |
| POST | /v1/approvals/agent/analyze | Agent 自动分析 | approval:read |
| GET | /v1/approvals/pending | 待审批列表 | approval:read |
| POST | /v1/approvals/emergency | 紧急审批 | approval:write |
| POST | /v1/approvals/templates | 创建模板 | approval:write |
| GET | /v1/approvals/templates | 模板列表 | approval:read |
| GET | /v1/pipeline-runs/:runId/approvals | Pipeline 审批列表 | approval:read |
| GET | /v1/pipeline-runs/:runId/stages/:stageId/approval | Stage 审批状态 | approval:read |
| POST | /v1/pipeline-runs/:runId/stages/:stageId/approve | Pipeline 审批通过 | approval:approve |
| POST | /v1/pipeline-runs/:runId/stages/:stageId/reject | Pipeline 审批拒绝 | approval:approve |

共 **16 个端点**。

---

## 缺失功能

| 缺失项 | 严重程度 | 说明 |
|--------|---------|------|
| 撤回/取消审批 | P1 | 用户无法撤回已提交但未完成的审批 |
| 审批列表接口未实现 | P1 | GET /v1/approvals/requests 返回提示信息，前端无法获取完整列表 |
| 审批通知集成 | P1 | 超时提醒、审批结果通知无法送达用户 |
| 跨租户数据泄露 | P0 | listPending 无 tenant 时返回所有租户数据 |
| 审批统计/报表 | P2 | 无法统计审批时长、通过率、人均待审批数 |
| 审批委托/转交 | P2 | 审批人无法将审批转交给他人 |
| 审批流程版本对比/回滚 | P2 | 修改流程配置后无法回滚 |
| 审批审计日志 | P2 | approval_fallback_logs 表存在但未使用 |

---

## 技术债务

| 问题 | 影响 | 建议 |
|------|------|------|
| listPending 无 tenant 过滤 | 跨租户数据泄露 | 必须加 tenant 过滤 |
| ApprovalFlowEngine 类型断言 as any | 类型不安全 | 在接口中补充 capabilityIds/environments/minRiskLevel/maxRiskLevel |
| ApprovalTemplateService.ensureTable | 生产环境不应 CREATE TABLE | 移除 ensureTable，依赖迁移文件 |
| ApprovalTimeoutScheduler 未自动启动 | 超时调度器不会自动运行 | 在 routes 初始化后启动 scheduler |
| ApprovalFlowEngine 缓存无 TTL | 流程配置更新后缓存不一致 | 添加 TTL（5 分钟）或 update/delete 时失效 |
| ApprovalGateRepository 缺少 tenant 过滤 | 跨租户数据泄露 | 添加 tenant_id 条件 |

---

## 与其他模块集成点

| 模块 | 集成方式 | 状态 |
|------|----------|------|
| 低代码工作流 | WorkflowEngine.executeApprovalNode 调用 ApprovalFlowEngine | ✅ 已集成 |
| Pipeline | ApprovalGateService 处理审批门禁 | ✅ 已集成 |
| AI 服务 | DefaultApprovalAgent.callLLM 调用 AI_SERVICE_URL | ✅ 已集成（降级到规则） |
| Cron 调度 | ApprovalTimeoutScheduler 注册 approval-timeout-scan 任务 | ✅ 已集成 |
| 用户/角色/权限 | ApproverResolver 查询 user_roles/roles/permissions | ✅ 已集成 |
| 值班表 | ApproverResolver.resolveOnCallApprovers | ✅ 已集成 |

---

## 建议优先级

1. **P0**: 修复 listPending 跨租户数据泄露
2. **P1**: 实现 GET /v1/approvals/requests 列表接口
3. **P1**: 在 ApprovalFlowConfig 接口中补充缺失字段
4. **P1**: 在 routes 中启动 ApprovalTimeoutScheduler
5. **P1**: 完整集成 NotificationService
6. **P2**: 添加审批撤回/取消、统计/报表、委托功能
