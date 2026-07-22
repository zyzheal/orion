# 自愈模块深度分析报告

**生成日期**: 2026-07-02
**分析模块**: `orion-platform-service/src/services/self-healing/`

---

## 模块概览

Self-Healing（自愈）模块实现了一个完整的自动化故障自愈引擎，支持告警驱动自愈、策略匹配、风险审批、风暴抑制、知识库推荐等能力。采用 PostgreSQL Repository 持久化，集成 NATS 事件总线和 K8s 真实 API。

### 核心文件

| 文件 | 行数 | 职责 |
|------|------|------|
| `SelfHealingService.ts` | ~400 | 自愈业务编排：事件处理、策略匹配、执行、审批 |
| `SelfHealingRepository.ts` | ~420 | PostgreSQL Repository：incidents / approvals / rules / executions |
| `HealingStrategyEngine.ts` | - | 策略引擎：匹配告警与自愈策略 |
| `HealingActionExecutor.ts` | - | 动作执行器：执行具体自愈动作（重启/扩缩容/切换） |
| `SelfHealingGuardian.ts` | - | 安全护栏：风暴抑制、双人审批、审计日志 |
| `KnowledgeBaseService.ts` | - | 知识库：故障模式、修复步骤、成功率统计 |
| `HealingDecisionMaker.ts` | ~360 | 决策 Maker：自动/手动审批判定（**已死代码**） |
| `types.ts` | - | 类型定义 |
| `index.ts` | - | Barrel export |

---

## 架构设计

### 1. 数据模型

**自愈事件（Incident）**
```typescript
interface HealingIncident {
  id, alert_id, type, severity
  app_name, environment
  strategy_id, strategy_name
  actions: HealingAction[]
  status: IncidentStatus
  attempts, approval_status
  result, error, tags
  started_at, completed_at
}
```

**审批请求（Approval）**
```typescript
interface ApprovalRequest {
  id, incident_id, title, description
  risk_level, recommended_actions
  status: 'pending' | 'approved' | 'rejected' | 'expired'
  requested_by, approved_by
  requested_at, responded_at, expires_at
}
```

**自愈规则（Rule）**
```typescript
interface SelfHealingRule {
  id, tenant_id, name
  trigger_condition: Record<string, any>
  action: Record<string, any>
  enabled, execution_count, last_executed
  created_at, updated_at
}
```

### 2. 核心流程

```
告警事件 → SelfHealingService.handleAlert()
           ↓
         策略匹配（HealingStrategyEngine.match）
           ↓
         风险评估（SelfHealingGuardian.assessRisk）
           ↓
     ┌─────┴─────┐
     ↓           ↓
  低风险       高风险
  自动执行     需要审批
     ↓           ↓
  execute()   createApprovalRequest()
     ↓           ↓
  Guardian    等待审批响应
  审计记录     respondToApproval()
     ↓           ↓
  NATS事件     execute() → Guardian
     ↓           ↓
  更新 incident  更新 incident
```

### 3. 安全护栏（SelfHealingGuardian）

**风暴抑制规则（DEFAULT_STORM_RULES）**：
- 5 分钟内同一 app + env 相同告警只执行 1 次
- 30 分钟内同一 app 最多执行 3 次

**双人审批配置（DEFAULT_DUAL_APPROVAL_CONFIG）**：
- `critical` 级别需要双人确认
- 可配置 autoBlock 级别（无人能批准）

**审计日志**：通过 `HealingAuditRepository` 记录所有自愈动作，支持追溯。

### 4. 事件集成

- 使用 `SelfHealingEventPublisher` 将事件发布到 NATS JetStream
- 支持跨服务通知（如告警已自愈 → 关闭关联 Incident）

---

## 功能完整性评估

| 功能 | 状态 | 说明 |
|------|------|------|
| 告警驱动自愈 | ✅ | handleAlert 入口，支持 MonitoringAlertEvent |
| 策略匹配 | ✅ | HealingStrategyEngine.match |
| 动作执行 | ✅ | HealingActionExecutor（重启/扩缩容/切换） |
| 风暴抑制 | ✅ | SelfHealingGuardian.checkStormSuppression |
| 双人审批 | ✅ | SelfHealingGuardian.requireDualApproval |
| 审批工作流 | ✅ | create/respond/expire 完整流 |
| 审计日志 | ✅ | HealingAuditRepository |
| 自愈规则 CRUD | ✅ | createRule / findAllRules / updateRule / deleteRule |
| 执行历史 | ✅ | createExecution / findExecutions / completeExecution |
| 效能指标 | ✅ | getEffectiveness |
| 知识库 | ⚠️ | 有 KnowledgeBaseService 但未集成到主流程 |
| 决策 Maker | ❌ | HealingDecisionMaker 死代码，SelfHealingService 未使用 |
| 前端页面 | ❌ | 无对应前端页面 |

---

## API 端点清单

| 方法 | 路径 | 功能 | 权限 |
|------|------|------|------|
| POST | /incidents | 创建自愈事件 | selfhealing:write |
| GET | /incidents/:id | 事件详情 | selfhealing:read |
| GET | /history | 自愈历史 | selfhealing:read |
| GET | /effectiveness | 效能指标 | selfhealing:read |
| GET | /strategies | 策略列表 | selfhealing:read |
| GET | /strategies/:id | 策略详情 | selfhealing:read |
| POST | /strategies/:id/toggle | 启用/禁用策略 | selfhealing:write |
| POST | /strategies | 注册自定义策略 | selfhealing:write |
| GET | /approvals | 审批列表 | selfhealing:read |
| GET | /approvals/:id | 审批详情 | selfhealing:read |
| POST | /approvals/:id/respond | 响应审批 | selfhealing:approve |

共 **11 个端点**。

---

## 与前端集成现状

| 后端路由 | 前端页面 | 状态 |
|----------|---------|------|
| self-healing | SelfHealing/ | **有页面但未分析完成度** |

前端 `orion-frontend/src/pages/SelfHealing/` 存在，但需验证是否完整对接 11 个 API 端点。

---

## 缺失功能

| 缺失项 | 严重程度 | 说明 |
|--------|---------|------|
| 多租户隔离 | **P0** | 3 张表（self_healing_incidents / self_healing_approvals / self_healing_audit_log）缺少 tenant_id 字段 |
| 知识库集成 | P1 | KnowledgeBaseService 独立存在，SelfHealingService 未调用，策略匹配未利用历史成功率 |
| 死代码清理 | P2 | HealingDecisionMaker（360 行）未被 SelfHealingService 使用，决策逻辑已内聚到 Guardian |
| 前端页面完善 | P1 | SelfHealing/ 页面存在但需验证功能完整性 |
| 自愈动作 K8s 集成 | P2 | HealingActionExecutor 有接口但 K8s 实际调用待确认 |
| 自愈 SLA | P3 | 未与 SLA 模块集成，无法设置自愈超时 |

---

## 技术债务

| 问题 | 影响 | 建议 |
|------|------|------|
| 3 张表缺少 tenant_id | 多租户数据泄露 | 添加 tenant_id 字段 + 查询过滤 |
| KnowledgeBaseService 未集成 | 功能浪费 | 在策略匹配时调用知识库推荐 |
| HealingDecisionMaker 死代码 | 维护负担 | 删除或整合到 Guardian |
| 自愈规则无版本管理 | 无法回滚 | 添加 version 字段 + 版本对比 |

---

## 与 ITSM/Ticketing 集成点

| 集成点 | 当前状态 | 建议 |
|--------|---------|------|
| 告警 → 自愈 | ✅ 已集成 | handleAlert 接收 MonitoringAlertEvent |
| 自愈 → 工单 | ❌ 未集成 | 自愈失败应自动创建 Ticket |
| 自愈 → 事件 | ✅ 已集成 | 发布 NATS 事件 |
| 审批 → 审批流 | ⚠️ 自实现 | 未复用 ApprovalFlowEngine |

---

## 建议优先级

1. **P0**: 为 self_healing_incidents / approvals / audit_log 添加 tenant_id + 查询过滤
2. **P1**: 将 KnowledgeBaseService 集成到策略匹配流程
3. **P1**: 验证并完善 SelfHealing/ 前端页面功能
4. **P2**: 删除 HealingDecisionMaker 死代码
5. **P3**: 增加自愈规则版本管理 + SLA 集成
