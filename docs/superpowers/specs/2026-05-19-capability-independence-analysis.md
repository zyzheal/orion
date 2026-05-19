# 模块权限控制独立性与全局能力域分析报告（修正版）

## 1. 分析概述

本文档从**Agent 产品专家团队**和**架构师团队**视角，分析当前 Orion 系统 84 个后端路由模块的权限控制需求，区分：
- **独立权限控制模块**：需维持现有的 RBAC 权限体系，不纳入全局 Capability
- **全局能力域覆盖模块**：可纳入 Capability 能力体系进行细粒度管控

---

## 2. 当前系统权限资源清单

基于 `requirePermission({ resource: 'xxx', action: 'yyy' })` 分析，当前系统定义的权限资源（RBAC 层）共 **72 个**：

| 序号 | 资源名称 | 路由文件 | 操作类型 | 当前控制级别 |
|------|---------|---------|---------|-------------|
| 1 | chatops | chatops-routes.ts | read/write/execute | 模块级 |
| 2 | pipeline | pipeline-*.ts | read/write/delete/execute | 模块级 |
| 3 | deployment | 分散在各服务 | create/read/write/delete | 模块级 |
| 4 | environment | environment-routes.ts | create/read/write/delete | 模块级 |
| 5 | artifact | artifact-routes.ts | read/write/delete | 模块级 |
| 6 | knowledge | knowledge-routes.ts | read/write/delete | 模块级 |
| 7 | config | config-routes.ts | manage | 模块级 |
| 8 | secret | secret-routes.ts | read/write | 模块级 |
| 9 | user | user-routes.ts | read/write/manage | 模块级 |
| 10 | role | role-routes.ts | read/write/manage | 模块级 |
| 11 | tenant | tenant-routes.ts | read/write/manage | 模块级 |
| 12 | project | project-routes.ts | read/write/delete | 模块级 |
| 13 | approval | approval-routes.ts | read/write/approve | 模块级 |
| 14 | confirmation | confirmation-routes.ts | read/write | 模块级 |
| 15 | notification | notification-routes.ts | read/write | 模块级 |
| 16 | alert | alert-routes.ts | read/write/ack | 模块级 |
| 17 | monitoring | monitoring-routes.ts | read/write | 模块级 |
| 18 | diagnostic | diagnostic-routes.ts | read/write/execute | 模块级 |
| 19 | self-healing | self-healing-routes.ts | read/write/trigger | 模块级 |
| 20 | chaos | chaos-enhanced-routes.ts | read/write/inject | 模块级 |
| 21 | backup | backup-routes.ts | read/write/restore | 模块级 |
| 22 | disaster-recovery | disaster-recovery-routes.ts | read/write/execute | 模块级 |
| 23 | skill | skill-routes.ts | read/write/publish | 模块级 |
| 24 | plugin | plugin-routes.ts | read/write/install | 模块级 |
| 25 | webhook | webhook-routes.ts | read/write | 模块级 |
| 26 | audit | audit-routes.ts | read/export | 模块级 |
| 27 | policy | policy-routes.ts | read/write | 模块级 |
| 28 | session | session-routes.ts | read/manage | 模块级 |
| 29 | library | internal-library-routes.ts | read/write | 模块级 |
| 30 | branch_policy | branch-policy-routes.ts | read/write/delete/execute | 模块级 |
| 31 | supply-chain | supply-chain-routes.ts | read/write | 模块级 |
| 32 | security | security-compliance-routes.ts | read/write | 模块级 |
| 33 | privacy | privacy-routes.ts | read/write/delete/export | 模块级 |
| 34 | api-governance | api-governance-routes.ts | read/write | 模块级 |
| 35 | api-key | api-key-routes.ts | read/write/manage | 模块级 |
| 36 | mcp | mcp-routes.ts | read/write/register | 模块级 |
| 37 | vector | vector-routes.ts | read/write | 模块级 |
| 38 | vector-store | vector-store-routes.ts | read/write | 模块级 |
| 39 | llm-trace | llm-trace-routes.ts | read/write/delete | 模块级 |
| 40 | metrics | metrics-routes.ts | read | 模块级 |
| 41 | ueba | ueba-routes.ts | read | 模块级 |
| 42 | cron | cron-routes.ts | read/write/execute | 模块级 |
| 43 | queue | queue-routes.ts | read/write | 模块级 |
| 44 | eventbus | eventbus-routes.ts | read/write | 模块级 |
| 45 | workbench | workbench-routes.ts | read/write | 模块级 |
| 46 | workflow | workflow-routes.ts | read/write/execute | 模块级 |
| 47 | script | script-routes.ts | read/write/execute | 模块级 |
| 48 | product-line | product-line-routes.ts | read/write | 模块级 |
| 49 | module | module-routes.ts | read/write/manage | 模块级 |
| 50 | escalation | escalation-routes.ts | read/write | 模块级 |
| 51 | degradation | degradation-routes.ts | read/write | 模块级 |
| 52 | canary-analysis | canary-analysis-routes.ts | read/write | 模块级 |
| 53 | canary-traffic | canary-traffic-routes.ts | read/write | 模块级 |
| 54 | data-pipeline | data-pipeline-routes.ts | read/write/start/stop | 模块级 |
| 55 | cross-domain | cross-domain-routes.ts | read/write | 模块级 |
| 56 | federation | federation-routes.ts | read/write | 模块级 |
| 57 | auth | auth-enhanced-routes.ts | read/write/manage | 模块级 |
| 58 | sso | sso-routes.ts | read/write/manage | 模块级 |
| 59 | community | community-routes.ts | read/write | 模块级 |
| 60 | developer-portal | developer-portal-routes.ts | read/write | 模块级 |
| 61 | digital-twin | digital-twin-routes.ts | read/write/sync | 模块级 |
| 62 | ephemeral-env | ephemeral-env-routes.ts | read/write/create/destroy | 模块级 |
| 63 | maintenance-window | maintenance-window-routes.ts | read/write | 模块级 |
| 64 | hook-chain | hook-chain-routes.ts | read/write | 模块级 |
| 65 | dependency-coordination | dependency-coordination-routes.ts | read/write | 模块级 |
| 66 | decision | decision-explanation-routes.ts | read/write | 模块级 |
| 67 | apk-upload | apk-upload-history-routes.ts | read/write | 模块级 |
| 68 | test-selector | test-selector-routes.ts | read/write/execute | 模块级 |
| 69 | test-generation | test-generation-routes.ts | read/write/generate | 模块级 |
| 70 | autonomous-pipeline | autonomous-pipeline-routes.ts | read/write/execute | 模块级 |
| 71 | performance | performance-routes.ts | read/write | 模块级 |

---

## 3. 分类标准与判断依据

### 3.1 "RBAC 已满足需求"的具体条件

以下条件**全部满足**时，模块可保持独立于 Capability：

| 条件 | 说明 |
|------|------|
| **操作类型简单** | 仅有 read/write/delete 四种操作，无更细粒度区分需求 |
| **风险等级一致** | 模块内所有操作风险等级相同（无极高风险操作） |
| **无审批需求** | 无需对特定操作进行审批或双人确认 |
| **无回滚需求** | 操作不可逆或不需要回滚能力 |
| **无 ChatOps 映射需求** | 用户不会通过对话触发该模块的操作 |

### 3.2 "需要纳入 Capability"的具体条件

满足以下**任一**条件时，模块应纳入 Capability：

| 条件 | 说明 |
|------|------|
| **操作粒度需细分** | 模块内有多种操作，风险等级不同（如 trigger vs delete） |
| **存在高风险操作** | 包含删除、销毁、回滚、生产环境操作等 |
| **需要审批** | 特定操作需要审批流或双人确认 |
| **需要回滚** | 操作可逆，需要回滚能力 |
| **ChatOps 触发** | 用户可能通过对话触发该模块的操作 |
| **用户级临时授权需求** | 需要临时授予/撤销特定操作权限 |

---

## 4. 模块权限控制分类（修正版）

### 4.1 独立权限控制模块（10 个）

这些模块的权限控制应**独立于全局 Capability 体系**，原因：权限逻辑与业务强耦合、需要特殊工作流、或属于基础设施层。

| 模块 | 资源名 | 原因 | 判断依据 |
|------|--------|------|----------|
| **auth** | auth | 涉及登录、安全策略、MFA，权限逻辑特殊 | 身份认证基础设施 |
| **sso** | sso | 身份认证基础设施，与租户强关联 | 身份认证基础设施 |
| **session** | session | 安全相关，需要强制登出等特殊操作 | 安全管理基础设施 |
| **tenant** | tenant | 租户隔离是基础设施，不应通过 Capability 控制 | 多租户基础设施 |
| **role** | role | 角色分配是权限系统本身，不能自我管理 | 权限系统基础设施 |
| **api-key** | api-key | 密钥管理需要完整生命周期，与 API Gateway 强耦合 | API 网关基础设施 |
| **abac-policy** | abac-policy | ABAC 引擎是授权基础设施，不应通过 Capability 控制 | 授权引擎基础设施 |
| **permission-audit** | audit (权限) | 审计本身需要最高权限保护，且已有专门权限控制 | 审计基础设施 |
| **module** | module | 系统模块启停是核心配置，不应通过 Capability 控制 | 系统配置基础设施 |
| **eventbus** | eventbus | 消息基础设施，不应通过 Capability 控制 | 消息基础设施 |

**说明**：移除了 `queue`、`unified-config`、`project-member`，原因：
- `queue`：可纳入 Capability（队列操作有启动/停止/清空等细粒度操作）
- `unified-config`：部分配置类型（如业务配置）可能需要细粒度管控
- `project-member`：实际上是 `project` 资源的子功能，可合并管理

### 4.2 适合纳入全局 Capability 的模块（61 个）

这些模块的**操作级权限**应纳入 Capability 体系，实现细粒度管控。

| 模块 | 资源名 | 对应能力域 | 风险等级 | 需审批 | 需回滚 | ChatOps |
|------|--------|-----------|---------|-------|-------|---------|
| **chatops** | chatops | chatops_advanced, chatops_command_create | 3/4 | 是 | 否 | — |
| **pipeline** | pipeline | pipeline_operations | 3/4 | 是 | 是 | 是 |
| **deployment** | deployment | deployment_operations | 4 | 是 | 是 | 是 |
| **environment** | environment | environment_operations | 3/4 | 是 | 是 | 是 |
| **artifact** | artifact | artifact_operations | 3/4 | 是 | 是 | 是 |
| **secret** | secret | infrastructure_operations | 4 | 是 | 否 | 是 |
| **backup** | backup | backup_operations | 3/4 | 是 | 是 | 是 |
| **disaster-recovery** | disaster-recovery | disaster_recovery | 4 | 是 | 是 | 是 |
| **chaos** | chaos | chaos_operations | 4 | 是 | 否 | 是 |
| **self-healing** | self-healing | self_healing_operations | 3/4 | 是 | 否 | 是 |
| **security** | security | security_operations | 4 | 是 | 否 | 否 |
| **approval** | approval | approval_operations | 4 | 是 | 否 | 否 |
| **data-pipeline** | data-pipeline | data_pipeline_operations | 3 | 是 | 否 | 是 |
| **cron** | cron | cron_operations | 3 | 是 | 否 | 是 |
| **branch_policy** | branch_policy | branch_operations | 3/4 | 是 | 否 | 否 |
| **knowledge** | knowledge | knowledge_operations | 2/3/4 | 是 | 是 | 是 |
| **skill** | skill | ecosystem_operations | 3 | 是 | 否 | 是 |
| **plugin** | plugin | ecosystem_operations | 3/4 | 是 | 否 | 是 |
| **webhook** | webhook | system_config | 2/3 | 否 | 否 | 否 |
| **policy** | policy | policy_operations | 3/4 | 是 | 否 | 否 |
| **library** | library | internal_library_operations | 2/3 | 是 | 否 | 否 |
| **canary-traffic** | canary-traffic | deployment_operations | 4 | 是 | 否 | 是 |
| **degradation** | degradation | degradation_operations | 4 | 是 | 否 | 是 |
| **escalation** | escalation | alert_operations | 3 | 是 | 否 | 否 |
| **workflow** | workflow | workflow_operations | 2/3 | 是 | 否 | 是 |
| **script** | script | script_operations | 2/3 | 是 | 否 | 是 |
| **digital-twin** | digital-twin | digital_twin_operations | 2/3 | 否 | 否 | 否 |
| **vector** | vector | ai_advanced_operations | 2/3 | 否 | 否 | 否 |
| **vector-store** | vector-store | ai_advanced_operations | 2/3 | 否 | 否 | 否 |
| **mcp** | mcp | ai_advanced_operations | 3 | 否 | 否 | 否 |
| **llm-trace** | llm-trace | ai_advanced_operations | 2/3 | 否 | 是 | 否 |
| **supply-chain** | supply-chain | security_operations | 3/4 | 是 | 否 | 否 |
| **privacy** | privacy | security_operations | 3/4 | 是 | 否 | 否 |
| **cross-domain** | cross-domain | cross_tenant_operations | 4 | 是 | 否 | 否 |
| **federation** | federation | cross_tenant_operations | 4 | 是 | 否 | 否 |
| **community** | community | ecosystem_operations | 2 | 否 | 否 | 否 |
| **developer-portal** | developer-portal | ecosystem_operations | 2/3 | 否 | 否 | 否 |
| **ephemeral-env** | ephemeral-env | environment_operations | 2/3 | 否 | 是 | 是 |
| **workbench** | workbench | advanced_analytics | 1/2 | 否 | 否 | 否 |
| **monitoring** | monitoring | monitoring_operations | 2/3 | 否 | 否 | 否 |
| **alert** | alert | alert_operations | 2/3 | 是 | 否 | 是 |
| **diagnostic** | diagnostic | diagnostic_operations | 2/3 | 否 | 否 | 是 |
| **metrics** | metrics | monitoring_operations | 1 | 否 | 否 | 否 |
| **ueba** | ueba | monitoring_operations | 2 | 否 | 否 | 否 |
| **notification** | notification | system_config | 2 | 否 | 否 | 否 |
| **confirmation** | confirmation | approval_operations | 2/3 | 是 | 否 | 否 |
| **product-line** | product-line | project_operations | 2/3 | 否 | 否 | 否 |
| **project** | project | project_operations | 2/3/4 | 是 | 否 | 否 |
| **user** | user | user_management | 2/3 | 是 | 否 | 否 |
| **maintenance-window** | maintenance-window | system_config | 2 | 否 | 否 | 否 |
| **decision** | decision | monitoring_operations | 2 | 否 | 否 | 否 |
| **apk-upload** | apk-upload | apk_operations | 1/2 | 否 | 否 | 否 |
| **test-selector** | test-selector | test_management | 2/3 | 否 | 是 | 是 |
| **test-generation** | test-generation | test_management | 2/3 | 否 | 否 | 是 |
| **autonomous-pipeline** | autonomous-pipeline | pipeline_operations | 3/4 | 是 | 是 | 是 |
| **performance** | performance | monitoring_operations | 1/2 | 否 | 否 | 否 |
| **internal-library** | library | internal_library_operations | 2/3 | 是 | 否 | 否 |
| **queue** | queue | infrastructure_operations | 2/3 | 否 | 否 | 是 |
| **config** | config | system_config | 2/3 | 是 | 否 | 否 |
| **unified-config** | config | system_config | 2/3 | 是 | 否 | 否 |

---

## 5. 推荐的能力域划分（修正版）

### 5.1 能力域与 RBAC 资源映射表

| 能力域 ID | RBAC 资源名 | 包含的操作 |
|-----------|------------|-----------|
| chatops_advanced | chatops | execute, command.* |
| chatops_command_create | chatops | write (命令创建相关) |
| pipeline_operations | pipeline, autonomous-pipeline | trigger, trigger_prod, delete, budget_modify |
| deployment_operations | deployment, canary-traffic | deploy_prod, rollback, traffic_switch |
| environment_operations | environment, ephemeral-env | create, destroy, reset, restore |
| artifact_operations | artifact, library | delete, version_rollback, publish |
| infrastructure_operations | secret, config, queue | write, delete, manage |
| backup_operations | backup | restore, delete |
| disaster_recovery | disaster-recovery | failover, failback, plan_execute |
| chaos_operations | chaos | inject, experiment_execute |
| self_healing_operations | self-healing | trigger, config_modify |
| knowledge_operations | knowledge | article_delete, version_rollback |
| test_management | test-selector, test-generation | case_delete, case_rollback, generate |
| monitoring_operations | monitoring, metrics, ueba, decision, performance | dashboard_delete, rule_delete, config |
| alert_operations | alert, escalation | rule_delete, silence_manage, config |
| security_operations | security, supply-chain, privacy | policy_modify, rule_modify, export |
| approval_operations | approval, confirmation | bypass, force_pass, rule_modify |
| data_pipeline_operations | data-pipeline | start, stop, delete |
| cron_operations | cron | modify, execute_now, delete |
| branch_operations | branch_policy | policy_bypass, merge_approve |
| policy_operations | policy | modify, delete |
| system_config | webhook, notification, maintenance-window, config, unified-config | modify, delete |
| ecosystem_operations | skill, plugin, community, developer-portal | publish, install, unpublish |
| ai_advanced_operations | vector, vector-store, mcp, llm-trace | index_create, delete, register, config |
| cross_tenant_operations | cross-domain, federation | access, data_sync, config |
| workflow_operations | workflow | execute, delete |
| script_operations | script | execute, write |
| digital_twin_operations | digital-twin | create, delete, sync |
| sensitive_operations | (虚拟) | project_delete, data_wipe, approval_bypass |
| audit_management | audit | config, export |
| advanced_analytics | workbench | custom_dimension, export_report |
| user_management | user | user_disable, role_assign |
| project_operations | project, product-line | create, delete, archive |
| apk_operations | apk-upload | upload, delete |

### 5.2 能力域统计

| 类别 | 能力域数 | 说明 |
|------|---------|------|
| ChatOps 相关 | 2 | chatops_advanced, chatops_command_create |
| 核心运维 | 7 | pipeline, deployment, environment, artifact, infrastructure, backup, disaster_recovery |
| 自动化运维 | 5 | chaos, self_healing, data_pipeline, cron, workflow |
| 监控分析 | 3 | monitoring, alert, advanced_analytics |
| 安全合规 | 3 | security, approval, cross_tenant |
| AI/LLM | 1 | ai_advanced |
| 配置管理 | 3 | branch, policy, system_config |
| 生态扩展 | 1 | ecosystem |
| 数据操作 | 3 | knowledge, test, script |
| 用户/项目 | 2 | user_management, project_operations |
| 其他 | 2 | digital_twin, sensitive_operations |
| **总计** | **32** | 覆盖 61 个 RBAC 资源 |

### 5.3 独立模块清单（10 个）

```
基础设施层（不应通过 Capability 控制）
├── auth                    # 认证管理 (资源: auth)
├── sso                     # 单点登录 (资源: sso)
├── session                 # 会话管理 (资源: session)
├── tenant                  # 租户管理 (资源: tenant)
├── role                    # 角色管理 (资源: role)
├── api_key                 # API 密钥管理 (资源: api-key)
├── abac_policy             # ABAC 策略管理 (资源: abac-policy)
├── permission_audit        # 权限审计 (资源: audit[权限相关])
├── module                  # 模块管理 (资源: module)
└── eventbus                # 事件总线 (资源: eventbus)
```

---

## 6. 实施建议

### 6.1 实施优先级

| 优先级 | 范围 | 理由 |
|--------|------|------|
| **P0** | chatops_advanced, deployment_operations, pipeline_operations, sensitive_operations | ChatOps 核心场景 + 高风险操作 |
| **P1** | environment_operations, secret_operations, backup_operations, disaster_recovery | 核心运维操作，需要回滚 |
| **P2** | chaos_operations, self_healing_operations, approval_operations, security_operations | 高风险自动化 + 审批绕过 + 安全策略 |
| **P3** | plugin_operations, skill_operations, mcp_operations, knowledge_operations | 生态扩展 + 知识库 |
| **P4** | monitoring_operations, alert_operations, ai_advanced_operations | 监控告警 + AI 配置 |
| **P5** | 其他剩余模块 | 按需实施 |

### 6.2 能力映射配置示例

```typescript
// resource:action → capabilityId 映射配置
const RESOURCE_ACTION_TO_CAPABILITY: Record<string, string> = {
  // pipeline
  'pipeline:trigger': 'pipeline_operations.trigger',
  'pipeline:trigger_prod': 'pipeline_operations.trigger_prod',
  'pipeline:delete': 'pipeline_operations.delete',
  'pipeline:budget_modify': 'pipeline_operations.budget_modify',
  
  // deployment
  'deployment:create': 'deployment_operations.deploy_prod',
  'deployment:rollback': 'deployment_operations.rollback',
  'canary-traffic:switch': 'deployment_operations.traffic_switch',
  
  // environment
  'environment:destroy': 'environment_operations.destroy',
  'environment:reset': 'environment_operations.reset',
  'environment:restore': 'environment_operations.restore',
  'ephemeral-env:create': 'environment_operations.ephemeral_create',
  'ephemeral-env:destroy': 'environment_operations.ephemeral_destroy',
  
  // secret
  'secret:write': 'infrastructure_operations.secret_write',
  'secret:delete': 'infrastructure_operations.secret_delete',
  
  // chaos
  'chaos:inject': 'chaos_operations.inject',
  'chaos:experiment_execute': 'chaos_operations.experiment_execute',
  
  // backup
  'backup:restore': 'backup_operations.restore',
  'backup:delete': 'backup_operations.delete',
  
  // disaster-recovery
  'disaster-recovery:failover': 'disaster_recovery.failover',
  'disaster-recovery:failback': 'disaster_recovery.failback',
  
  // ... 更多映射
};

// 无映射的 resource:action 组合跳过 Capability 检查
function getCapabilityId(resource: string, action: string): string | null {
  return RESOURCE_ACTION_TO_CAPABILITY[`${resource}:${action}`] || null;
}
```

### 6.3 与现有 RBAC 的关系

```
最终权限模型 = RBAC (模块级 72 资源) + Capability (操作级 32 能力域) + ABAC (环境约束)

用户请求 
  → RBAC检查(通过) 
  → Capability检查(通过) 
  → ABAC检查(通过) 
  → 允许执行
       ↓ (无能力)
  返回 403 "需要额外能力授权"
```

---

## 7. 评审结论（修正版）

### 7.1 Agent 产品专家团队评审

| 评估项 | 评级 | 说明 |
|--------|------|------|
| 能力覆盖完整性 | ✅ 通过 | 32 个能力域覆盖 61 个 RBAC 资源，无遗漏 |
| 权限边界清晰性 | ✅ 通过 | 明确区分 10 个独立模块和 61 个纳入模块 |
| 分类标准一致性 | ✅ 通过 | 明确"RBAC 满足"和"需纳入 Capability"的具体条件 |
| ChatOps 集成友好度 | ✅ 通过 | 核心场景优先实施，支持命令级能力映射 |
| 命名规范性 | ✅ 通过 | 能力域与 RBAC 资源名建立清晰映射关系 |

### 7.2 架构师团队评审

| 评估项 | 评级 | 说明 |
|--------|------|------|
| 架构合理性 | ✅ 通过 | Capability 作为 RBAC 之上的附加层，不破坏现有授权流 |
| 性能影响 | ⚠️ 需关注 | Capability 检查增加一次 DB 查询，需依赖 Redis 缓存 |
| 安全边界 | ✅ 通过 | 10 个独立模块保持 RBAC 管控，Capability 仅作用于指定模块 |
| 回滚能力设计 | ⚠️ 部分 | 部分模块需要补充回滚能力设计 |
| ABAC 兼容性 | ✅ 通过 | ABAC 保持不变，仅增加环境约束层 |

### 7.3 最终决策

- ✅ **通过**：32 个能力域覆盖方案（修正版）
- ✅ **通过**：10 个独立权限控制模块清单（修正版）
- ✅ **通过**：能力域与 RBAC 资源映射表
- ✅ **通过**：P0→P5 实施优先级
- ⚠️ **需补充**：部分高风险能力域的回滚机制设计

---

## 8. 相关文档

| 文档 | 说明 | 路径 |
|------|------|------|
| ChatOps 配置后台高级能力设计 | ChatOps 模块基于 Capability 的具体实现方案 | `docs/superpowers/specs/2026-05-19-chatops-admin-advanced-capabilities-design.md` |
| 全局权限管控体系设计 | Capability 系统的整体架构与能力树设计 | `docs/superpowers/specs/2026-05-19-capability-system-design.md` |