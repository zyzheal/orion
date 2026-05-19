# 全局权限管控体系设计

## 1. 设计目标

建立分层级能力配置体系（Capability System），在现有 RBAC+ABAC 授权架构之上增加**操作级权限管控层**，解决两个核心场景：

1. **ChatOps 场景优先** — 控制高风险命令执行权限（如 `kubectl delete`、批量操作）
2. **全平台通用** — 覆盖所有模块的敏感操作和高级功能

设计原则：**分层级、可组合、后端校验优先、前端按需隐藏、RBAC+ABAC 之上附加**。

---

## 2. 与现有 RBAC+ABAC 授权引擎的关系

### 2.1 现有授权架构（已实现，不修改）

Orion 已有完整的 **统一 RBAC+ABAC 授权引擎**（`AuthorizationEngine`，文件 `orion-platform-service/src/services/authz/AuthorizationEngine.ts`），按严格 5 步流水线评估：

```
[0]  用户状态检查     → disabled/suspended → deny
[1]  super_admin 通配 → 直接 bypass 所有后续检查
[2]  RBAC 检查        → RoleService.checkPermissions(roles, resource, action)
[2.5] Pipeline RBAC   → 仅 pipeline 资源的特例检查
[3]  ABAC 检查        → deny-only 约束（租户隔离、工作时间、跨部门等 6 条预置策略）
[4]  关系检查         → owner / project member
[5]  全部通过         → allow
```

- **RBAC** 是门禁（能不能访问资源）
- **ABAC** 是安全网（进入后有没有额外约束，deny-only 模式）
- **Deny 优先**，任意一层拒绝即最终拒绝
- `super_admin` 在第 [1] 步直接 bypass

**ABAC 已有 6 条预置策略**（`AbacPolicyEngine.ts`）：

| 策略 ID | 约束内容 | 优先级 |
|---------|---------|--------|
| `tenant-isolation` | 只能访问同租户资源 | 99（最高） |
| `resource-owner-full-control` | 资源所有者完全控制 | 100 |
| `restricted-resource-access` | 敏感资源限制特定角色 | 90 |
| `external-network-restriction` | 外部网络只能读操作 | 80 |
| `working-hours-restriction` | 高影响操作只能在工作时间 | 70 |
| `cross-department-restriction` | 不能访问其他部门资源 | 60 |

### 2.2 能力配置体系的定位

**Capability 不是替代 RBAC，而是 RBAC 之上的操作级附加层。**

| 维度 | RBAC 管什么 | Capability 管什么 | ABAC 管什么 |
|------|-----------|-----------------|-----------|
| 问题 | "能不能访问这个资源" | "能不能执行这个操作" | "在什么条件下可以操作" |
| 粒度 | `resource:action`（如 `pipeline:execute`） | 操作级（如 `bulk_operations.restart`） | 属性约束（如时间、网络、租户） |
| 层级 | 扁平 | 树状（父子继承） | 规则表达式 |
| 风险 | 无 | 4 级风险分级 + 审批绑定 | deny 规则 |
| 覆盖 | 角色级 | 角色级 + 用户级临时覆盖 | 策略级 |
| 示例 | `developer` 有 `pipeline:execute` | 但未必能执行 `bulk_operations.rollback` | 且只能在 9-18 点执行 |

**三者在 AuthorizationEngine 中的关系**：

```
请求到达
  │
  ├─ [0] 用户状态检查（现有，不变）
  ├─ [1] super_admin bypass（现有，不变）
  ├─ [2] RBAC 检查（现有，不变）→ denied → 403
  │
  ├─ [2.1] Capability 检查（新增）→ denied → 403 "需要额外能力授权"
  │
  ├─ [2.5] Pipeline RBAC（现有，不变）
  ├─ [3]  ABAC 检查（现有，不变）→ denied → 403
  ├─ [4]  关系检查（现有，不变）→ denied → 403
  │
  └─ [5] 全部通过 → allow
```

**关键设计决策**：

- **能力 ≠ 权限** — 权限（Permission）控制资源访问，能力（Capability）控制操作执行
- **Capability 在 RBAC 之后、ABAC 之前** — 先确认你能访问资源，再确认你能执行操作，最后确认条件是否满足
- **ABAC 保持不变** — 仍是 deny-only 模式，仅施加环境约束，不授予权限
- **用户级覆盖** — 管理员可以为特定用户临时授予/撤销能力，不改变角色本身
- **复用现有基础设施** — CapabilityEngine 复用现有的 `PermissionAuditRepository`、`PermissionCache`、`UEBAEngine`

---

## 3. 架构分层

```
┌──────────────────────────────────────────────────────────────────┐
│  UI 展示层                                                        │
│  PermissionGate / CapabilityGate 组件 / 条件渲染 / 按钮禁用         │
│  → 根据 capability 列表显示/隐藏功能                               │
├──────────────────────────────────────────────────────────────────┤
│  前端能力层                                                        │
│  CapabilityStore (has('chatops_advanced.command.kubectl_delete'))  │
│  → 缓存自 GET /api/v1/authz/capabilities                           │
├──────────────────────────────────────────────────────────────────┤
│  后端授权层（统一 AuthorizationEngine）                              │
│  [0]  用户状态                                                     │
│  [1]  super_admin bypass                                          │
│  [2]  RBAC（RoleService）                                         │
│  [2.1] Capability（CapabilityEngine）← 新增步骤                    │
│  [2.5] Pipeline RBAC（PipelineRBACService）                       │
│  [3]  ABAC（AbacPolicyEngine, deny-only）                         │
│  [4]  关系检查（RelationshipService）                              │
│  → deny 优先，任何一层拒绝即拒绝                                     │
├──────────────────────────────────────────────────────────────────┤
│  数据层                                                           │
│  capabilities (DB) + role_capabilities (DB) + user_overrides (DB) │
│  → 复用现有的 roles/permissions/audit 基础设施                      │
└──────────────────────────────────────────────────────────────────┘
```

---

## 4. 能力层级设计

### 4.1 能力结构

```typescript
interface Capability {
  id: string;          // 唯一标识，如 "deployment_operations.deploy_prod"
  name: string;        // 显示名称，如 "生产环境部署"
  description: string;
  category: string;    // 分类：pipeline / deployment / chatops / sensitive ...
  riskLevel: 1 | 2 | 3 | 4;  // 风险等级
  requiresApproval: boolean;  // 是否需要审批
  parentId?: string;   // 父能力 ID，NULL 表示顶级
  enabled: boolean;
  defaultRoles: string[];     // 默认拥有此能力的角色
}
```

### 4.2 完整能力树（30 个顶级能力，约 210 个子能力）

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            一、ChatOps 能力 (chatops)                        │
├─────────────────────────────────────────────────────────────────────────────┤
chatops_advanced (风险3)
├── chatops_advanced.command.kubectl (风险3)
│   ├── chatops_advanced.command.kubectl.get (风险1)
│   ├── chatops_advanced.command.kubectl.describe (风险1)
│   ├── chatops_advanced.command.kubectl.logs (风险2)
│   ├── chatops_advanced.command.kubectl.restart (风险3)
│   ├── chatops_advanced.command.kubectl.scale (风险3)
│   ├── chatops_advanced.command.kubectl.exec (风险3)
│   ├── chatops_advanced.command.kubectl.debug (风险2)
│   └── chatops_advanced.command.kubectl.delete (风险4)
├── chatops_advanced.command.deploy (风险3)
│   ├── chatops_advanced.command.deploy.preview (风险1)
│   ├── chatops_advanced.command.deploy.staging (风险2)
│   └── chatops_advanced.command.deploy.production (风险4)
└── chatops_advanced.command.custom (风险2)

chatops_command_create (风险3)
├── chatops_command_create.draft (风险1)
├── chatops_command_create.publish (风险3)
└── chatops_command_create.approve (风险3)

┌─────────────────────────────────────────────────────────────────────────────┐
│                            二、流水线操作能力 (pipeline)                      │
├─────────────────────────────────────────────────────────────────────────────┤
pipeline_operations (风险3)
├── pipeline_operations.create (风险2)
├── pipeline_operations.delete (风险4)
├── pipeline_operations.edit (风险2)
├── pipeline_operations.trigger (风险2)
├── pipeline_operations.trigger_prod (风险4)
├── pipeline_operations.cancel (风险2)
├── pipeline_operations.version_revert (风险3)
├── pipeline_operations.budget_modify (风险3)
├── pipeline_operations.template_manage (风险3)
└── pipeline_operations.approve (风险3)

┌─────────────────────────────────────────────────────────────────────────────┐
│                            三、制品操作能力 (artifact)                        │
├─────────────────────────────────────────────────────────────────────────────┤
artifact_operations (风险3)
├── artifact_operations.upload (风险2)
├── artifact_operations.delete (风险4)
├── artifact_operations.version_manage (风险3)
├── artifact_operations.version_rollback (风险3)
├── artifact_operations.promote (风险3)
├── artifact_operations.download (风险1)
└── artifact_operations.internal_publish (风险3)

┌─────────────────────────────────────────────────────────────────────────────┐
│                            四、环境操作能力 (environment)                     │
├─────────────────────────────────────────────────────────────────────────────┤
environment_operations (风险3)
├── environment_operations.create (风险3)
├── environment_operations.destroy (风险4)
├── environment_operations.reset (风险3)
├── environment_operations.restore (风险4)
├── environment_operations.config_modify (风险3)
├── environment_operations.ephemeral_create (风险2)
├── environment_operations.ephemeral_destroy (风险3)
└── environment_operations.config_rollback (风险3)

┌─────────────────────────────────────────────────────────────────────────────┐
│                            五、部署操作能力 (deployment)                      │
├─────────────────────────────────────────────────────────────────────────────┤
deployment_operations (风险4)
├── deployment_operations.deploy_staging (风险3)
├── deployment_operations.deploy_prod (风险4)
├── deployment_operations.rollback (风险4)
├── deployment_operations.canary_config (风险3)
├── deployment_operations.traffic_switch (风险4)
└── deployment_operations.smart_deploy (风险3)

┌─────────────────────────────────────────────────────────────────────────────┐
│                            六、运维操作能力 (infrastructure)                  │
├─────────────────────────────────────────────────────────────────────────────┤
infrastructure_operations (风险3)
├── infrastructure_operations.env_create (风险3)
├── infrastructure_operations.env_destroy (风险4)
├── infrastructure_operations.env_reset (风险3)
├── infrastructure_operations.env_restore (风险4)
├── infrastructure_operations.env_config (风险3)
├── infrastructure_operations.temp_env_create (风险2)
├── infrastructure_operations.secret_view (风险3)
├── infrastructure_operations.secret_write (风险4)
├── infrastructure_operations.config_view (风险1)
├── infrastructure_operations.config_write (风险3)
└── infrastructure_operations.config_rollback (风险3)

iac_operations (风险3)
├── iac_operations.plan_create (风险2)
├── iac_operations.plan_apply (风险3)
├── iac_operations.state_import (风险3)
├── iac_operations.state_rollback (风险4)
└── iac_operations.resource_destroy (风险4)

┌─────────────────────────────────────────────────────────────────────────────┐
│                            七、交付操作能力 (delivery)                        │
├─────────────────────────────────────────────────────────────────────────────┤
delivery_operations (风险3)
├── delivery_operations.pipeline_create (风险2)
├── delivery_operations.pipeline_delete (风险4)
├── delivery_operations.pipeline_trigger (风险2)
├── delivery_operations.pipeline_edit (风险2)
├── delivery_operations.pipeline_rollback (风险3)
├── delivery_operations.artifact_delete (风险4)
├── delivery_operations.artifact_rollback (风险3)
├── delivery_operations.version_promote (风险2)
└── delivery_operations.version_revert (风险3)

┌─────────────────────────────────────────────────────────────────────────────┐
│                            八、批量操作能力 (bulk)                            │
├─────────────────────────────────────────────────────────────────────────────┤
bulk_operations (风险3)
├── bulk_operations.restart (风险3)
├── bulk_operations.deploy (风险3)
├── bulk_operations.rollback (风险4)
└── bulk_operations.delete (风险4)

┌─────────────────────────────────────────────────────────────────────────────┐
│                            九、备份/灾备能力 (backup)                         │
├─────────────────────────────────────────────────────────────────────────────┤
backup_operations (风险3)
├── backup_operations.create (风险3)
├── backup_operations.restore (风险4)
├── backup_operations.schedule (风险3)
├── backup_operations.delete (风险4)
├── backup_operations.verify (风险2)
└── backup_operations.export (风险2)

disaster_recovery (风险4)
├── disaster_recovery.plan_create (风险3)
├── disaster_recovery.plan_execute (风险4)
├── disaster_recovery.plan_test (风险3)
├── disaster_recovery.failover (风险4)
└── disaster_recovery.failback (风险4)

┌─────────────────────────────────────────────────────────────────────────────┐
│                            十、用户权限能力 (user)                            │
├─────────────────────────────────────────────────────────────────────────────┤
user_management (风险3)
├── user_management.user_disable (风险3)
├── user_management.user_enable (风险2)
├── user_management.user_create (风险2)
├── user_management.role_assign (风险3)
├── user_management.role_revoke (风险3)
└── user_management.bulk_import (风险2)

┌─────────────────────────────────────────────────────────────────────────────┐
│                            十一、安全操作能力 (security)                      │
├─────────────────────────────────────────────────────────────────────────────┤
security_operations (风险4)
├── security_operations.policy_modify (风险4)
├── security_operations.compliance_rule_modify (风险4)
├── security_operations.sbom_manage (风险3)
├── security_operations.supply_chain_check (风险3)
├── security_operations.risk_rule_modify (风险4)
└── security_operations.approval_bypass (风险4)

┌─────────────────────────────────────────────────────────────────────────────┐
│                            十二、审批操作能力 (approval)                      │
├─────────────────────────────────────────────────────────────────────────────┤
approval_operations (风险4)
├── approval_operations.create (风险2)
├── approval_operations.approve (风险3)
├── approval_operations.reject (风险3)
├── approval_operations.bypass (风险4)
├── approval_operations.rule_modify (风险4)
└── approval_operations.force_pass (风险4)

┌─────────────────────────────────────────────────────────────────────────────┐
│                            十三、工单操作能力 (ticketing)                     │
├─────────────────────────────────────────────────────────────────────────────┤
ticketing_operations (风险2)
├── ticketing_operations.create (风险1)
├── ticketing_operations.assign (风险2)
├── ticketing_operations.transfer (风险2)
├── ticketing_operations.close (风险2)
├── ticketing_operations.priority_modify (风险3)
└── ticketing_operations.bulk_close (风险3)

┌─────────────────────────────────────────────────────────────────────────────┐
│                            十四、混沌工程能力 (chaos)                         │
├─────────────────────────────────────────────────────────────────────────────┤
chaos_operations (风险4)
├── chaos_operations.inject (风险4)
├── chaos_operations.experiment_create (风险3)
├── chaos_operations.experiment_execute (风险4)
├── chaos_operations.degradation_rule_modify (风险4)
├── chaos_operations.self_healing_trigger (风险3)
└── chaos_operations.self_healing_config (风险3)

┌─────────────────────────────────────────────────────────────────────────────┐
│                            十五、FinOps 操作能力 (finops)                     │
├─────────────────────────────────────────────────────────────────────────────┤
finops_operations (风险3)
├── finops_operations.budget_modify (风险3)
├── finops_operations.cost_rule_modify (风险3)
├── finops_operations.export (风险2)
├── finops_operations.ai_cost_view (风险1)
└── finops_operations.ai_cost_optimize (风险2)

┌─────────────────────────────────────────────────────────────────────────────┐
│                            十六、知识库能力 (knowledge)                       │
├─────────────────────────────────────────────────────────────────────────────┤
knowledge_operations (风险2)
├── knowledge_operations.article_create (风险2)
├── knowledge_operations.article_edit (风险2)
├── knowledge_operations.article_delete (风险4)
├── knowledge_operations.version_rollback (风险3)
├── knowledge_operations.category_manage (风险2)
└── knowledge_operations.export (风险2)

┌─────────────────────────────────────────────────────────────────────────────┐
│                            十七、模型版本能力 (model)                         │
├─────────────────────────────────────────────────────────────────────────────┤
model_version_operations (风险3)
├── model_version_operations.register (风险2)
├── model_version_operations.deprecate (风险3)
├── model_version_operations.rollback (风险3)
└── model_version_operations.archive (风险3)

┌─────────────────────────────────────────────────────────────────────────────┐
│                            十八、测试管理能力 (test)                          │
├─────────────────────────────────────────────────────────────────────────────┤
test_management (风险2)
├── test_management.case_create (风险2)
├── test_management.case_edit (风险2)
├── test_management.case_delete (风险3)
├── test_management.case_rollback (风险3)
├── test_management.suite_manage (风险2)
└── test_management.execution_trigger (风险2)

┌─────────────────────────────────────────────────────────────────────────────┐
│                            十九、数据管道能力 (data_pipeline)                 │
├─────────────────────────────────────────────────────────────────────────────┤
data_pipeline_operations (风险3)
├── data_pipeline_operations.create (风险2)
├── data_pipeline_operations.delete (风险3)
├── data_pipeline_operations.start (风险3)
├── data_pipeline_operations.stop (风险3)
├── data_pipeline_operations.retry (风险2)
└── data_pipeline_operations.trigger_rule (风险3)

┌─────────────────────────────────────────────────────────────────────────────┐
│                            二十、Cron/定时任务能力 (cron)                     │
├─────────────────────────────────────────────────────────────────────────────┤
cron_operations (风险3)
├── cron_operations.create (风险2)
├── cron_operations.delete (风险3)
├── cron_operations.modify (风险3)
├── cron_operations.enable (风险2)
├── cron_operations.disable (风险2)
└── cron_operations.execute_now (风险3)

┌─────────────────────────────────────────────────────────────────────────────┐
│                            二十一、分支策略能力 (branch)                      │
├─────────────────────────────────────────────────────────────────────────────┤
branch_operations (风险3)
├── branch_operations.policy_create (风险2)
├── branch_operations.policy_modify (风险3)
├── branch_operations.policy_delete (风险4)
├── branch_operations.policy_bypass (风险4)
└── branch_operations.merge_approve (风险3)

┌─────────────────────────────────────────────────────────────────────────────┐
│                            二十二、分析能力 (analytics)                       │
├─────────────────────────────────────────────────────────────────────────────┤
advanced_analytics (风险1)
├── advanced_analytics.view_dashboard (风险1)
├── advanced_analytics.export_report (风险2)
├── advanced_analytics.custom_dimension (风险2)
├── advanced_analytics.efficiency_view (风险1)
├── advanced_analytics.efficiency_config (风险2)
├── advanced_analytics.workbench_config (风险1)
└── advanced_analytics.executive_view (风险2)

┌─────────────────────────────────────────────────────────────────────────────┐
│                            二十三、审计合规能力 (audit)                       │
├─────────────────────────────────────────────────────────────────────────────┤
audit_management (风险2)
├── audit_management.view (风险2)
├── audit_management.export (风险2)
├── audit_management.config (风险2)
├── audit_management.compliance_report (风险2)
├── audit_management.permission_audit (风险3)
├── audit_management.ueba_view (风险2)
└── audit_management.chain_verify (风险3)

┌─────────────────────────────────────────────────────────────────────────────┐
│                            二十四、系统配置能力 (system)                      │
├─────────────────────────────────────────────────────────────────────────────┤
system_config (风险3)
├── system_config.read (风险1)
├── system_config.write (风险3)
├── system_config.delete (风险4)
├── system_config.webhook_manage (风险3)
├── system_config.notification_manage (风险3)
├── system_config.branch_policy_manage (风险3)
├── system_config.maintenance_window (风险2)
├── system_config.api_key_manage (风险3)
└── system_config.apk_manage (风险1)

┌─────────────────────────────────────────────────────────────────────────────┐
│                            二十五、生态扩展能力 (ecosystem)                   │
├─────────────────────────────────────────────────────────────────────────────┤
ecosystem_operations (风险3)
├── ecosystem_operations.plugin_install (风险4)
├── ecosystem_operations.plugin_uninstall (风险4)
├── ecosystem_operations.plugin_config (风险3)
├── ecosystem_operations.skill_publish (风险3)
├── ecosystem_operations.skill_unpublish (风险3)
├── ecosystem_operations.skill_approve (风险3)
├── ecosystem_operations.plugin_hotreload (风险3)
├── ecosystem_operations.spi_register (风险3)
├── ecosystem_operations.community_publish (风险2)
└── ecosystem_operations.community_approve (风险3)

┌─────────────────────────────────────────────────────────────────────────────┐
│                            二十六、AI 网关能力 (ai_gateway)                   │
├─────────────────────────────────────────────────────────────────────────────┤
ai_gateway_operations (风险3)
├── ai_gateway_operations.config_read (风险1)
├── ai_gateway_operations.config_write (风险3)
├── ai_gateway_operations.route_manage (风险3)
├── ai_gateway_operations.provider_manage (风险4)
└── ai_gateway_operations.scenario_manage (风险3)

┌─────────────────────────────────────────────────────────────────────────────┐
│                            二十七、AI 高级能力 (ai_advanced)                  │
├─────────────────────────────────────────────────────────────────────────────┤
ai_advanced_operations (风险3)
├── ai_advanced.vector_index_create (风险2)
├── ai_advanced.vector_index_delete (风险3)
├── ai_advanced.vector_query (风险2)
├── ai_advanced.mcp_register (风险3)
├── ai_advanced.mcp_unregister (风险3)
├── ai_advanced.llm_trace_view (风险1)
├── ai_advanced.llm_trace_delete (风险3)
├── ai_advanced.llm_trace_config (风险2)
├── ai_advanced.ai_cost_view (风险1)
└── ai_advanced.ai_cost_optimize (风险2)

┌─────────────────────────────────────────────────────────────────────────────┐
│                            二十八、数字孪生能力 (digital_twin)                │
├─────────────────────────────────────────────────────────────────────────────┤
digital_twin_operations (风险2)
├── digital_twin_operations.create (风险2)
├── digital_twin_operations.delete (风险3)
├── digital_twin_operations.mapping_modify (风险3)
└── digital_twin_operations.sync (风险2)

┌─────────────────────────────────────────────────────────────────────────────┐
│                            二十九、监控能力 (monitoring)                      │
├─────────────────────────────────────────────────────────────────────────────┤
monitoring_operations (风险2)
├── monitoring_operations.dashboard_create (风险2)
├── monitoring_operations.dashboard_delete (风险3)
├── monitoring_operations.metric_query (风险1)
├── monitoring_operations.dashboard_export (风险2)
├── monitoring_operations.rule_create (风险3)
├── monitoring_operations.rule_delete (风险3)
├── monitoring_operations.diagnostic_config (风险2)
├── monitoring_operations.ueba_config (风险3)
└── monitoring_operations.decision_config (风险2)

┌─────────────────────────────────────────────────────────────────────────────┐
│                            三十、告警能力 (alert)                             │
├─────────────────────────────────────────────────────────────────────────────┤
alert_operations (风险3)
├── alert_operations.rule_create (风险3)
├── alert_operations.rule_edit (风险3)
├── alert_operations.rule_delete (风险3)
├── alert_operations.silence_create (风险2)
├── alert_operations.silence_manage (风险2)
├── alert_operations.notification_config (风险3)
├── alert_operations.escalation_config (风险3)
├── alert_operations.oncall_config (风险2)
└── alert_operations.maintenance_window (风险3)

┌─────────────────────────────────────────────────────────────────────────────┐
│                            三十一、敏感操作能力 (sensitive)                   │
├─────────────────────────────────────────────────────────────────────────────┤
sensitive_operations (风险4)
├── sensitive_operations.project_delete (风险4)
├── sensitive_operations.environment_destroy (风险4)
├── sensitive_operations.data_wipe (风险4)
├── sensitive_operations.approval_bypass (风险4)
└── sensitive_operations.critical_config (风险4)

┌─────────────────────────────────────────────────────────────────────────────┐
│                            三十二、跨域能力 (cross_tenant_operations)                   │
├─────────────────────────────────────────────────────────────────────────────┤
cross_tenant_operations (风险4)
├── cross_tenant_operations.access (风险4)
├── cross_tenant_operations.federation_config (风险4)
├── cross_tenant_operations.data_sync (风险4)
└── cross_tenant_operations.resource_share (风险3)

org_access (风险3)
├── org_access.view_other_dept (风险2)
└── org_access.operate_other_dept (风险4)
```

### 4.3 风险等级与审批

| 风险等级 | 说明 | 典型操作 | 默认行为 |
|---------|------|---------|---------|
| 1 | 低风险（只读、查看） | 查看资源、查看仪表盘、预览部署 | 默认开放，无需审批 |
| 2 | 中风险（信息获取、触发） | 查看日志、导出报表、手动触发、环境创建 | 默认开放，记录审计日志 |
| 3 | 高风险（变更、配置） | 重启服务、修改配置、创建流水线、发布 Skill | 需要能力 + 操作确认 |
| 4 | 极高风险（破坏、越权） | 删除、销毁、回滚、跨租户、绕过审批 | 需要能力 + 审批流 + 双人确认 |

### 4.4 能力统计

| 类别 | 顶级能力数 | 子能力数 | 具备回滚 | 需要回滚 |
|------|-----------|---------|---------|---------|
| ChatOps | 2 | 14 | 0 | 2 |
| 流水线 | 1 | 10 | 1 | 0 |
| 制品 | 1 | 7 | 1 | 0 |
| 环境 | 1 | 8 | 2 | 0 |
| 部署 | 1 | 6 | 1 | 0 |
| 基础设施/IaC | 2 | 17 | 3 | 0 |
| 交付 | 1 | 9 | 2 | 0 |
| 批量 | 1 | 4 | 1 | 0 |
| 备份/灾备 | 2 | 11 | 3 | 0 |
| 用户 | 1 | 6 | 0 | 1 |
| 安全 | 1 | 6 | 0 | 1 |
| 审批 | 1 | 6 | 0 | 1 |
| 工单 | 1 | 6 | 0 | 1 |
| 混沌 | 1 | 6 | 0 | 1 |
| FinOps | 1 | 5 | 0 | 1 |
| 知识库 | 1 | 6 | 1 | 0 |
| 模型 | 1 | 4 | 1 | 0 |
| 测试 | 1 | 6 | 1 | 0 |
| 数据管道 | 1 | 6 | 0 | 1 |
| Cron | 1 | 6 | 0 | 1 |
| 分支策略 | 1 | 5 | 0 | 1 |
| 分析 | 1 | 7 | 0 | 1 |
| 审计 | 1 | 7 | 0 | 1 |
| 系统配置 | 1 | 9 | 0 | 1 |
| 生态 | 1 | 10 | 0 | 1 |
| AI 网关 | 1 | 5 | 0 | 1 |
| AI 高级 | 1 | 10 | 0 | 1 |
| 数字孪生 | 1 | 4 | 0 | 1 |
| 监控 | 1 | 9 | 0 | 1 |
| 告警 | 1 | 9 | 0 | 1 |
| 敏感操作 | 1 | 5 | 0 | 1 |
| 跨域 | 2 | 6 | 0 | 2 |
| **总计** | **32** | **~210** | **16 (50%)** | **16 (50%)** |

---

## 5. 数据库设计

### 5.1 新增表

```sql
-- 能力定义表
CREATE TABLE capabilities (
    id VARCHAR(128) PRIMARY KEY,                     -- 'deployment_operations.deploy_prod'
    name VARCHAR(128) NOT NULL,                      -- '生产环境部署'
    description TEXT,
    category VARCHAR(32) NOT NULL,                   -- 'deployment', 'pipeline', 'chatops' ...
    risk_level INTEGER NOT NULL DEFAULT 1,           -- 1-4
    requires_approval BOOLEAN NOT NULL DEFAULT false,
    parent_id VARCHAR(128) REFERENCES capabilities(id),  -- 父能力，NULL 表示顶级
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now()
);

-- 角色能力关联表
CREATE TABLE role_capabilities (
    id BIGSERIAL PRIMARY KEY,
    role_id BIGINT NOT NULL REFERENCES roles(id),
    capability_id VARCHAR(128) NOT NULL REFERENCES capabilities(id),
    granted BOOLEAN NOT NULL DEFAULT true,           -- true=授予，false=显式拒绝
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    UNIQUE(role_id, capability_id)
);

-- 用户能力覆盖表（针对特定用户临时授予/撤销）
CREATE TABLE user_capability_overrides (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id),
    capability_id VARCHAR(128) NOT NULL REFERENCES capabilities(id),
    granted BOOLEAN NOT NULL,                        -- true=额外授予，false=强制撤销
    reason TEXT,
    granted_by BIGINT REFERENCES users(id),          -- 谁授予的
    expires_at TIMESTAMP,                            -- 临时权限过期时间
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    UNIQUE(user_id, capability_id)
);

-- 能力使用审计日志（复用现有 permission_audit_logs，增加 check_type 字段）
ALTER TABLE permission_audit_logs ADD COLUMN IF NOT EXISTS check_type VARCHAR(16);
-- check_type: 'rbac' | 'capability' | 'abac' | 'relationship'

-- 索引
CREATE INDEX idx_capabilities_category ON capabilities(category);
CREATE INDEX idx_capabilities_parent ON capabilities(parent_id);
CREATE INDEX idx_capabilities_risk ON capabilities(risk_level);
CREATE INDEX idx_role_capabilities_role ON role_capabilities(role_id);
CREATE INDEX idx_role_capabilities_cap ON role_capabilities(capability_id);
CREATE INDEX idx_user_capability_overrides_user ON user_capability_overrides(user_id);
CREATE INDEX idx_user_capability_overrides_expires ON user_capability_overrides(expires_at);
CREATE INDEX idx_user_capability_overrides_active ON user_capability_overrides(user_id, capability_id) WHERE expires_at IS NULL OR expires_at > now();
```

### 5.2 数据迁移策略

1. **种子数据生成**：从能力树定义生成 `capabilities` 表初始数据（~210 条）
2. **角色映射**：从现有 `permissions` 表推导初始 `role_capabilities`
   - `super_admin` → 所有能力 granted=true
   - `platform_admin` → 除 sensitive_operations、cross_tenant_operations 外全部 granted
   - `sre` → infrastructure/backup/disaster_recovery/monitoring/alert 等运维相关
   - `developer` → pipeline/delivery/test/knowledge 等开发相关
   - `viewer` → 仅 risk_level=1 的只读能力
3. **高风险能力默认限制**：risk_level >= 4 的能力仅授予 `super_admin`、`platform_admin`、`sre`

### 5.3 种子数据示例

```sql
-- 顶级能力
INSERT INTO capabilities (id, name, description, category, risk_level, requires_approval) VALUES
('chatops_advanced', 'ChatOps 高级操作', 'ChatOps 对话中的高级命令执行', 'chatops', 3, false),
('pipeline_operations', '流水线操作', '流水线创建、触发、删除等操作', 'pipeline', 3, false),
('deployment_operations', '部署操作', '生产/预发部署、回滚、金丝雀', 'deployment', 4, true),
('sensitive_operations', '敏感操作', '项目删除、数据清空等极高风险操作', 'sensitive', 4, true);

-- 子能力
INSERT INTO capabilities (id, name, description, category, risk_level, requires_approval, parent_id) VALUES
('chatops_advanced.command.kubectl.delete', 'K8s 删除资源', '通过 ChatOps 执行 kubectl delete', 'chatops', 4, true, 'chatops_advanced.command.kubectl'),
('deployment_operations.deploy_prod', '生产环境部署', '将应用部署到生产环境', 'deployment', 4, true, 'deployment_operations'),
('pipeline_operations.trigger_prod', '触发生产流水线', '手动触发生产环境流水线执行', 'pipeline', 4, true, 'pipeline_operations');

-- 角色能力映射
INSERT INTO role_capabilities (role_id, capability_id, granted)
SELECT r.id, 'pipeline_operations', true FROM roles r WHERE r.name IN ('super_admin', 'platform_admin', 'sre', 'developer');

INSERT INTO role_capabilities (role_id, capability_id, granted)
SELECT r.id, 'deployment_operations.deploy_prod', true FROM roles r WHERE r.name IN ('super_admin', 'platform_admin', 'sre');
```

---

## 6. 后端实现

### 6.1 CapabilityEngine

```typescript
// orion-platform-service/src/services/authz/CapabilityEngine.ts

import pino from 'pino';
import { PermissionCache } from './PermissionCache';
import { PermissionAuditRepository } from '../../repositories/PermissionAuditRepository';
import type { CacheService } from '../cache/CacheService';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

interface CapabilityCheckRequest {
  userId: string;
  userRoles: string[];
  capabilityId: string;
  resource?: { type: string; id: string };
  context?: Record<string, unknown>;
}

interface CapabilityCheckResult {
  allowed: boolean;
  reason: string;
  requiresApproval: boolean;
  riskLevel: number;
  capability?: CapabilityInfo;
}

interface CapabilityInfo {
  id: string;
  name: string;
  category: string;
  riskLevel: number;
  requiresApproval: boolean;
}

interface GrantOptions {
  reason: string;
  grantedBy: string;
  expiresAt?: Date;
}

export class CapabilityEngine {
  private cache: PermissionCache | null = null;

  constructor(
    private auditRepo: PermissionAuditRepository,
    cacheService?: CacheService | null,
    cacheTtlSeconds: number = 300,
  ) {
    if (cacheService) {
      this.cache = new PermissionCache(cacheService, cacheTtlSeconds);
    }
  }

  /**
   * 检查用户是否拥有指定能力
   * 评估顺序：用户覆盖 → 角色能力 → 能力继承
   */
  async check(request: CapabilityCheckRequest): Promise<CapabilityCheckResult> {
    const { userId, userRoles, capabilityId } = request;
    const startTime = Date.now();

    // 1. 获取能力定义
    const capability = await this.getCapability(capabilityId);
    if (!capability) {
      return {
        allowed: false,
        reason: `Capability not found: ${capabilityId}`,
        requiresApproval: false,
        riskLevel: 0,
      };
    }

    // 2. 检查用户级覆盖（优先级最高）
    const overrideResult = await this.checkUserOverride(userId, capabilityId);
    if (overrideResult !== null) {
      return {
        allowed: overrideResult.granted,
        reason: overrideResult.granted
          ? `User override granted: ${overrideResult.reason}`
          : `User override denied: ${overrideResult.reason}`,
        requiresApproval: capability.requiresApproval,
        riskLevel: capability.riskLevel,
        capability,
      };
    }

    // 3. 检查角色能力
    const roleResult = await this.checkRoleCapabilities(userRoles, capabilityId);
    if (roleResult !== null) {
      return {
        allowed: roleResult.granted,
        reason: roleResult.granted
          ? `Granted by role: ${roleResult.role}`
          : `Denied by role: ${roleResult.role}`,
        requiresApproval: capability.requiresApproval,
        riskLevel: capability.riskLevel,
        capability,
      };
    }

    // 4. 检查能力继承（父能力授予则子能力自动拥有）
    const inheritResult = await this.checkInheritance(userRoles, capabilityId);
    if (inheritResult) {
      return {
        allowed: true,
        reason: `Inherited from parent capability`,
        requiresApproval: capability.requiresApproval,
        riskLevel: capability.riskLevel,
        capability,
      };
    }

    // 5. 无匹配 → 拒绝
    return {
      allowed: false,
      reason: `No capability grant found: ${capabilityId} for user ${userId}`,
      requiresApproval: capability.requiresApproval,
      riskLevel: capability.riskLevel,
      capability,
    };
  }

  /**
   * 获取用户所有能力列表（前端初始化时调用）
   */
  async getUserCapabilities(userId: string, userRoles: string[]): Promise<CapabilityInfo[]> {
    const capabilities: Map<string, CapabilityInfo> = new Map();

    // 从用户覆盖获取
    const overrides = await this.getUserOverrides(userId);
    for (const cap of overrides) {
      if (cap.granted) capabilities.set(cap.id, cap);
    }

    // 从角色获取
    for (const role of userRoles) {
      const roleCaps = await this.getRoleCapabilities(role);
      for (const cap of roleCaps) {
        if (cap.granted && !capabilities.has(cap.id)) {
          capabilities.set(cap.id, cap);
        }
      }
    }

    // 添加继承的能力
    const inherited = await this.getInheritedCapabilities(Array.from(capabilities.keys()));
    for (const cap of inherited) {
      if (!capabilities.has(cap.id)) {
        capabilities.set(cap.id, cap);
      }
    }

    return Array.from(capabilities.values());
  }

  /**
   * 授予用户临时能力覆盖
   */
  async grantCapability(userId: string, capabilityId: string, options: GrantOptions): Promise<void> {
    await this.dbQuery(
      `INSERT INTO user_capability_overrides (user_id, capability_id, granted, reason, granted_by, expires_at)
       VALUES ($1, $2, true, $3, $4, $5)
       ON CONFLICT (user_id, capability_id)
       DO UPDATE SET granted = true, reason = $3, granted_by = $4, expires_at = $5, created_at = now()`,
      [userId, capabilityId, options.reason, options.grantedBy, options.expiresAt]
    );

    await this.logAudit(userId, capabilityId, 'grant', 'allowed', options);
  }

  /**
   * 撤销用户能力覆盖
   */
  async revokeCapability(userId: string, capabilityId: string): Promise<void> {
    await this.dbQuery(
      `DELETE FROM user_capability_overrides WHERE user_id = $1 AND capability_id = $2`,
      [userId, capabilityId]
    );

    await this.logAudit(userId, capabilityId, 'revoke', 'denied');
  }

  // === 私有方法 ===

  private async getCapability(id: string): Promise<CapabilityInfo | null> {
    const result = await this.dbQuery(
      'SELECT id, name, category, risk_level, requires_approval FROM capabilities WHERE id = $1 AND enabled = true',
      [id]
    );
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
      id: row.id,
      name: row.name,
      category: row.category,
      riskLevel: row.risk_level,
      requiresApproval: row.requires_approval,
    };
  }

  private async checkUserOverride(userId: string, capabilityId: string): Promise<{ granted: boolean; reason: string } | null> {
    const result = await this.dbQuery(
      `SELECT granted, reason FROM user_capability_overrides
       WHERE user_id = $1 AND capability_id = $2
       AND (expires_at IS NULL OR expires_at > now())`,
      [userId, capabilityId]
    );
    if (result.rows.length === 0) return null;
    return { granted: result.rows[0].granted, reason: result.rows[0].reason };
  }

  private async checkRoleCapabilities(userRoles: string[], capabilityId: string): Promise<{ granted: boolean; role: string } | null> {
    const result = await this.dbQuery(
      `SELECT rc.granted, r.name as role
       FROM role_capabilities rc
       JOIN roles r ON r.id = rc.role_id
       WHERE rc.capability_id = $1 AND r.name = ANY($2)
       ORDER BY r.name
       LIMIT 1`,
      [capabilityId, userRoles]
    );
    if (result.rows.length === 0) return null;
    return { granted: result.rows[0].granted, role: result.rows[0].role };
  }

  private async checkInheritance(userRoles: string[], capabilityId: string): Promise<boolean> {
    // 获取该能力的父能力链
    const parents = await this.getCapabilityParents(capabilityId);
    for (const parentId of parents) {
      const roleResult = await this.checkRoleCapabilities(userRoles, parentId);
      if (roleResult?.granted) {
        // 检查子能力是否被显式拒绝
        const denyResult = await this.checkRoleCapabilities(userRoles, capabilityId);
        if (denyResult?.granted === false) return false;
        return true;
      }
    }
    return false;
  }

  private async getCapabilityParents(capabilityId: string): Promise<string[]> {
    const parents: string[] = [];
    let current = capabilityId;
    while (true) {
      const result = await this.dbQuery(
        'SELECT parent_id FROM capabilities WHERE id = $1',
        [current]
      );
      if (result.rows.length === 0 || !result.rows[0].parent_id) break;
      parents.push(result.rows[0].parent_id);
      current = result.rows[0].parent_id;
    }
    return parents;
  }

  private async getUserOverrides(userId: string): Promise<CapabilityInfo[]> {
    const result = await this.dbQuery(
      `SELECT c.id, c.name, c.category, c.risk_level, c.requires_approval, uco.granted
       FROM user_capability_overrides uco
       JOIN capabilities c ON c.id = uco.capability_id
       WHERE uco.user_id = $1 AND c.enabled = true
       AND (uco.expires_at IS NULL OR uco.expires_at > now())`,
      [userId]
    );
    return result.rows.map(row => ({
      id: row.id, name: row.name, category: row.category,
      riskLevel: row.risk_level, requiresApproval: row.requires_approval,
    }));
  }

  private async getRoleCapabilities(roleName: string): Promise<(CapabilityInfo & { granted: boolean })[]> {
    const result = await this.dbQuery(
      `SELECT c.id, c.name, c.category, c.risk_level, c.requires_approval, rc.granted
       FROM role_capabilities rc
       JOIN capabilities c ON c.id = rc.capability_id
       JOIN roles r ON r.id = rc.role_id
       WHERE r.name = $1 AND c.enabled = true`,
      [roleName]
    );
    return result.rows.map(row => ({
      id: row.id, name: row.name, category: row.category,
      riskLevel: row.risk_level, requiresApproval: row.requires_approval,
      granted: row.granted,
    }));
  }

  private async getInheritedCapabilities(capabilityIds: string[]): Promise<CapabilityInfo[]> {
    if (capabilityIds.length === 0) return [];
    const result = await this.dbQuery(
      `SELECT DISTINCT c.id, c.name, c.category, c.risk_level, c.requires_approval
       FROM capabilities c
       WHERE c.id IN (
         WITH RECURSIVE parent_tree AS (
           SELECT parent_id FROM capabilities WHERE id = ANY($1)
           UNION
           SELECT c2.parent_id FROM capabilities c2
           JOIN parent_tree pt ON c2.id = pt.parent_id
           WHERE c2.parent_id IS NOT NULL
         )
         SELECT parent_id FROM parent_tree WHERE parent_id IS NOT NULL
       ) AND c.enabled = true`,
      [capabilityIds]
    );
    return result.rows.map(row => ({
      id: row.id, name: row.name, category: row.category,
      riskLevel: row.risk_level, requiresApproval: row.requires_approval,
    }));
  }

  private async logAudit(userId: string, capabilityId: string, action: string, result: string, context?: Record<string, unknown>): Promise<void> {
    try {
      await this.auditRepo.logDecision({
        userId,
        tenantId: '',
        resourceType: 'capability',
        resourceId: capabilityId,
        action,
        decision: result as 'allow' | 'deny',
        decisionSource: 'capability',
        reason: context?.reason as string || action,
      });
    } catch (err) {
      logger.error({ err }, 'Failed to log capability audit');
    }
  }

  private async dbQuery(query: string, params: unknown[] = []): Promise<any> {
    // 复用现有数据库连接
    const { getPool } = await import('../../utils/database');
    return getPool().query(query, params);
  }
}
```

### 6.2 嵌入 AuthorizationEngine

```typescript
// orion-platform-service/src/services/authz/AuthorizationEngine.ts
// 修改 evaluate() 方法，在 [2] RBAC 之后插入 [2.1] Capability

import { CapabilityEngine } from './CapabilityEngine';

export class AuthorizationEngine {
  constructor(
    private rbacService: RoleService,
    private capabilityEngine: CapabilityEngine,  // 新增
    private abacEngine: AbacPolicyEngine,
    private relationshipService: RelationshipService,
    // ...
  ) {}

  async evaluate(req: AuthZRequest): Promise<AuthZDecision> {
    // ... [0] [1] [2] 不变 ...

    // [2] RBAC 检查
    const rbacResult = await this.rbacService.checkPermissions(...);
    if (!rbacResult.allowed) {
      return this.deny(rbacResult.reason, 'rbac', ...);
    }

    // === [2.1] Capability 检查（新增）===
    const capResult = await this.capabilityEngine.check({
      userId: req.user.id,
      userRoles: req.user.roles,
      capabilityId: this.actionToCapabilityId(req.resource.type, req.action.type),
      resource: { type: req.resource.type, id: req.resource.id },
    });
    if (!capResult.allowed) {
      return this.deny(capResult.reason, 'capability', Date.now() - startTime, req);
    }

    // ... [2.5] [3] [4] [5] 不变 ...
  }

  /**
   * 将 resource:action 映射到 capabilityId
   * 例如：pipeline:trigger → pipeline_operations.trigger
   * 如果无映射，则跳过 Capability 检查（保持向后兼容）
   */
  private actionToCapabilityId(resourceType: string, action: string): string | null {
    const mapping: Record<string, string> = {
      'pipeline:delete': 'pipeline_operations.delete',
      'pipeline:trigger_prod': 'pipeline_operations.trigger_prod',
      'deployment:create': 'deployment_operations.deploy_prod',
      'deployment:rollback': 'deployment_operations.rollback',
      // ... 更多映射
    };
    return mapping[`${resourceType}:${action}`] || null;
  }
}
```

### 6.3 requireCapability 中间件

```typescript
// orion-platform-service/src/middleware/requireCapability.ts

import { FastifyRequest, FastifyReply, onRequestHookHandler } from 'fastify';
import { capabilityEngine } from '../services/authz/CapabilityEngine';

interface RequireCapabilityOptions {
  capabilityId: string;
  fallbackPermission?: { resource: string; action: string };  // 向后兼容
}

export function requireCapability(options: RequireCapabilityOptions): onRequestHookHandler {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user;
    if (!user) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const result = await capabilityEngine.check({
      userId: user.id,
      userRoles: user.roles,
      capabilityId: options.capabilityId,
    });

    if (!result.allowed) {
      return reply.status(403).send({
        error: 'Capability denied',
        message: result.reason,
        capabilityId: options.capabilityId,
        riskLevel: result.riskLevel,
        requiresApproval: result.requiresApproval,
      });
    }

    // 高风险操作记录审计日志
    if (result.riskLevel >= 3) {
      (request as any).capabilityContext = {
        capabilityId: options.capabilityId,
        riskLevel: result.riskLevel,
        requiresApproval: result.requiresApproval,
      };
    }
  };
}
```

### 6.4 API 端点

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| `GET` | `/api/v1/authz/capabilities` | 获取当前用户能力列表 | 已认证用户 |
| `GET` | `/api/v1/authz/capabilities/tree` | 获取完整能力树 | system_config:read |
| `POST` | `/api/v1/authz/roles/:roleId/capabilities` | 为角色授予能力 | system_config:write |
| `DELETE` | `/api/v1/authz/roles/:roleId/capabilities/:capId` | 撤销角色能力 | system_config:write |
| `POST` | `/api/v1/authz/users/:userId/capabilities` | 为用户添加能力覆盖 | system_config:write |
| `DELETE` | `/api/v1/authz/users/:userId/capabilities/:capId` | 撤销用户能力覆盖 | system_config:write |
| `GET` | `/api/v1/authz/capabilities/audit` | 查看能力使用审计日志 | audit_full |
| `POST` | `/api/v1/authz/capabilities/seed` | 重新生成种子数据 | super_admin |

---

## 7. 前端实现

### 7.1 CapabilityStore

```typescript
// orion-frontend/src/stores/capabilityStore.ts

import { create } from 'zustand';

interface CapabilityInfo {
  id: string;
  name: string;
  category: string;
  riskLevel: number;
  requiresApproval: boolean;
}

interface CapabilityState {
  capabilities: Map<string, CapabilityInfo>;
  loaded: boolean;
  loading: boolean;

  has: (id: string) => boolean;
  hasAny: (ids: string[]) => boolean;
  hasAll: (ids: string[]) => boolean;
  getByCategory: (category: string) => CapabilityInfo[];
  getByRiskLevel: (level: number) => CapabilityInfo[];
  loadCapabilities: () => Promise<void>;
  clearCapabilities: () => void;
}

export const useCapabilityStore = create<CapabilityState>((set, get) => ({
  capabilities: new Map(),
  loaded: false,
  loading: false,

  has: (id: string) => {
    const caps = get().capabilities;
    return caps.has(id);
  },

  hasAny: (ids: string[]) => ids.some(id => get().capabilities.has(id)),

  hasAll: (ids: string[]) => ids.every(id => get().capabilities.has(id)),

  getByCategory: (category: string) =>
    Array.from(get().capabilities.values()).filter(c => c.category === category),

  getByRiskLevel: (level: number) =>
    Array.from(get().capabilities.values()).filter(c => c.riskLevel === level),

  loadCapabilities: async () => {
    if (get().loaded || get().loading) return;
    set({ loading: true });
    try {
      const res = await fetch('/api/v1/authz/capabilities');
      const data = await res.json();
      const caps = new Map<string, CapabilityInfo>();
      for (const cap of data) {
        caps.set(cap.id, cap);
      }
      set({ capabilities: caps, loaded: true, loading: false });
    } catch (err) {
      console.error('Failed to load capabilities:', err);
      set({ loading: false });
    }
  },

  clearCapabilities: () => set({ capabilities: new Map(), loaded: false }),
}));
```

### 7.2 CapabilityGate 组件

```tsx
// orion-frontend/src/components/CapabilityGate.tsx

import React from 'react';
import { useCapabilityStore } from '@/stores/capabilityStore';
import { Tooltip } from 'antd';

interface CapabilityGateProps {
  id: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showTooltip?: boolean;
  tooltipMessage?: string;
}

export const CapabilityGate: React.FC<CapabilityGateProps> = ({
  id,
  children,
  fallback,
  showTooltip = true,
  tooltipMessage = '需要更高权限才能执行此操作',
}) => {
  const has = useCapabilityStore(state => state.has);

  if (!has(id)) {
    if (fallback) return <>{fallback}</>;
    if (showTooltip) {
      return <Tooltip title={tooltipMessage}><span style={{ opacity: 0.5, pointerEvents: 'none' }}>{children}</span></Tooltip>;
    }
    return null;
  }

  return <>{children}</>;
};
```

### 7.3 前端初始化流程

```typescript
// orion-frontend/src/App.tsx 或 layout 组件

import { useCapabilityStore } from '@/stores/capabilityStore';

function App() {
  const loadCapabilities = useCapabilityStore(state => state.loadCapabilities);

  useEffect(() => {
    // 用户认证成功后加载能力列表
    loadCapabilities();
  }, []);

  // ...
}
```

### 7.4 各页面使用示例

```tsx
// 流水线页面 — 删除按钮
<CapabilityGate id="pipeline_operations.delete">
  <Button danger onClick={handleDelete}>删除流水线</Button>
</CapabilityGate>

// 部署页面 — 生产部署
<CapabilityGate
  id="deployment_operations.deploy_prod"
  fallback={<Tooltip title="需要生产部署权限，请向管理员申请"><Button disabled>部署到生产</Button></Tooltip>}
>
  <Button type="primary" onClick={handleDeployProd}>部署到生产</Button>
</CapabilityGate>

// 环境管理 — 销毁环境
<CapabilityGate id="environment_operations.destroy">
  <Button danger>销毁环境</Button>
</CapabilityGate>

// 安全策略 — 修改策略
<CapabilityGate id="security_operations.policy_modify">
  <Button onClick={handleEditPolicy}>修改安全策略</Button>
</CapabilityGate>

// 编程式检查
const { has } = useCapabilityStore();
if (has('chaos_operations.inject')) {
  showChaosButton();
}
```

---

## 8. ChatOps 集成（优先级最高）

### 8.1 ChatOps 命令到能力映射

```typescript
// orion-ai-svc/src/services/ToolExecutor.ts

const commandToCapability: Record<string, string> = {
  'kubectl get': 'chatops_advanced.command.kubectl.get',
  'kubectl describe': 'chatops_advanced.command.kubectl.describe',
  'kubectl logs': 'chatops_advanced.command.kubectl.logs',
  'kubectl restart': 'chatops_advanced.command.kubectl.restart',
  'kubectl scale': 'chatops_advanced.command.kubectl.scale',
  'kubectl exec': 'chatops_advanced.command.kubectl.exec',
  'kubectl debug': 'chatops_advanced.command.kubectl.debug',
  'kubectl delete': 'chatops_advanced.command.kubectl.delete',
  'deploy preview': 'chatops_advanced.command.deploy.preview',
  'deploy staging': 'chatops_advanced.command.deploy.staging',
  'deploy production': 'chatops_advanced.command.deploy.production',
  'rollback': 'deployment_operations.rollback',
  'scale': 'chatops_advanced.command.kubectl.scale',
  'restart': 'chatops_advanced.command.kubectl.restart',
  'delete': 'chatops_advanced.command.kubectl.delete',
};

// ToolExecutor.execute() 中调用
async execute(request: ToolExecutionRequest) {
  const capId = commandToCapability[request.tool];
  if (capId) {
    const capResult = await capabilityEngine.check({
      userId: request.userId,
      userRoles: request.userRoles,
      capabilityId: capId,
      resource: { type: 'chatops_command', id: request.tool },
    });

    if (!capResult.allowed) {
      return {
        success: false,
        error: `权限不足: ${capResult.reason}`,
        executionTime: Date.now() - startTime,
      };
    }

    if (capResult.requiresApproval) {
      return {
        success: false,
        error: `此操作需要审批 (风险等级: ${capResult.riskLevel})`,
        requiresApproval: true,
        capabilityId: capId,
      };
    }
  }

  // 执行命令...
}
```

### 8.2 ChatOps 执行流程

```
用户发送消息
  │
  ├─ 意图识别 → 解析为具体操作
  │
  ├─ 命令解析 → 映射到 capabilityId
  │
  ├─ CapabilityEngine.check(userId, capabilityId)
  │    ├─ denied → 返回 "权限不足: {reason}"
  │    ├─ allowed + requiresApproval → 创建审批单
  │    └─ allowed → 执行命令
  │
  └─ 记录 capability_audit_logs（check_type='capability'）
```

---

## 9. 审计日志

### 9.1 审计字段

```typescript
interface CapabilityAuditLog {
  id: string;
  timestamp: Date;
  userId: string;
  userName: string;
  userRole: string;
  capabilityId: string;
  action: 'execute' | 'grant' | 'revoke' | 'approve' | 'deny';
  resourceType?: string;
  resourceId?: string;
  riskLevel: 1 | 2 | 3 | 4;
  result: 'success' | 'failed' | 'denied' | 'pending_approval';
  requestIp: string;
  userAgent: string;
  requestBody?: Record<string, unknown>;
  responseBody?: Record<string, unknown>;
  errorMessage?: string;
  duration: number;
  chainId?: string;
  // 高风险操作（3-4级）额外字段
  beforeState?: Record<string, unknown>;
  afterState?: Record<string, unknown>;
  approvalId?: string;
  multiFactorAuth?: boolean;
}
```

### 9.2 审计日志保留策略

| 风险等级 | 保留期限 | 归档策略 |
|---------|---------|---------|
| 4 级（极高） | 7 年 | 冷存储 |
| 3 级（高） | 3 年 | 冷存储 |
| 2 级（中） | 180 天 | 标准存储 |
| 1 级（低） | 180 天 | 标准存储 |

### 9.3 审计验证

- **链式验证** — 通过 `chainId` 验证操作序列完整性
- **防篡改** — 审计日志写入后不可修改
- **合规导出** — 支持 PDF/CSV 格式导出

---

## 10. 与现有系统的集成细节

### 10.1 复用现有基础设施

| 现有组件 | 集成方式 | 文件 |
|---------|---------|------|
| `PermissionCache` | Capability 决策结果也缓存（Redis，TTL 300s） | `authz/PermissionCache.ts` |
| `PermissionAuditRepository` | Capability 检查写入同一审计表，`check_type='capability'` | `repositories/PermissionAuditRepository.ts` |
| `UEBAEngine` | 异常能力使用触发告警 | `services/ueba/UEBAEngine.ts` |
| `requirePermission` 中间件 | 新增 `requireCapability`，用法类似 | `middleware/requireCapability.ts` |
| `AuthorizationEngine` | 插入 [2.1] 步骤 | `authz/AuthorizationEngine.ts` |
| `AbacPolicyEngine` | 不变，在 Capability 之后执行 | `authz/AbacPolicyEngine.ts` |

### 10.2 路由中间件使用

```typescript
// orion-platform-service/src/api/deploy-routes.ts
import { requirePermission } from '../middleware/requirePermission';
import { requireCapability } from '../middleware/requireCapability';

app.post('/api/v1/deploy', {
  onRequest: [
    requirePermission({ resource: 'deployment', action: 'create' }),
    requireCapability({ capabilityId: 'deployment_operations.deploy_prod' }),
  ],
}, deployHandler);

app.delete('/api/v1/pipelines/:id', {
  onRequest: [
    requirePermission({ resource: 'pipeline', action: 'delete' }),
    requireCapability({ capabilityId: 'pipeline_operations.delete' }),
  ],
}, deletePipelineHandler);
```

---

## 11. 风险与缓解

| 风险 | 影响 | 缓解 |
|------|------|------|
| Capability 与 RBAC/ABAC 评估顺序混乱 | 行为不一致 | 严格定义评估顺序：RBAC → Capability → ABAC，deny 优先 |
| 能力树过深导致性能问题 | 检查延迟 | Redis 缓存 + 扁平化索引（capability_id → 直接 lookup） |
| 前端能力列表泄露信息 | 安全风险 | 仅返回 granted 的能力，不返回完整树 |
| 与现有权限系统冲突 | 行为不一致 | Capability 作为 RBAC 之上的附加层，不修改 RBAC 逻辑 |
| 大量能力配置迁移 | 实施成本 | 分阶段迁移，先覆盖高风险操作 |
| user_override 过期未清理 | 权限泄漏 | 定时任务扫描 expires_at，自动失效 + 审计记录 |
| 能力定义错误导致权限泄漏 | 安全风险 | 能力创建时校验格式 + 测试环境验证 |
| 审计日志量过大 | 存储成本 | 按风险等级分级存储，低级别自动归档 |

---

## 12. 实施计划

### Phase 1：基础能力（1-2 周）

- [ ] 数据库迁移（capabilities / role_capabilities / user_capability_overrides 表）
- [ ] CapabilityEngine 核心逻辑
- [ ] `requireCapability` 中间件
- [ ] `/api/v1/authz/capabilities` API 端点
- [ ] 能力种子数据生成（210 条）

### Phase 2：嵌入 AuthorizationEngine（1 周）

- [ ] AuthorizationEngine 插入 [2.1] Capability 步骤
- [ ] resource:action → capabilityId 映射表
- [ ] PermissionCache 集成（缓存 allow 决策）
- [ ] 审计日志增强（check_type 字段）

### Phase 3：前端实现（1 周）

- [ ] CapabilityStore + CapabilityGate 组件
- [ ] App 启动时加载用户能力列表
- [ ] P0 页面接入（流水线、部署、环境、制品）
- [ ] 能力管理页面（CRUD + 角色分配）

### Phase 4：ChatOps 集成（1 周）

- [ ] ChatOps 命令到能力映射
- [ ] ToolExecutor 接入能力检查
- [ ] 审批流集成（高风险命令）

### Phase 5：全平台推广（按需）

- [ ] 各业务路由加 `requireCapability` 中间件
- [ ] 敏感操作/批量操作接入能力检查
- [ ] 用户能力覆盖管理页面
- [ ] 能力使用审计日志查询

---

## 13. ChatOps 配置后台自身能力管控

**注意**：以下能力独立于全局 30+ 能力域，是 ChatOps 配置后台的**自管理能力**。

### 13.1 ChatOps 配置能力定义

```
chatops_view                (风险1)  → 查看命令目录、执行记录
chatops_command_manage      (风险3)  → 新增/编辑/删除命令配置
chatops_card_manage         (风险2)  → 配置问答卡片
chatops_platform_manage     (风险4)  → 修改平台 Webhook/Token（需审批）
chatops_notification_manage (风险2)  → 修改通知/DND 设置
chatops_execution_monitor   (风险2)  → 查看执行记录、重试
chatops_execution_cancel    (风险3)  → 取消/终止执行
```

### 13.2 ChatOps 页面接入

```tsx
// ChatOpsSettings.tsx — 命令配置 Tab
{has('chatops_command_manage') && (
  <Space>
    <Button icon={<PlusOutlined />} onClick={handleAdd}>添加命令</Button>
    <Button type="primary" icon={<SaveOutlined />} onClick={handleSave}>保存配置</Button>
  </Space>
)}

// ChatOpsSettings.tsx — 平台配置 Tab
<CapabilityGate
  id="chatops_platform_manage"
  fallback={<Alert message="需要平台管理权限才能修改 Webhook 和 Token" type="warning" />}
>
  <Form.Item name="dingtalk_webhook" label="钉钉 Webhook URL">
    <Input />
  </Form.Item>
</CapabilityGate>
```

### 13.3 ChatOps 配置后端保护

```typescript
// orion-platform-service/src/api/chatops-routes.ts
app.put('/api/v1/chatops/config/commands', {
  onRequest: [
    requirePermission({ resource: 'chatops', action: 'update' }),
    requireCapability({ capabilityId: 'chatops_command_manage' }),
  ],
}, updateCommandsHandler);

app.put('/api/v1/chatops/config/platforms', {
  onRequest: [
    requirePermission({ resource: 'chatops', action: 'update' }),
    requireCapability({ capabilityId: 'chatops_platform_manage' }),
  ],
}, updatePlatformsHandler);
```

---

## 14. 能力域命名规范（单一事实来源）

### 14.1 命名规则

| 规则 | 说明 | 示例 | 禁止 |
|------|------|------|------|
| 后缀统一 | 所有能力域使用 `*_operations` 后缀 | `pipeline_operations` | `*_ops`、`*_op` |
| 蛇形命名 | 使用下划线分隔 | `cross_tenant_operations` | `crossTenantOperations` |
| 小写 | 全小写 | `infrastructure_operations` | `InfrastructureOperations` |
| 语义明确 | 能力名需表达实际含义 | `disaster_recovery` | `dr_ops` |

### 14.2 32 个能力域标准 ID 列表

| 序号 | 能力域 ID | 对应 RBAC 资源 | 风险等级 |
|------|-----------|--------------|---------|
| 1 | `chatops_advanced` | chatops | 3/4 |
| 2 | `chatops_command_manage` | chatops | 3 |
| 3 | `pipeline_operations` | pipeline, autonomous-pipeline | 3/4 |
| 4 | `deployment_operations` | deployment, canary-traffic | 4 |
| 5 | `environment_operations` | environment, ephemeral-env | 3/4 |
| 6 | `artifact_operations` | artifact, library | 3/4 |
| 7 | `infrastructure_operations` | secret, config, queue | 4 |
| 8 | `backup_operations` | backup | 3/4 |
| 9 | `disaster_recovery` | disaster-recovery | 4 |
| 10 | `chaos_operations` | chaos | 4 |
| 11 | `self_healing_operations` | self-healing | 3/4 |
| 12 | `knowledge_operations` | knowledge | 2/3/4 |
| 13 | `test_management` | test-selector, test-generation | 2/3 |
| 14 | `monitoring_operations` | monitoring, metrics, ueba, decision, performance | 1/2/3 |
| 15 | `alert_operations` | alert, escalation | 2/3 |
| 16 | `security_operations` | security, supply-chain, privacy | 3/4 |
| 17 | `approval_operations` | approval, confirmation | 2/3/4 |
| 18 | `data_pipeline_operations` | data-pipeline | 3 |
| 19 | `cron_operations` | cron | 3 |
| 20 | `branch_operations` | branch_policy | 3/4 |
| 21 | `policy_operations` | policy | 3/4 |
| 22 | `system_config` | webhook, notification, maintenance-window | 2/3 |
| 23 | `ecosystem_operations` | skill, plugin, community, developer-portal | 2/3 |
| 24 | `ai_advanced_operations` | vector, vector-store, mcp, llm-trace | 2/3 |
| 25 | `cross_tenant_operations` | cross-domain, federation | 4 |
| 26 | `workflow_operations` | workflow | 2/3 |
| 27 | `script_operations` | script | 2/3 |
| 28 | `digital_twin_operations` | digital-twin | 2/3 |
| 29 | `sensitive_operations` | (虚拟) | 4 |
| 30 | `audit_management` | audit | 2/3 |
| 31 | `advanced_analytics` | workbench | 1/2 |
| 32 | `user_management` | user | 2/3 |
| 33 | `project_operations` | project, product-line | 2/3/4 |
| 34 | `apk_operations` | apk-upload | 1/2 |

> **注**：所有其他文档必须引用此表中的标准 ID，不得自定义变体。
