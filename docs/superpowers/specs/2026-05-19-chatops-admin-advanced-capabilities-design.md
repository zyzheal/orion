# ChatOps 配置后台高级能力与可管控方案设计

> 日期: 2026-05-19
> 状态: 待评审
> 分支: feat/frontend-gap-implementation

## 1. 需求背景

当前 ChatOps 配置后台 (`/console/chatops` 设置页) 已具备基础配置能力：
- 问答卡片配置
- 命令配置
- 平台配置（钉钉/企微/飞书/Slack）
- 通知与免打扰设置

**目标用户**：运维/管理员

**需要新增的高级能力**：
1. 命令权限管理（角色级/命令级/环境级）
2. 命令版本管理（变更记录、历史版本、一键回滚）
3. 速率限制配置（用户/群组/命令级别）
4. 审计合规（执行日志、配置变更、登录日志、导出报表）
5. 多租户隔离（配置隔离、数据隔离）
6. Webhook 管理（事件订阅、目标地址、重试策略、签名验证）

## 2. 总体架构设计

### 2.1 模块结构

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      ChatOps 配置后台 (前端)                              │
│  /console/chatops/settings                                              │
├──────────┬──────────┬──────────┬──────────┬──────────┬────────────────┤
│ 权限管理  │ 版本管理  │ 限流配置  │ 审计日志  │ 租户隔离  │ Webhook管理   │
│          │          │          │          │          │               │
│ - 角色   │ - 变更   │ - 用户   │ - 执行   │ - 租户   │ - 事件订阅   │
│ - 命令   │ - 历史   │ - 群组   │ - 配置   │ - 权限   │ - 目标地址   │
│ - 环境   │ - 回滚   │ - 命令   │ - 登录   │ - 数据   │ - 重试       │
└──────────┴──────────┴──────────┴──────────┴──────────┴────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      ChatOps 配置 API (后端)                             │
├─────────────────────────────────────────────────────────────────────────┤
│  /api/v1/chatops/admin/*                                               │
│  - /admin/permissions/*     - 权限管理 API                              │
│  - /admin/command-versions/* - 命令版本 API                             │
│  - /admin/rate-limits/*     - 限流配置 API                              │
│  - /admin/audit-logs/*      - 审计日志 API                              │
│  - /admin/tenants/*         - 租户管理 API                              │
│  - /admin/webhooks/*        - Webhook 管理 API                         │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      核心服务层                                          │
├──────────────┬──────────────┬──────────────┬───────────────────────────┤
│ Permission   │ Command      │ RateLimit    │ Audit                     │
│ Service      │ Version      │ Service      │ Service                   │
│              │ Service      │              │                           │
└──────────────┴──────────────┴──────────────┴───────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      数据持久层                                          │
├──────────────────┬──────────────────┬──────────────────────────────────┤
│ PostgreSQL       │ Redis            │ MinIO (可选)                     │
│ - 权限/版本/限流  │ - 会话/缓存       │ - 审计日志导出                   │
│ - 审计主数据      │ - 限流计数器      │                                  │
└──────────────────┴──────────────────┴──────────────────────────────────┘
```

### 2.2 ChatOps 能力范围与权限继承设计

> 本节设计复用已有的 **Capability 系统**（详见 `2026-05-19-capability-system-design.md`），ChatOps 作为该系统的一个调用方。

#### 2.2.1 ChatOps 可操作的能力范围

ChatOps 命令通过映射到全局 Capability 树来控制执行权限：

```
ChatOps 命令 → Capability 映射关系:
┌─────────────────────────────────────────────────────────────────────┐
│ ChatOps 命令              → 对应 Capability                         │
├─────────────────────────────────────────────────────────────────────┤
│ /deploy                   → pipeline_operations.trigger             │
│ /deploy env=prod          → deployment_operations.deploy_prod       │
│ /restart pod              → infrastructure_operations.env_restart   │
│ /rollback                 → deployment_operations.rollback          │
│ /kubectl delete           → chatops_advanced.command.kubectl.delete │
│ /artifact promote         → artifact_operations.promote             │
│ /env create               → environment_operations.create           │
│ /backup create            → backup_operations.create                │
│ /user disable             → user_management.user_disable            │
│ /status pipeline          → pipeline_operations.view                │
│ /alert list               → monitoring.alert.view                   │
│ /logs                     → chatops_advanced.command.kubectl.logs   │
└─────────────────────────────────────────────────────────────────────┘
```

#### 2.2.2 命令与 Capability 映射表（预置数据）

```sql
-- 能力映射表
CREATE TABLE chatops_capabilities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    command_id VARCHAR(100) NOT NULL,       -- 对应的命令 ID
    capability_id VARCHAR(100) NOT NULL,    -- Capability 系统中的 ID
    environment VARCHAR(20),                -- 'dev'|'staging'|'prod'|NULL
    risk_level INT NOT NULL CHECK (risk_level BETWEEN 1 AND 4),
    requires_approval BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 预置映射数据
INSERT INTO chatops_capabilities (command_id, capability_id, environment, risk_level, requires_approval) VALUES
-- deploy 命令
('deploy', 'pipeline_operations.trigger', 'dev', 2, false),
('deploy', 'pipeline_operations.trigger', 'staging', 2, false),
('deploy', 'deployment_operations.deploy_prod', 'prod', 4, true),

-- restart 命令
('restart', 'infrastructure_operations.env_restart', NULL, 3, false),

-- rollback 命令
('rollback', 'deployment_operations.rollback', NULL, 4, true),

-- kubectl 命令族
('kubectl', 'chatops_advanced.command.kubectl.get', NULL, 1, false),
('kubectl', 'chatops_advanced.command.kubectl.describe', NULL, 1, false),
('kubectl', 'chatops_advanced.command.kubectl.logs', NULL, 2, false),
('kubectl', 'chatops_advanced.command.kubectl.restart', NULL, 3, false),
('kubectl', 'chatops_advanced.command.kubectl.scale', NULL, 3, false),
('kubectl', 'chatops_advanced.command.kubectl.exec', NULL, 3, false),
('kubectl', 'chatops_advanced.command.kubectl.delete', NULL, 4, true),

-- bulk 操作
('bulk_restart', 'bulk_operations.restart', NULL, 3, false),
('bulk_deploy', 'bulk_operations.deploy', NULL, 3, false),
('bulk_delete', 'bulk_operations.delete', NULL, 4, true),

-- 环境操作
('env_create', 'environment_operations.create', NULL, 3, false),
('env_destroy', 'environment_operations.destroy', NULL, 4, true),
('env_reset', 'environment_operations.reset', NULL, 3, false),

-- 用户管理
('user_disable', 'user_management.user_disable', NULL, 3, false),
('user_enable', 'user_management.user_enable', NULL, 2, false);
```

#### 2.2.3 权限继承模型

采用**层级继承**机制，复用全局 Capability 系统：

```
┌─────────────────────────────────────────────────────────────────────┐
│                      权限继承判定流程                                 │
└─────────────────────────────────────────────────────────────────────┘

用户执行 /deploy env=prod
        │
        ▼
┌───────────────────┐
│ 1. 检查用户角色    │ ──→ RBAC: 是否有 chatops:execute 权限？
└───────────────────┘
        │
        ▼
┌───────────────────┐
│ 2. Capability 继承 │ ──→ 检查能力链
│                    │     deployment_operations.deploy_prod
└───────────────────┘      │
        │                  ▼
        │           parent: deployment_operations (风险4)
        │                  │
        │                  ▼
        │           parent: pipeline_operations (风险3)
        │                  │
        │                  ▼
        │           parent: root (无风险)
        │
        ▼
┌───────────────────┐
│ 3. 最终决策        │
│                    │
│ 继承链中任意节点   │
│ 具备权限 → 允许    │
│ 全部无权限 → 拒绝  │
└───────────────────┘
```

#### 2.2.4 继承规则

| 规则 | 说明 |
|------|------|
| **显式授权** | 管理员可直接授予特定 Capability |
| **角色继承** | 角色拥有的 Capability 会传递 |
| **层级继承** | 拥有父级 Capability = 拥有所有子级 |
| **否定优先** | 显式拒绝 > 继承授权 |
| **环境增强** | 同一命令 prod 环境需要更高权限 |
| **审批绑定** | 风险等级 4 的命令执行前需要审批 |

#### 2.2.5 与现有授权引擎的关系

Capability 检查位于 AuthorizationEngine 的 **RBAC 之后、ABAC 之前**：

```
请求到达
  │
  ├─ [0] 用户状态检查（现有，不变）
  ├─ [1] super_admin bypass（现有，不变）
  ├─ [2] RBAC 检查（现有，不变）→ denied → 403
  │
  ├─ [2.1] Capability 检查（新增）→ denied → 403 "需要额外能力授权"
  │       └── 调用 CapabilityEngine.check(userId, capabilityId)
  │
  ├─ [2.5] Pipeline RBAC（现有，不变）
  ├─ [3]  ABAC 检查（现有，不变）→ denied → 403
  ├─ [4]  关系检查（现有，不变）→ denied → 403
  │
  └─ [5] 全部通过 → allow
```

#### 2.2.6 权限检查核心代码

```typescript
// src/services/chatops/ChatOpsPermissionService.ts

import { CapabilityEngine } from '../authz/CapabilityEngine';

export class ChatOpsPermissionService {
  private capabilityEngine: CapabilityEngine;

  /**
   * 检查用户是否有权限执行某个 ChatOps 命令
   */
  async checkCommandPermission(
    userId: string,
    command: string,
    environment?: string
  ): Promise<{
    allowed: boolean;
    capability?: string;
    riskLevel?: number;
    requiresApproval?: boolean;
    reason?: string;
  }> {
    
    // 1. 获取命令对应的 Capability 映射
    const mapping = await this.getCapabilityMapping(command, environment);
    if (!mapping) {
      return { allowed: false, reason: '命令未配置能力映射' };
    }

    // 2. 调用全局 CapabilityEngine 检查权限
    const result = await this.capabilityEngine.check({
      userId,
      capability: mapping.capability_id,
      context: { environment, command }
    });

    // 3. 如果需要审批且用户无权限，返回特殊状态
    if (mapping.requires_approval && !result.allowed) {
      return {
        allowed: false,
        capability: mapping.capability_id,
        riskLevel: mapping.risk_level,
        requiresApproval: true,
        reason: '需要审批后才能执行此命令'
      };
    }

    return {
      allowed: result.allowed,
      capability: mapping.capability_id,
      riskLevel: mapping.risk_level,
      requiresApproval: mapping.requires_approval,
      reason: result.reason
    };
  }

  /**
   * 获取命令的 Capability 映射
   */
  private async getCapabilityMapping(
    command: string,
    environment?: string
  ): Promise<ChatOpsCapabilityMapping | null> {
    // 优先匹配环境特定的映射
    if (environment) {
      const envMapping = await this.repo.findOne({
        command_id: command,
        environment
      });
      if (envMapping) return envMapping;
    }
    // 其次匹配无环境限制的映射
    return this.repo.findOne({
      command_id: command,
      environment: null
    });
  }

  /**
   * 批量获取用户可执行的命令列表
   */
  async getAllowedCommands(userId: string): Promise<string[]> {
    const userCapabilities = await this.capabilityEngine.getUserCapabilities(userId);
    const mappings = await this.repo.findAll();
    
    return mappings
      .filter(m => userCapabilities.includes(m.capability_id))
      .map(m => m.command_id);
  }
}
```

#### 2.2.7 前端权限展示

在 ChatOps 设置后台的**权限管理 Tab** 中展示：

```
┌─────────────────────────────────────────────────────────────┐
│ 权限管理                                                      │
├─────────────────────────────────────────────────────────────┤
│ [角色管理] [命令权限] [环境权限] [能力映射]                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ 命令-Capability 映射:                                       │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 命令      │ Capability              │ 风险等级 │ 需审批  │ │
│ ├───────────┼─────────────────────────┼──────────┼─────────┤ │
│ │ deploy    │ pipeline_operations.trg │ 2        │ 否      │ │
│ │ deploy    │ deployment_operations.. │ 4        │ 是      │ │
│ │           │ .deploy_prod            │          │         │ │
│ │ kubectl   │ chatops_advanced.cmd   │ 4        │ 是      │ │
│ │           │ .kubectl.delete         │          │         │ │
│ │ restart   │ infrastructure_oper    │ 3        │ 否      │ │
│ │           │ ations.env_restart      │          │         │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ [+ 添加映射] [编辑] [删除]                                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### 2.2.8 设计要点总结

| 设计点 | 方案 |
|--------|------|
| **能力范围** | ChatOps 命令映射到现有 30 个顶级 Capability 下的子能力 |
| **继承方式** | 层级继承：拥有父级 Capability = 拥有所有子级 |
| **环境增强** | prod 环境需要更高风险等级的 Capability |
| **判定位置** | 在 AuthorizationEngine 的 RBAC 之后、ABAC 之前 |
| **实现方式** | 新建 `chatops_capabilities` 映射表，复用现有 CapabilityEngine |
| **审批绑定** | 风险等级 4 的命令需要额外审批 |

### 2.3 独立权限配置入口设计

> **设计原则**：Capability 能力域的权限配置是一个独立的系统级功能，不应与 ChatOps 配置耦合。

#### 2.3.1 入口位置

```
系统设置 (/console/settings)
├── 基础设置
│   ├── 租户配置
│   ├── 安全策略
│   └── 通知设置
├── 能力权限配置 [NEW - 独立入口]
│   └── 按菜单分类组织的能力域权限管理
└── 审计日志
    ├── 操作审计
    └── 登录日志
```

#### 2.3.2 能力权限配置页面

**按菜单分类组织**，让管理员直观地配置哪些角色/用户能查看或操作哪些菜单分类：

```
┌─────────────────────────────────────────────────────────────────┐
│ 能力权限配置 - 独立入口                                           │
├─────────────────────────────────────────────────────────────────┤
│ [全部] [工作台] [交付] [可观测性] [AI平台] [基础设施] [治理] [生态]│
├─────────────────────────────────────────────────────────────────┤
│ 当前: 交付 (4个能力域)                                            │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 能力域              │ 风险 │ 关联菜单项        │ 已分配角色   │ │
│ ├─────────────────────┼──────┼────────────────────┼────────────┤ │
│ │ ▶ pipeline_ops      │ 高   │ 流水线、部署       │ 运维管理员  │ │
│ │   ├─ trigger        │ 2    │ 触发流水线         │ developer  │ │
│ │   ├─ trigger_prod   │ 4    │ 触发生产流水线     │ admin     │ │
│ │   └─ delete         │ 4    │ 删除流水线         │ admin     │ │
│ │                                                             │ │
│ │ ▶ deployment_ops    │ 高   │ 灰度分析、变更智能 │ deployer  │ │
│ │   ├─ deploy_staging │ 3    │ 部署测试环境       │ developer │ │
│ │   └─ deploy_prod    │ 4    │ 部署生产环境       │ admin     │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ 操作: [展开所有] [折叠所有] [批量分配] [导出配置]                │
└─────────────────────────────────────────────────────────────────┘

点击"▶"或能力域名 → 展开子能力分配面板:
┌─────────────────────────────────────────────────────────────────┐
│ 能力域: pipeline_ops                                            │
│ 描述: 流水线操作权限，涵盖触发、删除、预算修改等                  │
│ 关联菜单: 流水线、部署                                           │
├─────────────────────────────────────────────────────────────────┤
│ 子能力分配:                                                      │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 子能力              │ 风险 │ 默认角色    │ 自定义分配          │ │
│ ├─────────────────────┼──────┼────────────┼────────────────────┤ │
│ │ trigger             │ 2    │ developer  │ [+添加角色/用户]   │ │
│ │ trigger_prod        │ 4    │ admin      │ [+添加角色/用户]   │ │
│ │ delete              │ 4    │ admin      │ [+添加角色/用户]   │ │
│ │ budget_modify       │ 3    │ admin      │ [+添加角色/用户]   │ │
│ └─────────────────────┴──────┴────────────┴────────────────────┘ │
│                                                                 │
│ 环境限制:                                                        │
│ [✓] dev:  无限制                                                │
│ [✓] staging: 无限制                                             │
│ [✓] prod: 需要审批 + 工作时间限制                                │
│                                                                 │
│ [保存] [取消]                                                   │
└─────────────────────────────────────────────────────────────────┘
```

#### 2.3.3 菜单分类与能力域映射

```
┌─────────────────────────────────────────────────────────────────┐
│ 菜单分类        →  Capability 能力域映射                         │
├─────────────────────────────────────────────────────────────────┤
│ 工作台          →  workbench_ops (1)                             │
│                 →  ticket_ops (2)                                │
│                 →  project_ops (3)                               │
│                                                                 │
│ 交付            →  pipeline_ops (4)                              │
│                 →  deployment_ops (5)                            │
│                 →  artifact_ops (6)                              │
│                 →  test_management (7)                           │
│                                                                 │
│ 可观测性        →  observability (8)                             │
│                 →  alert_ops (9)                                 │
│                 →  diagnostic_ops (10)                           │
│                                                                 │
│ AI 平台         →  ai_ops (11)                                   │
│                 →  knowledge_ops (12)                            │
│                                                                 │
│ 基础设施        →  infra_ops (13)                                │
│                 →  environment_ops (14)                          │
│                 →  backup_ops (15)                               │
│                 →  disaster_recovery (16)                        │
│                                                                 │
│ 治理            →  security_ops (17)                             │
│                 →  approval_ops (18)                             │
│                 →  system_config (19)                            │
│                 →  user_management (20)                          │
│                                                                 │
│ 生态            →  ecosystem (21)                                │
└─────────────────────────────────────────────────────────────────┘
```

#### 2.3.4 前端菜单权限控制逻辑

```
┌─────────────────────────────────────────────────────────────────┐
│ 菜单展示权限控制流程                                              │
└─────────────────────────────────────────────────────────────────┘

用户登录 → 获取用户角色 → 获取角色拥有的 Capability
                              │
                              ▼
                    前端菜单渲染
                              │
                              ▼
                    遍历菜单分类 (7个)
                              │
                    ┌─────────┴─────────┐
                    ▼                   ▼
              有对应 Capability    无对应 Capability
                    │                   │
                    ▼                   ▼
              显示该菜单分类        隐藏该菜单分类
                    │
                    ▼
              用户点击菜单项
                    │
                    ▼
              路由守卫检查 Capability
                    │
              ┌─────┴─────┐
              ▼           ▼
           通过         拒绝 → 403 "需要权限"
```

---

### 2.4 数据模型设计

#### 2.4.1 命令权限模型

```sql
-- 角色定义 - 复用现有 RBAC 角色体系，不新建独立角色表
-- 使用现有 roles 表 + role_permissions 关联表
-- 此处仅定义 ChatOps 专属的权限标识，角色仍通过系统级 RBAC 管理

-- 权限映射表（ChatOps 命令 ↔ RBAC 资源）
-- 复用现有 rbac_permissions 表，新增 ChatOps 相关权限记录
```

#### 2.4.2 命令版本模型

```sql
-- 命令版本历史
CREATE TABLE chatops_command_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    command_id UUID NOT NULL REFERENCES chatops_commands(id),
    version INT NOT NULL,
    command_text TEXT NOT NULL,
    parameters JSONB,
    description TEXT,
    changelog TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    is_current BOOLEAN DEFAULT false,
    UNIQUE(command_id, version)
);

-- 命令版本标签
CREATE TABLE chatops_command_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    command_version_id UUID REFERENCES chatops_command_versions(id),
    tag_name VARCHAR(50) NOT NULL,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW()
);
```

#### 2.4.3 限流模型

```sql
-- 限流策略
CREATE TABLE chatops_rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    target_type VARCHAR(20) NOT NULL, -- 'user'|'group'|'command'
    target_id VARCHAR(100),
    command_id UUID REFERENCES chatops_commands(id),
    limit_type VARCHAR(20) NOT NULL, -- 'minute'|'hour'|'day'
    limit_count INT NOT NULL,
    window_seconds INT NOT NULL,
    description TEXT,
    enabled BOOLEAN DEFAULT true,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

#### 2.4.4 审计日志模型

```sql
-- 审计日志主表
CREATE TABLE chatops_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id),
    user_id UUID REFERENCES users(id),
    action_type VARCHAR(50) NOT NULL, -- 'command_execute'|'config_change'|'login'|'permission_change'
    resource_type VARCHAR(50),
    resource_id VARCHAR(100),
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    status VARCHAR(20), -- 'success'|'failed'|'pending'
    error_message TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 审计日志索引
CREATE INDEX idx_audit_tenant_time ON chatops_audit_logs(tenant_id, created_at DESC);
CREATE INDEX idx_audit_user_time ON chatops_audit_logs(user_id, created_at DESC);
CREATE INDEX idx_audit_action_time ON chatops_audit_logs(action_type, created_at DESC);
```

#### 2.4.5 Webhook 模型

```sql
-- Webhook 配置
CREATE TABLE chatops_webhooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    name VARCHAR(100) NOT NULL,
    url VARCHAR(500) NOT NULL,
    events JSONB NOT NULL, -- ['command.execute', 'command.result', 'error']
    secret_key VARCHAR(255),
    headers JSONB,
    retry_config JSONB, -- {maxRetries: 3, retryInterval: 1000}
    enabled BOOLEAN DEFAULT true,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Webhook 投递记录
CREATE TABLE chatops_webhook_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    webhook_id UUID REFERENCES chatops_webhooks(id),
    event_type VARCHAR(50),
    payload JSONB,
    response_status INT,
    response_body TEXT,
    attempts INT DEFAULT 0,
    status VARCHAR(20), -- 'pending'|'success'|'failed'
    error_message TEXT,
    delivered_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);
```

### 2.5 ChatOps 后台页面配置权限范围

> **设计目标**：明确谁能访问、查看、修改 ChatOps 配置后台的各个功能模块。

#### 2.5.1 页面访问权限

```
┌─────────────────────────────────────────────────────────────────┐
│ ChatOps 后台访问控制                                              │
└─────────────────────────────────────────────────────────────────┘

路由: /console/chatops/settings
      ↓
路由守卫检查: capability = "chatops_config.view"
      ↓
┌──────────────┬──────────────────────────────────────────────┐
│ 角色          │ 访问权限                                      │
├──────────────┼──────────────────────────────────────────────┤
│ super_admin   │ 完全访问（所有 Tab）                          │
│ admin         │ 完全访问（所有 Tab）                          │
│ chatops_admin │ 配置管理（Tab 1-4）+ 审计日志（Tab 8）        │
│ developer     │ 只读访问（Tab 1-4）                           │
│ user          │ 无访问权限                                    │
└──────────────┴──────────────────────────────────────────────┘
```

#### 2.5.2 Tab 级权限矩阵

```
┌─────────────────────────────────────────────────────────────────┐
│ ChatOps 后台 Tab 权限矩阵                                        │
└─────────────────────────────────────────────────────────────────┘

┌──────────────────┬────────┬────────┬───────────────┬──────────┐
│ Tab              │ 查看   │ 编辑   │ 删除/重置     │ 审批     │
├──────────────────┼────────┼────────┼───────────────┼──────────┤
│ 1. 问答卡片       │ ✓ all  │ admin  │ admin         │ -        │
│ 2. 命令配置       │ ✓ all  │ admin  │ admin         │ -        │
│ 3. 平台配置       │ ✓ all  │ admin  │ admin         │ ✓ super  │
│ 4. 通知与免打扰   │ ✓ all  │ user   │ -             │ -        │
├──────────────────┼────────┼────────┼───────────────┼──────────┤
│ 5. 权限管理       │ admin  │ admin  │ super_admin   │ super    │
│ 6. 版本管理       │ admin  │ admin  │ admin         │ -        │
│ 7. 限流配置       │ admin  │ admin  │ admin         │ super    │
│ 8. 审计日志       │ admin  │ -      │ -             │ -        │
│ 9. 租户管理       │ super  │ super  │ super         │ super    │
│ 10. Webhook 管理  │ admin  │ admin  │ admin         │ -        │
└──────────────────┴────────┬─────────────────────────┴──────────┘
                            │
                    ✓ all = 有 chatops:read 权限的用户
                    admin = 有 chatops_config.edit 权限的用户
                    super = 有 chatops_config.manage 权限的用户
```

#### 2.5.3 配置项级权限

```
┌─────────────────────────────────────────────────────────────────┐
│ ChatOps 配置项权限明细                                           │
└─────────────────────────────────────────────────────────────────┘

┌──────────────────────┬────────────────┬────────────────────────┐
│ 配置项               │ 权限标识       │ 说明                   │
├──────────────────────┼────────────────┼────────────────────────┤
│ 问答卡片             │                │                        │
│ ├─ 查看卡片列表       │ card.read      │ 所有人可见             │
│ ├─ 新增/编辑卡片      │ card.write     │ admin 角色             │
│ ├─ 删除卡片           │ card.delete    │ admin 角色             │
│ └─ 恢复默认           │ card.reset     │ admin 角色             │
├──────────────────────┼────────────────┼────────────────────────┤
│ 命令配置             │                │                        │
│ ├─ 查看命令列表       │ command.read   │ 所有人可见             │
│ ├─ 新增/编辑命令      │ command.write  │ admin 角色             │
│ ├─ 删除命令           │ command.delete │ admin 角色             │
│ └─ 命令启停           │ command.toggle │ admin 角色             │
├──────────────────────┼────────────────┼────────────────────────┤
│ 平台配置             │                │                        │
│ ├─ 查看平台列表       │ platform.read  │ 所有人可见             │
│ ├─ 编辑 Webhook URL   │ platform.write │ admin 角色             │
│ ├─ 编辑 Token         │ platform.secret│ admin + 审计日志       │
│ └─ 平台启停           │ platform.toggle│ super_admin 审批       │
├──────────────────────┼────────────────┼────────────────────────┤
│ 权限管理             │                │                        │
│ ├─ 查看角色列表       │ role.read      │ admin 角色             │
│ ├─ 创建/编辑角色      │ role.write     │ admin 角色             │
│ ├─ 删除角色           │ role.delete    │ super_admin            │
│ ├─ 分配权限           │ perm.assign    │ admin 角色             │
│ └─ 审批高危权限       │ perm.approve   │ super_admin            │
├──────────────────────┼────────────────┼────────────────────────┤
│ 版本管理             │                │                        │
│ ├─ 查看版本历史       │ version.read   │ admin 角色             │
│ ├─ 创建新版本         │ version.write  │ admin 角色             │
│ ├─ 版本对比           │ version.diff   │ admin 角色             │
│ └─ 版本回滚           │ version.rollback│ admin + 审计日志      │
├──────────────────────┼────────────────┼────────────────────────┤
│ 限流配置             │                │                        │
│ ├─ 查看限流规则       │ ratelimit.read │ admin 角色             │
│ ├─ 创建/编辑规则      │ ratelimit.write│ admin 角色             │
│ ├─ 删除规则           │ ratelimit.delete│ admin 角色            │
│ └─ 紧急限流           │ ratelimit.emergency│ super_admin        │
├──────────────────────┼────────────────┼────────────────────────┤
│ 审计日志             │                │                        │
│ ├─ 查看日志列表       │ audit.read     │ admin 角色             │
│ ├─ 查看日志详情       │ audit.detail   │ admin 角色             │
│ ├─ 导出日志           │ audit.export   │ admin + 审计日志       │
│ └─ 删除日志           │ audit.delete   │ 禁止（合规要求）       │
├──────────────────────┼────────────────┼────────────────────────┤
│ 租户管理             │                │                        │
│ ├─ 查看租户列表       │ tenant.read    │ super_admin            │
│ ├─ 创建/编辑租户      │ tenant.write   │ super_admin            │
│ ├─ 冻结/解冻租户      │ tenant.freeze  │ super_admin            │
│ └─ 删除租户           │ tenant.delete  │ super_admin + 审批     │
├──────────────────────┼────────────────┼────────────────────────┤
│ Webhook 管理         │                │                        │
│ ├─ 查看 Webhook 列表  │ webhook.read   │ admin 角色             │
│ ├─ 创建/编辑 Webhook  │ webhook.write  │ admin 角色             │
│ ├─ 删除 Webhook       │ webhook.delete │ admin 角色             │
│ └─ 测试 Webhook       │ webhook.test   │ admin 角色             │
└──────────────────────┴────────────────┴────────────────────────┘
```

#### 2.5.4 权限与 Capability 映射

```
┌─────────────────────────────────────────────────────────────────┐
│ ChatOps 后台权限 → Capability 映射                               │
└─────────────────────────────────────────────────────────────────┘

chatops_config (顶级能力域)
├── chatops_config.card.read          (风险1)
├── chatops_config.card.write         (风险2)
├── chatops_config.card.delete        (风险2)
├── chatops_config.command.read       (风险1)
├── chatops_config.command.write      (风险3)
├── chatops_config.command.delete     (风险3)
├── chatops_config.platform.read      (风险1)
├── chatops_config.platform.write     (风险3)
├── chatops_config.platform.secret    (风险4)  ← 敏感操作，额外审计
├── chatops_config.role.read          (风险2)
├── chatops_config.role.write         (风险3)
├── chatops_config.role.delete        (风险4)
├── chatops_config.perm.assign        (风险3)
├── chatops_config.perm.approve       (风险4)
├── chatops_config.version.read       (风险1)
├── chatops_config.version.write      (风险2)
├── chatops_config.version.rollback   (风险4)
├── chatops_config.ratelimit.read     (风险2)
├── chatops_config.ratelimit.write    (风险3)
├── chatops_config.ratelimit.emergency│ (风险4)
├── chatops_config.audit.read         (风险2)
├── chatops_config.audit.export       (风险3)
├── chatops_config.tenant.read        (风险3)
├── chatops_config.tenant.write       (风险4)
├── chatops_config.tenant.freeze      (风险4)
├── chatops_config.webhook.read       (风险2)
├── chatops_config.webhook.write      (风险3)
└── chatops_config.webhook.test       (风险2)
```

#### 2.5.5 前端实现

```typescript
// src/components/ChatOps/ChatOpsPermissionGuard.tsx

import { usePermission } from '@/hooks/usePermission';

interface ChatOpsPermissionGuardProps {
  capability: string;        // 如 'chatops_config.card.write'
  fallback?: React.ReactNode; // 无权限时的展示
  children: React.ReactNode;
}

export const ChatOpsPermissionGuard: React.FC<ChatOpsPermissionGuardProps> = ({
  capability,
  fallback = <Text type="secondary">无操作权限</Text>,
  children,
}) => {
  const { hasPermission } = usePermission();
  
  if (!hasPermission(capability)) {
    return <>{fallback}</>;
  }
  
  return <>{children}</>;
};

// 使用示例:
// <ChatOpsPermissionGuard capability="chatops_config.card.write">
//   <Button onClick={handleSave}>保存</Button>
// </ChatOpsPermissionGuard>
```

---

### 2.6 权限申请流程设计（接入工单模块）

> **设计目标**：复用现有工单模块 (TicketingService) 实现权限申请审批流程，避免重复建设。

#### 2.6.1 工单模块集成架构

```
┌─────────────────────────────────────────────────────────────────┐
│              ChatOps 权限申请 → 工单模块集成                      │
└─────────────────────────────────────────────────────────────────┘

ChatOps PermissionRequestService
        │
        ├── 创建工单 (TicketingService.createTicket)
        │   ├── category: 'permission_request'  ← 新增工单类型
        │   ├── priority: 根据风险等级自动设定
        │   ├── source: 'chatops'
        │   └── metadata: { capabilityId, environment, duration }
        │
        ├── 工单流转 (TicketWorkflowService)
        │   ├── open → assigned → in-progress → resolved
        │   └── 审批人审批 = 工单状态流转
        │
        ├── 通知 (复用现有通知渠道)
        │   ├── IM 通知 (钉钉/企微/飞书)
        │   ├── 站内通知 (NotificationBell)
        │   └── 邮件通知 (可选)
        │
        └── 工单关闭
            ├── 审批通过 → 授予临时权限 → 工单 resolved
            ├── 审批拒绝 → 工单 closed
            └── 超时未处理 → 工单自动关闭 + 通知申请人
```

#### 2.6.2 工单类型扩展

```typescript
// orion-platform-service/src/services/ticketing/types.ts

// 新增工单类型
export type TicketCategory =
  | 'infrastructure'
  | 'application'
  | 'database'
  | 'network'
  | 'security'
  | 'deployment'
  | 'pipeline'
  | 'performance'
  | 'cost'
  | 'permission_request'   // ← 新增：权限申请
  | 'other';

// 新增工单来源
export type TicketSource =
  | 'manual'
  | 'alert'
  | 'incident'
  | 'api'
  | 'chatops';  // ← 新增：ChatOps 触发

// 权限申请工单的 metadata 结构
export interface PermissionRequestMetadata {
  capabilityId: string;       // 申请的能力域 ID
  capabilityName: string;     // 能力域名称
  riskLevel: number;          // 风险等级
  environment?: string;       // 目标环境
  duration: number;           // 申请时效（分钟）
  urgency: 'normal' | 'urgent';
  command?: string;           // 触发的命令（如果是命令执行触发）
  temporaryPermissionId?: string;  // 审批通过后的临时权限 ID
}
```

#### 2.6.3 权限申请流程

```
用户发起高危操作 /deploy env=prod version=1.2.3
        │
        ▼
┌───────────────────┐
│ 1. 权限检查失败    │ ──→ CapabilityEngine.check() 返回 denied
│    (风险等级 4)    │
└───────────────────┘
        │
        ▼
┌───────────────────┐
│ 2. 创建权限申请工单 │ ──→ TicketingService.createTicket({
│                    │      category: 'permission_request',
│                    │      priority: 'high',
│                    │      source: 'chatops',
│                    │      metadata: { capabilityId, environment, ... }
│                    │    })
└───────────────────┘
        │
        ▼
┌───────────────────┐
│ 3. 工单自动分配    │ ──→ 根据审批人配置自动分配
│                    │     通知审批人（IM + 站内）
└───────────────────┘
        │
        ▼
┌───────────────────┐
│ 4. 审批人处理工单  │ ──→ 审批人在工单页面审批
│                    │     TicketWorkflowService.transition()
└───────────────────┘
        │
        ▼
┌───────────────────┐
│ 5. 工单状态流转    │ ──→ approved → 授予临时权限
│                    │     rejected → 关闭工单
└───────────────────┘
        │
        ▼
┌───────────────────┐
│ 6. 用户收到通知    │ ──→ 通知申请人审批结果
│                    │     用户重新执行命令
└───────────────────┘
        │
        ▼
┌───────────────────┐
│ 7. 临时权限过期    │ ──→ 定时任务自动回收权限
│                    │     工单自动关闭
└───────────────────┘
```

#### 2.6.4 申请流程 UI 设计（复用现有工单组件）

**步骤 1：权限申请对话框**

```
┌─────────────────────────────────────────────────────────────┐
│ 权限申请                                                     │
├─────────────────────────────────────────────────────────────┤
│ 您没有权限执行此操作: /deploy env=prod version=1.2.3         │
│                                                             │
│ 申请能力: deployment_operations.deploy_prod (风险等级 4)      │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 申请原因 *                                               │ │
│ │ [请输入申请原因...]                                      │ │
│ │                                                          │ │
│ │ 申请时效 *                                               │ │
│ │ [1小时 ▼]  [2小时]  [4小时]  [8小时]  [自定义]          │ │
│ │                                                          │ │
│ │ 紧急程度                                                 │ │
│ │ [普通 ▼]  [紧急 - 需电话通知]                            │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ [提交申请] [取消]                                            │
│                                                             │
│ 提示: 申请将创建工单，由审批人处理                           │
└─────────────────────────────────────────────────────────────┘
```

**步骤 2：工单详情（复用现有工单详情页）**

```
┌─────────────────────────────────────────────────────────────┐
│ 工单 #PR-20260519-001 - 权限申请                             │
├─────────────────────────────────────────────────────────────┤
│ 基本信息:                                                    │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 标题: 申请 production 环境部署权限                       │ │
│ │ 类型: 权限申请                                           │ │
│ │ 优先级: 高                                               │ │
│ │ 状态: 待审批                                             │ │
│ │ 申请人: developer 张三                                   │ │
│ │ 申请时间: 2026-05-19 14:30                               │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ 申请详情:                                                    │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 能力域: deployment_operations.deploy_prod                │ │
│ │ 环境: prod                                               │ │
│ │ 申请时效: 2 小时                                         │ │
│ │ 申请原因: 修复线上 bug，需要紧急部署 v1.2.3               │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ 审批操作:                                                    │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 审批意见:                                                │ │
│ │ [请输入审批意见...]                                      │ │
│ │                                                          │ │
│ │ [批准] [拒绝]                                            │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ 审批记录:                                                    │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 时间         │ 操作人   │ 动作   │ 意见                 │ │
│ ├──────────────┼──────────┼────────┼─────────────────────┤ │
│ │ 14:30        │ 系统     │ 创建   │ 权限申请工单         │ │
│ │ 14:35        │ admin    │ 批准   │ 同意，注意观察       │ │
│ └──────────────┴──────────┴────────┴─────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

#### 2.6.5 核心代码（集成工单服务）

```typescript
// src/services/chatops/PermissionRequestService.ts

import { TicketingService, TicketCategory, TicketPriority, TicketSource } from '../ticketing/TicketingService';
import { TicketWorkflowService } from '../ticketing/TicketWorkflowService';
import { CapabilityEngine } from '../authz/CapabilityEngine';

export class PermissionRequestService {
  private ticketingService: TicketingService;
  private ticketWorkflowService: TicketWorkflowService;
  private capabilityEngine: CapabilityEngine;

  /**
   * 创建权限申请工单
   */
  async createRequest(input: {
    userId: string;
    capabilityId: string;
    capabilityName: string;
    riskLevel: number;
    environment?: string;
    reason: string;
    duration: number;  // 分钟
    urgency: 'normal' | 'urgent';
    command?: string;
  }): Promise<Ticket> {
    // 创建工单
    const ticket = await this.ticketingService.createTicket({
      title: `申请 ${input.capabilityName} 权限`,
      description: input.reason,
      category: 'permission_request' as TicketCategory,
      priority: input.riskLevel >= 4 ? 'high' : 'medium' as TicketPriority,
      reporter: input.userId,
      source: 'chatops' as TicketSource,
      metadata: {
        capabilityId: input.capabilityId,
        capabilityName: input.capabilityName,
        riskLevel: input.riskLevel,
        environment: input.environment,
        duration: input.duration,
        urgency: input.urgency,
        command: input.command,
      } as PermissionRequestMetadata,
    });

    // 自动分配给审批人
    const approverId = await this.getApprover(input.capabilityId);
    if (approverId) {
      await this.ticketWorkflowService.assignTicket(ticket.id, approverId);
    }

    // 通知审批人
    await this.notifyApprover(ticket, approverId);

    return ticket;
  }

  /**
   * 审批权限申请工单
   */
  async reviewTicket(ticketId: string, review: {
    approved: boolean;
    opinion: string;
    reviewerId: string;
  }): Promise<Ticket> {
    const ticket = await this.ticketingService.getTicket(ticketId);

    if (review.approved) {
      // 审批通过：工单状态流转到 resolved
      await this.ticketWorkflowService.transition(ticketId, 'resolve', {
        userId: review.reviewerId,
        note: review.opinion,
      });

      // 授予临时权限
      const tempPerm = await this.grantTemporaryPermission({
        userId: ticket.reporter,
        capabilityId: (ticket.metadata as PermissionRequestMetadata).capabilityId,
        duration: (ticket.metadata as PermissionRequestMetadata).duration,
        grantedBy: review.reviewerId,
        ticketId: ticket.id,
      });

      // 更新工单 metadata
      await this.ticketingService.updateTicket(ticketId, {
        metadata: {
          ...ticket.metadata,
          temporaryPermissionId: tempPerm.id,
        },
      });
    } else {
      // 审批拒绝：工单状态流转到 closed
      await this.ticketWorkflowService.transition(ticketId, 'close', {
        userId: review.reviewerId,
        note: review.opinion,
      });
    }

    // 通知申请人
    await this.notifyRequester(ticket, review);

    return ticket;
  }

  /**
   * 定时回收过期权限（由 CronJob 调用，每分钟执行一次）
   */
  async revokeExpiredPermissions(): Promise<number> {
    const result = await this.tempPermRepo.revokeAll({
      expires_at: new Date(),
    });
    return result.revokeCount;
  }

  /**
   * 授予临时权限（审批通过后调用）
   */
  private async grantTemporaryPermission(input: {
    userId: string;
    capabilityId: string;
    duration: number;
    grantedBy: string;
    ticketId: string;
  }): Promise<TemporaryPermission> {
    const expiresAt = new Date(Date.now() + input.duration * 60 * 1000);

    const perm = await this.tempPermRepo.create({
      userId: input.userId,
      capabilityId: input.capabilityId,
      grantedBy: input.grantedBy,
      grantedAt: new Date(),
      expiresAt,
      ticketId: input.ticketId,
    });

    return perm;
  }
}
```

#### 2.6.6 数据模型（扩展工单表）

```sql
-- 复用现有 tickets 表，无需新建
-- 仅需在 metadata JSONB 字段中存储权限申请相关信息

-- 临时权限记录表（新建）
CREATE TABLE chatops_temporary_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID REFERENCES tickets(id),
    user_id UUID NOT NULL REFERENCES users(id),
    capability_id VARCHAR(100) NOT NULL,
    granted_by UUID REFERENCES users(id),
    granted_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL,
    revoked_at TIMESTAMP,
    revoked_reason VARCHAR(50)  -- 'expired' | 'manual' | 'auto'
);

-- 索引
CREATE INDEX idx_temporary_permissions_user ON chatops_temporary_permissions(user_id, expires_at DESC);
CREATE INDEX idx_temporary_permissions_ticket ON chatops_temporary_permissions(ticket_id);
```

#### 2.6.7 审批流程集成

```
┌─────────────────────────────────────────────────────────────────┐
│                    审批流程集成架构                               │
└─────────────────────────────────────────────────────────────────┘

ChatOps PermissionRequestService
        │
        ├── 工单模块 (TicketingService)
        │   ├── 创建工单
        │   ├── 工单流转
        │   ├── 工单分配
        │   └── 工单通知
        │
        ├── 通知渠道 (复用现有)
        │   ├── IM 通知 (钉钉/企微/飞书/Slack)
        │   ├── 站内通知 (NotificationBell)
        │   └── 邮件通知 (可选)
        │
        ├── 审批流
        │   ├── 单级审批 (默认)
        │   └── 多级审批 (可配置)
        │
        ├── 超时策略
        │   ├── 自动提醒 (30 分钟未审批)
        │   └── 自动转交 (2 小时未审批)
        │
        └── 审计
            ├── 工单记录 (tickets 表)
            ├── 审批记录 (workflow_history 表)
            └── 临时权限记录 (chatops_temporary_permissions 表)
```

#### 2.6.8 紧急流程

对于紧急场景，支持**事后补批**：

```
紧急故障处理流程:

1. super_admin 直接授予临时权限 (无需审批)
2. 执行紧急操作
3. 24 小时内补填审批单
4. 审计团队事后审查

适用场景:
- 线上故障紧急修复
- 安全漏洞紧急修补
- 灾备切换

约束:
- 仅限 super_admin
- 操作全程录屏/录屏日志
- 24 小时内必须补批
- 事后审计不通过将撤销权限并记录
```

#### 2.6.9 审批权限矩阵

| 能力域 | 风险等级 | 默认审批人 | 可代理审批人 | 超时策略 |
|--------|---------|-----------|-------------|---------|
| deployment_ops.deploy_prod | 4 | super_admin | admin | 30 分钟提醒 |
| deployment_ops.rollback | 4 | super_admin | admin | 30 分钟提醒 |
| chatops_config.platform.secret | 4 | super_admin | - | 不可超时 |
| chatops_config.perm.approve | 4 | super_admin | - | 不可超时 |
| chatops_config.ratelimit.emergency | 4 | super_admin | admin | 30 分钟提醒 |
| tenant.freeze/delete | 4 | super_admin | - | 不可超时 |
| backup_ops.restore | 4 | super_admin | admin | 1 小时提醒 |
| disaster_recovery.failover | 4 | super_admin | - | 紧急流程 |

---

### 2.7 审批流程配置入口（V1 — 简单模式）

> **设计目标**：提供灵活的审批流程开关配置，支持按需启用/禁用/自定义审批规则。

#### 2.7.1 审批配置页面

```
┌─────────────────────────────────────────────────────────────────┐
│ 审批流程配置                                                     │
│ 位置: /console/chatops/settings/approval-config                  │
├─────────────────────────────────────────────────────────────────┤
│ [全局开关] [能力域配置] [审批人配置] [超时策略] [紧急流程]        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ 全局开关:                                                        │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 启用审批流程: [ON ▼]                                         │ │
│ │ 审批模式: [严格模式 ▼]  宽松模式 / 严格模式 / 仅记录模式     │ │
│ │                                                              │ │
│ │ ┌─────────────────────────────────────────────────────────┐ │ │
│ │ │ 审批模式说明:                                            │ │ │
│ │ │ 严格模式: 所有风险等级 4 的操作必须审批后才能执行        │ │ │
│ │ │ 宽松模式: 风险等级 4 操作可直接执行，事后审计            │ │ │
│ │ │ 仅记录模式: 不拦截操作，仅记录审批日志                   │ │ │
│ │ └─────────────────────────────────────────────────────────┘ │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### 2.7.2 能力域审批配置

```
┌─────────────────────────────────────────────────────────────────┐
│ 能力域审批规则配置                                               │
├─────────────────────────────────────────────────────────────────┤
│ 能力域列表:                                                      │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 能力域              │ 风险 │ 审批开关 │ 审批人  │ 超时  │操作│ │
│ ├─────────────────────┼──────┼──────────┼─────────┼───────┼────┤ │
│ │ deploy_prod         │ 4    │ [ON]     │ super_  │ 30min │编辑│ │
│ │                     │      │          │ admin   │       │    │ │
│ │ deployment_ops      │ 3/4  │ [ON]     │ admin   │ 1h    │编辑│ │
│ │ pipeline_ops        │ 3/4  │ [OFF]    │ -       │ -     │编辑│ │
│ │ environment_ops     │ 3/4  │ [ON]     │ admin   │ 1h    │编辑│ │
│ │ backup_ops          │ 3/4  │ [ON]     │ admin   │ 2h    │编辑│ │
│ │ disaster_recovery   │ 4    │ [ON]     │ super_  │ -     │编辑│ │
│ │                     │      │          │ admin   │       │    │ │
│ │ chatops_config      │ 3/4  │ [ON]     │ admin   │ 1h    │编辑│ │
│ └─────────────────────┴──────┴──────────┴─────────┴───────┴────┘ │
│                                                                 │
│ [批量启用] [批量禁用] [恢复默认] [导出配置]                       │
└─────────────────────────────────────────────────────────────────┘

点击"编辑"弹出详细配置:
┌─────────────────────────────────────────────────────────────┐
│ 编辑审批规则: deploy_prod                                   │
├─────────────────────────────────────────────────────────────┤
│ 审批开关: [ON ▼]                                            │
│                                                              │
│ 审批级别:                                                    │
│ [单选] 单级审批  [ ] 多级审批                                │
│                                                              │
│ 审批人配置:                                                  │
│ 第一级审批人: [super_admin ▼] 或 [指定用户: admin123 ▼]     │
│ 第二级审批人: [未配置] (多级审批时启用)                      │
│                                                              │
│ 代理审批人: [admin ▼] (主审批人不可用时代替审批)              │
│                                                              │
│ 超时策略:                                                    │
│ 超时时间: [30 分钟 ▼]                                       │
│ 超时动作: [发送提醒 ▼]  自动批准 / 自动拒绝 / 转交代理      │
│ 二次超时: [2 小时 ▼]                                        │
│ 二次超时时动作: [转交代理 ▼]                                │
│                                                              │
│ 生效环境:                                                    │
│ [✓] prod  [ ] staging  [ ] dev                              │
│                                                              │
│ 例外规则 (可选):                                             │
│ [添加例外]  例如: 紧急流程可跳过审批                          │
│                                                              │
│ [保存] [取消]                                                │
└─────────────────────────────────────────────────────────────┘
```

#### 2.7.3 审批人配置

```
┌─────────────────────────────────────────────────────────────────┐
│ 审批人配置                                                       │
├─────────────────────────────────────────────────────────────────┤
│ 默认审批人:                                                      │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 角色          │ 审批人        │ 状态   │ 操作                │ │
│ ├───────────────┼───────────────┼────────┼─────────────────────┤ │
│ │ super_admin   │ 张三 (admin1) │ 在线   │ [更换] [设离线]     │ │
│ │ admin         │ 李四 (admin2) │ 在线   │ [更换] [设离线]     │ │
│ │ oncall        │ 王五 (ops1)   │ 离线   │ [更换] [设在线]     │ │
│ └───────────────┴───────────────┴────────┴─────────────────────┘ │
│                                                                 │
│ 审批值班表: [二期]                                                │
│ > 首期只需配置审批人角色，不需要排班功能                             │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 时间段      │ 周一   │ 周二   │ 周三   │ 周四   │ 周五   │ │
│ ├─────────────┼────────┼────────┼────────┼────────┼────────┤ │
│ │ 09:00-18:00 │ 张三   │ 李四   │ 张三   │ 王五   │ 李四   │ │
│ │ 18:00-09:00 │ oncall │ oncall │ oncall │ oncall │ oncall │ │
│ └─────────────┴────────┴────────┴────────┴────────┴────────┘ │
│                                                                 │
│ [新增值班] [编辑]                                               │
└─────────────────────────────────────────────────────────────────┘
```

#### 2.7.4 数据模型

```sql
-- 审批配置表
CREATE TABLE chatops_approval_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    capability_id VARCHAR(100) NOT NULL,
    enabled BOOLEAN DEFAULT true,
    approval_mode VARCHAR(20) DEFAULT 'strict',  -- 'strict'|'relaxed'|'log_only'
    approval_level INT DEFAULT 1,               -- 审批级数
    approver_roles JSONB DEFAULT '["super_admin"]',
    approver_users JSONB DEFAULT '[]',           -- 指定审批人
    proxy_roles JSONB DEFAULT '["admin"]',       -- 代理审批人
    proxy_users JSONB DEFAULT '[]',
    timeout_minutes INT DEFAULT 30,
    timeout_action VARCHAR(20) DEFAULT 'remind',  -- 'remind'|'auto_approve'|'auto_reject'|'escalate'
    second_timeout_minutes INT DEFAULT 120,
    second_timeout_action VARCHAR(20) DEFAULT 'escalate',
    environments JSONB DEFAULT '["prod"]',        -- 生效环境
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(tenant_id, capability_id)
);

-- 审批值班表 [二期 - 首期只需配置审批人角色，不需要排班功能]
CREATE TABLE chatops_approval_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    time_slot VARCHAR(20) NOT NULL,              -- 'day'|'night'
    day_of_week INT NOT NULL,                    -- 1-7
    approver_id UUID NOT NULL REFERENCES users(id),
    is_oncall BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
);
```

#### 2.7.5 配置 API

```
# 审批配置
GET    /api/v1/chatops/admin/approval-configs              # 获取所有审批配置
PUT    /api/v1/chatops/admin/approval-configs              # 批量更新配置
GET    /api/v1/chatops/admin/approval-configs/:capability  # 获取单个能力域配置
PUT    /api/v1/chatops/admin/approval-configs/:capability  # 更新单个能力域配置

# 审批人配置
GET    /api/v1/chatops/admin/approvers                     # 获取审批人列表
PUT    /api/v1/chatops/admin/approvers                     # 更新审批人
GET    /api/v1/chatops/admin/approvers/schedule            # 获取值班表
PUT    /api/v1/chatops/admin/approvers/schedule            # 更新值班表

# 全局开关
GET    /api/v1/chatops/admin/approval-global-config        # 获取全局开关
PUT    /api/v1/chatops/admin/approval-global-config        # 更新全局开关
```

---

### 2.8 审批流程低代码引擎（V2 — 高级模式）

> **设计目标**：通过配置化方式实现审批流程的自定义，无需修改代码即可调整审批规则、节点、条件。

#### 2.8.1 低代码配置架构

```
┌─────────────────────────────────────────────────────────────────┐
│              低代码审批流程配置架构                                │
└─────────────────────────────────────────────────────────────────┘

配置层 (JSON)
    │
    ├── 审批流程定义
    │   ├── 流程名称
    │   ├── 触发条件 (capabilityId, riskLevel, environment)
    │   ├── 审批节点 (可配置多级)
    │   │   ├── 节点名称
    │   │   ├── 审批人类型 (角色/用户/动态规则)
    │   │   ├── 审批人值
    │   │   ├── 超时策略
    │   │   └── 通过/拒绝后的动作
    │   └── 全局超时策略
    │
    ├── 工单模板定义
    │   ├── 标题模板
    │   ├── 描述模板
    │   └── 自定义字段
    │
    └── 通知模板定义
        ├── 审批通知模板
        └── 结果通知模板

执行层 (引擎)
    │
    ├── 流程引擎
    │   ├── 读取配置
    │   ├── 创建工单
    │   ├── 驱动节点流转
    │   └── 执行动作
    │
    └── 通知引擎
        ├── 渲染通知模板
        └── 发送通知
```

#### 2.8.2 配置页面

```
┌─────────────────────────────────────────────────────────────────┐
│ 审批流程配置 (低代码)                                             │
│ 位置: /console/chatops/settings/approval-config                  │
├─────────────────────────────────────────────────────────────────┤
│ [流程列表] [工单模板] [通知模板] [全局设置]                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ 审批流程列表:                                                    │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 流程名称              │ 触发条件        │ 节点数 │ 状态 │操作│ │
│ ├───────────────────────┼─────────────────┼────────┼──────┼────┤ │
│ │ 生产部署审批          │ deploy_prod     │ 1      │ 启用 │编辑│ │
│ │ 生产回滚审批          │ rollback+prod   │ 2      │ 启用 │编辑│ │
│ │ 高危命令审批          │ risk>=4         │ 1      │ 启用 │编辑│ │
│ │ 权限变更审批          │ perm.assign     │ 1      │ 启用 │编辑│ │
│ │ 紧急限流审批          │ ratelimit.emerg │ 1      │ 禁用 │编辑│ │
│ └───────────────────────┴─────────────────┴────────┴──────┴────┘ │
│                                                                 │
│ [+ 新建流程] [导入配置] [导出配置]                               │
└─────────────────────────────────────────────────────────────────┘

点击"新建流程"或"编辑":
┌─────────────────────────────────────────────────────────────┐
│ 编辑审批流程                                                 │
├─────────────────────────────────────────────────────────────┤
│ 基本信息:                                                    │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 流程名称: [生产部署审批________________]                  │ │
│ │ 流程描述: [生产环境部署操作的审批流程_____]               │ │
│ │ 状态: [启用 ▼]                                           │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ 触发条件:                                                    │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 条件类型: [能力域 ▼]                                     │ │
│ │ 能力域: [deployment_operations.deploy_prod ▼]            │ │
│ │ 环境: [prod ▼]  (可选，留空表示所有环境)                  │ │
│ │ 风险等级: [>= 4 ▼]  (可选)                               │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ 工单模板:                                                    │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 工单标题: [权限申请: {{capabilityName}} - {{env}}]      │ │
│ │ 工单描述: {{description}}                                │ │
│ │                                                          │ │
│ │ 自定义字段:                                              │ │
│ │ ┌─────────────────────────────────────────────────────┐ │ │
│ │ │ 字段名        │ 类型    │ 必填 │ 默认值    │ 操作   │ │ │
│ │ ├───────────────┼─────────┼──────┼───────────┼────────┤ │ │
│ │ │ capabilityId  │ 文本    │ 是   │ -         │ 编辑   │ │ │
│ │ │ environment   │ 文本    │ 是   │ -         │ 编辑   │ │ │
│ │ │ duration      │ 数字    │ 是   │ 60        │ 编辑   │ │ │
│ │ │ reason        │ 多行文本│ 是   │ -         │ 编辑   │ │ │
│ │ └───────────────┴─────────┴──────┴───────────┴────────┘ │ │
│ │                                                          │ │
│ │ [+ 添加字段]                                              │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ 审批节点:                                                    │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 节点 1                                                   │ │
│ │ ┌─────────────────────────────────────────────────────┐ │ │
│ │ │ 节点名称: [直属领导审批____________]                  │ │ │
│ │ │ 审批人类型: [角色 ▼]                                 │ │ │
│ │ │ 审批人: [admin ▼]                                    │ │ │
│ │ │ 或指定用户: [__________]                             │ │ │
│ │ │ 超时时间: [30 分钟]                                  │ │ │
│ │ │ 超时动作: [发送提醒 ▼]                               │ │ │
│ │ │ 通过动作: [流转到下一节点 ▼]                         │ │ │
│ │ │ 拒绝动作: [结束流程，拒绝申请 ▼]                     │ │ │
│ │ └─────────────────────────────────────────────────────┘ │ │
│ │                                                          │ │
│ │ [+ 添加节点]  (支持多级审批)                              │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ 全局超时:                                                    │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 总超时时间: [2 小时]                                     │ │
│ │ 总超时动作: [自动拒绝 ▼]                                 │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ [保存] [取消] [预览配置 JSON]                                │
└─────────────────────────────────────────────────────────────┘
```

#### 2.8.3 配置 JSON 结构

```json
{
  "approvalFlows": [
    {
      "id": "prod-deploy-approval",
      "name": "生产部署审批",
      "description": "生产环境部署操作的审批流程",
      "enabled": true,
      "trigger": {
        "type": "capability",
        "capabilityId": "deployment_operations.deploy_prod",
        "environment": "prod",
        "riskLevel": ">=4"
      },
      "ticketTemplate": {
        "title": "权限申请: {{capabilityName}} - {{environment}}",
        "description": "{{description}}",
        "priority": "high",
        "category": "permission_request",
        "customFields": [
          { "name": "capabilityId", "type": "text", "required": true },
          { "name": "environment", "type": "text", "required": true },
          { "name": "duration", "type": "number", "required": true, "default": 60 },
          { "name": "reason", "type": "textarea", "required": true }
        ]
      },
      "nodes": [
        {
          "id": "node-1",
          "name": "管理员审批",
          "approverType": "role",
          "approverValue": "admin",
          "timeoutMinutes": 30,
          "timeoutAction": "remind",
          "onApprove": "next",
          "onReject": "reject"
        }
      ],
      "globalTimeout": {
        "minutes": 120,
        "action": "reject"
      }
    },
    {
      "id": "prod-rollback-approval",
      "name": "生产回滚审批",
      "description": "生产环境回滚操作的两级审批流程",
      "enabled": true,
      "trigger": {
        "type": "capability",
        "capabilityId": "deployment_operations.rollback",
        "environment": "prod"
      },
      "ticketTemplate": {
        "title": "紧急回滚申请: {{deployment}} - {{environment}}",
        "description": "{{description}}",
        "priority": "critical",
        "category": "permission_request",
        "customFields": [
          { "name": "deployment", "type": "text", "required": true },
          { "name": "targetVersion", "type": "text", "required": false },
          { "name": "reason", "type": "textarea", "required": true }
        ]
      },
      "nodes": [
        {
          "id": "node-1",
          "name": "技术负责人审批",
          "approverType": "role",
          "approverValue": "admin",
          "timeoutMinutes": 15,
          "timeoutAction": "escalate",
          "escalateTo": "node-2",
          "onApprove": "next",
          "onReject": "reject"
        },
        {
          "id": "node-2",
          "name": "运维总监审批",
          "approverType": "role",
          "approverValue": "super_admin",
          "timeoutMinutes": 30,
          "timeoutAction": "reject",
          "onApprove": "complete",
          "onReject": "reject"
        }
      ],
      "globalTimeout": {
        "minutes": 60,
        "action": "reject"
      }
    }
  ]
}
```

#### 2.8.4 低代码引擎核心代码

```typescript
// src/services/approval/ApprovalFlowEngine.ts
// 注意：这是系统级通用审批流程引擎（V3），放在 approval/ 目录供所有模块复用
// 不放在 chatops/ 下，因为 Pipeline、Deploy、CMDB 等模块都会调用

import { TicketingService } from '../ticketing/TicketingService';
import { TicketWorkflowService } from '../ticketing/TicketWorkflowService';

export interface ApprovalFlowConfig {
  id: string;
  name: string;
  enabled: boolean;
  trigger: {
    type: 'capability';
    capabilityId: string;
    environment?: string;
    riskLevel?: string;
  };
  ticketTemplate: {
    title: string;
    description: string;
    priority: string;
    category: string;
    customFields: Array<{
      name: string;
      type: 'text' | 'number' | 'textarea' | 'select';
      required: boolean;
      default?: any;
      options?: string[];
    }>;
  };
  nodes: Array<{
    id: string;
    name: string;
    approverType: 'role' | 'user' | 'dynamic';
    approverValue: string;
    timeoutMinutes: number;
    timeoutAction: 'remind' | 'escalate' | 'reject' | 'approve';
    escalateTo?: string;
    onApprove: 'next' | 'complete';
    onReject: 'reject';
  }>;
  globalTimeout: {
    minutes: number;
    action: 'reject' | 'approve';
  };
}

export class ApprovalFlowEngine {
  private ticketingService: TicketingService;
  private ticketWorkflowService: TicketWorkflowService;
  private configs: Map<string, ApprovalFlowConfig> = new Map();
  private activeTickets: Map<string, TicketState> = new Map();

  /**
   * 加载配置（从数据库或文件）
   */
  async loadConfigs(): Promise<void> {
    const configs = await this.configRepo.findAll();
    for (const config of configs) {
      this.configs.set(config.id, config as ApprovalFlowConfig);
    }
  }

  /**
   * 匹配审批流程
   */
  matchFlow(context: {
    capabilityId: string;
    environment?: string;
    riskLevel?: number;
  }): ApprovalFlowConfig | null {
    for (const [, flow] of this.configs) {
      if (!flow.enabled) continue;

      const trigger = flow.trigger;
      if (trigger.capabilityId !== context.capabilityId) continue;
      if (trigger.environment && trigger.environment !== context.environment) continue;
      if (trigger.riskLevel && !this.matchRiskLevel(trigger.riskLevel, context.riskLevel)) continue;

      return flow;
    }
    return null;
  }

  /**
   * 创建工单并启动审批流程
   */
  async startFlow(flow: ApprovalFlowConfig, context: {
    userId: string;
    capabilityId: string;
    environment?: string;
    reason: string;
    customData: Record<string, any>;
  }): Promise<Ticket> {
    // 1. 渲染模板
    const title = this.renderTemplate(flow.ticketTemplate.title, context);
    const description = this.renderTemplate(flow.ticketTemplate.description, context);

    // 2. 创建工单
    const ticket = await this.ticketingService.createTicket({
      title,
      description,
      category: flow.ticketTemplate.category,
      priority: flow.ticketTemplate.priority,
      reporter: context.userId,
      source: 'chatops',
      metadata: {
        approvalFlowId: flow.id,
        currentNodeId: flow.nodes[0]?.id,
        ...context.customData,
      },
    });

    // 3. 分配到第一个审批人
    await this.assignToApprover(ticket, flow.nodes[0]);

    // 4. 启动超时定时器
    this.startTimeoutTimer(ticket, flow);

    return ticket;
  }

  /**
   * 审批节点流转
   */
  async processNodeAction(ticketId: string, action: 'approve' | 'reject', reviewerId: string): Promise<void> {
    const ticket = await this.ticketingService.getTicket(ticketId);
    const flowId = ticket.metadata.approvalFlowId;
    const flow = this.configs.get(flowId);
    if (!flow) return;

    const currentNodeId = ticket.metadata.currentNodeId;
    const currentNodeIndex = flow.nodes.findIndex(n => n.id === currentNodeId);
    const currentNode = flow.nodes[currentNodeIndex];

    if (action === 'approve') {
      if (currentNode.onApprove === 'next') {
        // 流转到下一节点
        const nextNode = flow.nodes[currentNodeIndex + 1];
        if (nextNode) {
          await this.ticketingService.updateTicket(ticketId, {
            metadata: { ...ticket.metadata, currentNodeId: nextNode.id },
          });
          await this.assignToApprover(ticket, nextNode);
        } else {
          // 流程完成
          await this.completeFlow(ticket);
        }
      } else if (currentNode.onApprove === 'complete') {
        await this.completeFlow(ticket);
      }
    } else if (action === 'reject') {
      await this.rejectFlow(ticket, reviewerId);
    }
  }

  /**
   * 分配给审批人
   */
  private async assignToApprover(ticket: Ticket, node: ApprovalFlowConfig['nodes'][0]): Promise<void> {
    let approverId: string;

    if (node.approverType === 'role') {
      approverId = await this.getUserByRole(node.approverValue);
    } else if (node.approverType === 'user') {
      approverId = node.approverValue;
    } else {
      // 动态规则（如：申请人的直属领导）
      approverId = await this.resolveDynamicApprover(ticket);
    }

    if (approverId) {
      await this.ticketWorkflowService.assignTicket(ticket.id, approverId);
      await this.notifyApprover(ticket, approverId);
    }
  }

  /**
   * 渲染模板
   */
  private renderTemplate(template: string, context: Record<string, any>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => context[key] || '');
  }
}
```

#### 2.8.5 配置数据模型

```sql
-- 审批流程配置表
CREATE TABLE chatops_approval_flow_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    flow_id VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    enabled BOOLEAN DEFAULT true,
    config JSONB NOT NULL,  -- 完整配置 JSON
    version INT DEFAULT 1,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 配置变更历史
CREATE TABLE chatops_approval_flow_config_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_id UUID REFERENCES chatops_approval_flow_configs(id),
    version INT NOT NULL,
    config JSONB NOT NULL,
    changed_by UUID REFERENCES users(id),
    changed_at TIMESTAMP DEFAULT NOW(),
    change_reason TEXT
);
```

#### 2.8.6 配置 API

```
# 审批流程配置
GET    /api/v1/chatops/admin/approval-flows               # 获取所有流程
POST   /api/v1/chatops/admin/approval-flows               # 创建流程
GET    /api/v1/chatops/admin/approval-flows/:id           # 获取流程详情
PUT    /api/v1/chatops/admin/approval-flows/:id           # 更新流程
DELETE /api/v1/chatops/admin/approval-flows/:id           # 删除流程
POST   /api/v1/chatops/admin/approval-flows/:id/clone     # 克隆流程
POST   /api/v1/chatops/admin/approval-flows/import        # 导入配置
GET    /api/v1/chatops/admin/approval-flows/export        # 导出配置

# 配置校验
POST   /api/v1/chatops/admin/approval-flows/validate      # 校验配置合法性

# 流程实例
GET    /api/v1/chatops/admin/approval-flows/instances     # 查询运行中的实例
GET    /api/v1/chatops/admin/approval-flows/instances/:id # 查看实例详情
```

---

### 2.9 系统级通用审批流程引擎（V3 — 全平台统一）

> **设计目标**：将审批流程能力从 ChatOps 扩展为系统级通用能力，所有模块均可通过配置接入工单审批流程。

#### 审批系统统一架构（V1 → V2 → V3 演进关系）

```
┌─────────────────────────────────────────────────────────────────────┐
│                        审批系统统一架构                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  V1 简单模式 (2.7)      V2 低代码引擎 (2.8)      V3 全平台统一 (2.9) │
│  ┌───────────────┐      ┌──────────────────┐     ┌───────────────┐  │
│  │ 开关/审批人    │      │ JSON 流程定义     │     │ 跨模块复用     │  │
│  │ 超时策略配置   │────→ │ 节点/条件/代理    │────→│ 模板/降级/     │  │
│  │ 入门级配置     │      │ V1 的超集         │     │ Agent/监控    │  │
│  └───────────────┘      └──────────────────┘     └───────────────┘  │
│                                                                     │
│  关系: V1 ⊂ V2 ⊂ V3，向后兼容，逐步升级                              │
│                                                                     │
│  扩展文档: approval-flow-advanced-capabilities-design.md             │
│  → V3 的 Agent 自动分析 + 降级推导 + 熔断 + 多实例并发策略            │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

#### 2.9.1 系统级审批架构

```
┌─────────────────────────────────────────────────────────────────┐
│                    系统级通用审批流程引擎                         │
└─────────────────────────────────────────────────────────────────┘

                    ┌──────────────────┐
                    │   审批流程配置    │
                    │   (JSON/DB)      │
                    └────────┬─────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
        ┌──────────┐  ┌──────────┐  ┌──────────┐
        │ ChatOps  │  │ Pipeline │  │ Deploy   │
        │ 部署审批  │  │ 发布审批  │  │ 回滚审批  │
        └──────────┘  └──────────┘  └──────────┘
              │              │              │
              └──────────────┼──────────────┘
                             ▼
                    ┌──────────────────┐
                    │   审批流程引擎    │
                    │ (ApprovalFlow    │
                    │  Engine)         │
                    └────────┬─────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
        ┌──────────┐  ┌──────────┐  ┌──────────┐
        │ 工单模块  │  │ 通知模块  │  │ 审计模块  │
        │Ticketing │  │Notify    │  │ Audit    │
        └──────────┘  └──────────┘  └──────────┘
```

#### 2.9.2 各模块接入审批流程的场景

| 模块 | 审批场景 | 触发条件 | 风险等级 | 默认审批人 |
|------|---------|---------|---------|-----------|
| **ChatOps** | 命令执行审批 | capability 检查失败 | 4 | admin |
| **Pipeline** | 生产流水线触发 | environment=prod | 4 | admin |
| **Deploy** | 生产环境部署/回滚 | environment=prod | 4 | super_admin |
| **Environment** | 生产环境销毁 | environment=prod + destroy | 4 | super_admin |
| **Config** | 配置变更发布 | config.change + prod | 3 | admin |
| **Artifact** | 制品版本回滚 | artifact.rollback | 3 | admin |
| **Security** | 安全策略修改 | security.policy_modify | 4 | super_admin |
| **Tenant** | 租户冻结/删除 | tenant.freeze/delete | 4 | super_admin |
| **Backup** | 数据恢复 | backup.restore | 4 | super_admin |
| **Branch Policy** | 分支策略绕过 | branch_policy.bypass | 4 | super_admin |
| **Infrastructure** | 基础设施变更 | infra.change | 3 | admin |
| **FinOps** | 预算调整 | budget.modify | 3 | admin |

#### 2.9.3 通用审批流程配置

```json
{
  "approvalFlows": [
    {
      "id": "chatops-deploy-prod",
      "module": "chatops",
      "name": "ChatOps 生产部署审批",
      "enabled": true,
      "trigger": {
        "type": "capability",
        "capabilityId": "deployment_operations.deploy_prod",
        "environment": "prod"
      },
      "ticketTemplate": {
        "title": "ChatOps 部署申请: {{service}} → {{environment}}",
        "category": "permission_request",
        "priority": "high",
        "customFields": [
          { "name": "service", "type": "text", "required": true },
          { "name": "environment", "type": "text", "required": true },
          { "name": "version", "type": "text", "required": false }
        ]
      },
      "nodes": [
        {
          "id": "node-1",
          "name": "管理员审批",
          "approverType": "role",
          "approverValue": "admin",
          "timeoutMinutes": 30,
          "timeoutAction": "remind"
        }
      ]
    },
    {
      "id": "pipeline-trigger-prod",
      "module": "pipeline",
      "name": "流水线生产触发审批",
      "enabled": true,
      "trigger": {
        "type": "resource_action",
        "resource": "pipeline",
        "action": "trigger",
        "environment": "prod"
      },
      "ticketTemplate": {
        "title": "流水线触发申请: {{pipelineName}} → {{environment}}",
        "category": "pipeline_approval",
        "priority": "high",
        "customFields": [
          { "name": "pipelineName", "type": "text", "required": true },
          { "name": "environment", "type": "text", "required": true }
        ]
      },
      "nodes": [
        {
          "id": "node-1",
          "name": "技术负责人审批",
          "approverType": "role",
          "approverValue": "admin",
          "timeoutMinutes": 30,
          "timeoutAction": "remind"
        }
      ]
    },
    {
      "id": "config-change-prod",
      "module": "config",
      "name": "配置变更审批",
      "enabled": true,
      "trigger": {
        "type": "resource_action",
        "resource": "config",
        "action": "change",
        "environment": "prod"
      },
      "ticketTemplate": {
        "title": "配置变更申请: {{configKey}} → {{environment}}",
        "category": "config_approval",
        "priority": "medium",
        "customFields": [
          { "name": "configKey", "type": "text", "required": true },
          { "name": "oldValue", "type": "text", "required": false },
          { "name": "newValue", "type": "text", "required": true }
        ]
      },
      "nodes": [
        {
          "id": "node-1",
          "name": "配置管理员审批",
          "approverType": "role",
          "approverValue": "admin",
          "timeoutMinutes": 60,
          "timeoutAction": "remind"
        }
      ]
    }
  ]
}
```

#### 2.9.4 模块接入方式

```typescript
// 各模块通过统一接口接入审批流程

import { ApprovalFlowEngine } from '../approval/ApprovalFlowEngine';

// 示例：Pipeline 模块接入审批
class PipelineRunService {
  private approvalEngine: ApprovalFlowEngine;

  async triggerPipeline(params: {
    pipelineId: string;
    environment: string;
    userId: string;
  }): Promise<RunResult> {
    // 1. 检查是否需要审批
    const approvalRequired = await this.approvalEngine.checkApproval({
      moduleId: 'pipeline',
      capabilityId: 'pipeline_operations.trigger',
      environment: params.environment,
    });

    if (approvalRequired) {
      // 2. 创建审批工单
      const ticket = await this.approvalEngine.startFlow({
        moduleId: 'pipeline',
        context: {
          userId: params.userId,
          pipelineId: params.pipelineId,
          environment: params.environment,
        },
      });

      // 3. 返回审批中状态
      return { status: 'approval_pending', ticketId: ticket.id };
    }

    // 4. 无需审批，直接执行
    return this.executePipeline(params);
  }
}

// 示例：Deploy 模块接入审批
class DeployService {
  private approvalEngine: ApprovalFlowEngine;

  async deploy(params: {
    service: string;
    environment: string;
    version: string;
    userId: string;
  }): Promise<DeployResult> {
    const approvalRequired = await this.approvalEngine.checkApproval({
      moduleId: 'deploy',
      capabilityId: 'deployment_operations.deploy_prod',
      environment: params.environment,
    });

    if (approvalRequired) {
      const ticket = await this.approvalEngine.startFlow({
        moduleId: 'deploy',
        context: {
          userId: params.userId,
          service: params.service,
          environment: params.environment,
          version: params.version,
        },
      });
      return { status: 'approval_pending', ticketId: ticket.id };
    }

    return this.executeDeploy(params);
  }
}
```

#### 2.9.5 审批流程配置管理页面

```
┌─────────────────────────────────────────────────────────────────┐
│ 系统级审批流程配置                                                 │
│ 位置: /console/settings/approval-config                           │
├─────────────────────────────────────────────────────────────────┤
│ [全部] [ChatOps] [Pipeline] [Deploy] [Config] [Environment]...   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ 审批流程列表 (全部模块):                                          │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 流程名称          │ 模块    │ 触发条件     │ 状态 │ 操作     │ │
│ ├───────────────────┼─────────┼──────────────┼──────┼──────────┤ │
│ │ ChatOps 生产部署   │ ChatOps │ deploy_prod  │ 启用 │ 编辑/克隆│ │
│ │ 流水线生产触发     │ Pipeline│ pipeline+prod│ 启用 │ 编辑/克隆│ │
│ │ 生产环境部署       │ Deploy  │ deploy_prod  │ 启用 │ 编辑/克隆│ │
│ │ 生产环境回滚       │ Deploy  │ rollback+prod│ 启用 │ 编辑/克隆│ │
│ │ 配置变更审批       │ Config  │ config+prod  │ 启用 │ 编辑/克隆│ │
│ │ 安全策略修改       │ Security│ policy_modify│ 启用 │ 编辑/克隆│ │
│ │ 租户冻结审批       │ Tenant  │ tenant.freeze│ 启用 │ 编辑/克隆│ │
│ └───────────────────┴─────────┴──────────────┴──────┴──────────┘ │
│                                                                 │
│ [+ 新建流程] [导入] [导出] [批量启停]                            │
└─────────────────────────────────────────────────────────────────┘
```

#### 2.9.6 数据库扩展

```sql
-- 扩展审批流程配置表，增加 module 字段
ALTER TABLE chatops_approval_flow_configs
  ADD COLUMN module VARCHAR(50) NOT NULL DEFAULT 'chatops';

-- 添加模块索引
CREATE INDEX idx_approval_flow_module ON chatops_approval_flow_configs(module, enabled);

-- 审批流程实例表（记录所有模块的审批实例）
CREATE TABLE approval_flow_instances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    flow_id VARCHAR(100) NOT NULL,
    module VARCHAR(50) NOT NULL,
    ticket_id UUID REFERENCES tickets(id),
    requester_id UUID REFERENCES users(id),
    current_node_id VARCHAR(100),
    status VARCHAR(20) DEFAULT 'running',  -- 'running'|'completed'|'rejected'|'timeout'
    context JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP
);

-- 索引
CREATE INDEX idx_approval_instance_module ON approval_flow_instances(module, status);
CREATE INDEX idx_approval_instance_ticket ON approval_flow_instances(ticket_id);
```

#### 2.9.7 模块接入清单

| 模块 | 接入状态 | 配置位置 | 负责人 |
|------|---------|---------|--------|
| ChatOps | ✅ 已设计 | `chatops-admin-advanced-capabilities-design.md` | ChatOps 团队 |
| Pipeline | 🔄 待接入 | 复用审批流程引擎 | Pipeline 团队 |
| Deploy | 🔄 待接入 | 复用审批流程引擎 | Deploy 团队 |
| Config | 🔄 待接入 | 复用审批流程引擎 | Config 团队 |
| Environment | 🔄 待接入 | 复用审批流程引擎 | Infra 团队 |
| Security | 🔄 待接入 | 复用审批流程引擎 | Security 团队 |
| Tenant | 🔄 待接入 | 复用审批流程引擎 | Tenant 团队 |
| Backup | 🔄 待接入 | 复用审批流程引擎 | Infra 团队 |
| **任意新系统** | 参考 **2.10 新系统接入规范** | 4 步标准化路径 | 各开发团队 |
---

### 2.10 新系统接入权限 + 工单审批通用规范

> **设计目标**：提供标准化接入路径，使任意新系统以最低成本接入权限控制与工单审批体系。

#### 2.9.1 接入路径总览

新系统接入只需完成 **4 步**：

```
第 1 步：定义资源与操作（RBAC 层）
        ↓
第 2 步：映射到 Capability 能力域（能力层）
        ↓
第 3 步：配置审批流程规则（审批层）
        ↓
第 4 步：在服务方法中调用检查（执行层）
```

#### 2.9.2 第 1 步：定义资源与操作

在新系统的路由文件中声明 `resource` 和 `action`：

```typescript
// 示例：orion-new-svc/src/api/new-module-routes.ts

server.post('/new-module/action', {
  preHandler: requirePermission({ 
    resource: 'new_module',  // 新资源名，全局唯一
    action: 'write'          // 操作类型：read/write/delete/execute 或自定义
  })
}, handler);
```

需要确定的事项：

| 要素 | 说明 | 示例 |
|------|------|------|
| **资源名** | 全局唯一标识，与现有 72 个资源不冲突 | `new_module` |
| **操作类型** | `read` / `write` / `delete` / `execute` / 自定义（如 `approve`、`restore`） | `write`、`delete` |
| **风险等级** | 1(低) ~ 4(极高)，决定是否需要审批 | `write=2`，`delete=4` |

#### 2.9.3 第 2 步：映射到 Capability 能力域

**2.9.3.1 在能力树中注册**

```typescript
// src/services/authz/CapabilityRegistry.ts

export const CAPABILITY_TREE: CapabilityDefinition[] = [
  // ... 已有 21 个能力域
  {
    id: 'new_module_operations',
    name: '新模块操作',
    menuCategory: '基础设施',     // 归属菜单分类（7 个之一）
    riskLevel: 3,
    children: [
      { id: 'new_module_operations.read', riskLevel: 1 },
      { id: 'new_module_operations.write', riskLevel: 2 },
      { id: 'new_module_operations.write_prod', riskLevel: 4, requiresApproval: true },
      { id: 'new_module_operations.delete', riskLevel: 4, requiresApproval: true },
    ],
  },
];
```

**2.9.3.2 在能力映射表中插入数据**

```sql
-- 在 chatops_capabilities 表中添加映射
INSERT INTO chatops_capabilities (command_id, capability_id, environment, risk_level, requires_approval) VALUES
('new_module_action', 'new_module_operations.write', 'dev', 2, false),
('new_module_action_prod', 'new_module_operations.write_prod', 'prod', 4, true),
('new_module_delete', 'new_module_operations.delete', NULL, 4, true);
```

#### 2.9.4 第 3 步：配置审批流程

**方式 A：通过低代码配置页面（推荐，无需改代码）**

在 `/console/settings/approval-config` 页面新建流程，或使用导入功能：

```json
{
  "id": "new-module-prod-approval",
  "module": "new_module",
  "name": "新模块生产操作审批",
  "enabled": true,
  "trigger": {
    "type": "capability",
    "capabilityId": "new_module_operations.write_prod",
    "environment": "prod"
  },
  "ticketTemplate": {
    "title": "新模块操作申请: {{operation}} → {{environment}}",
    "category": "permission_request",
    "priority": "high",
    "customFields": [
      { "name": "operation", "type": "text", "required": true },
      { "name": "reason", "type": "textarea", "required": true }
    ]
  },
  "nodes": [
    {
      "id": "node-1",
      "name": "管理员审批",
      "approverType": "role",
      "approverValue": "admin",
      "timeoutMinutes": 30,
      "timeoutAction": "remind"
    }
  ]
}
```

**方式 B：通过数据库直接插入（初始化时）**

```sql
INSERT INTO chatops_approval_flow_configs (tenant_id, flow_id, module, name, enabled, config) VALUES
('tenant-default', 'new-module-prod-approval', 'new_module', '新模块生产操作审批', true, '{...JSON配置...}');
```

#### 2.9.5 第 4 步：在服务方法中调用检查

```typescript
// src/services/new-module/NewModuleService.ts

import { ApprovalFlowEngine } from '../approval/ApprovalFlowEngine';
import { CapabilityEngine } from '../authz/CapabilityEngine';

export class NewModuleService {
  private approvalEngine: ApprovalFlowEngine;
  private capabilityEngine: CapabilityEngine;

  async executeOperation(params: {
    operation: string;
    environment: string;
    userId: string;
    data: Record<string, any>;
  }): Promise<OperationResult> {
    // 1. 构建 capabilityId
    const capabilityId = `new_module_operations.${params.operation}`;

    // 2. 检查 Capability 权限
    const permResult = await this.capabilityEngine.check({
      userId: params.userId,
      capability: capabilityId,
      context: { environment: params.environment },
    });

    if (!permResult.allowed) {
      // 2.1 判断是否需要审批
      const approvalRequired = await this.approvalEngine.checkApproval({
        moduleId: 'new_module',
        capabilityId,
        environment: params.environment,
      });

      if (approvalRequired) {
        // 2.2 创建审批工单
        const ticket = await this.approvalEngine.startFlow({
          moduleId: 'new_module',
          context: {
            userId: params.userId,
            capabilityId,
            environment: params.environment,
            operation: params.operation,
            reason: params.data.reason,
          },
        });

        return { 
          status: 'approval_pending', 
          ticketId: ticket.id,
          message: '需要审批后才能执行' 
        };
      }

      return { status: 'denied', message: permResult.reason };
    }

    // 3. 有权限，执行实际操作
    return this.doActualOperation(params);
  }
}
```

#### 2.9.6 接入时序图

```
用户                    前端                    新系统服务                ApprovalEngine           工单模块
 │                       │                         │                         │                       │
 │  发起操作请求          │                         │                         │                       │
 ├──────────────────────>│                         │                         │                       │
 │                       │  POST /new-module/action│                         │                       │
 │                       ├────────────────────────>│                         │                       │
 │                       │                         │  check(userId, cap)     │                       │
 │                       │                         ├────────────────────────>│                       │
 │                       │                         │                         │ 查询 Capability       │
 │                       │                         │                         │<──────────┐           │
 │                       │                         │                         │          │           │
 │                       │                         │  denied + needsApproval │                       │
 │                       │                         │<────────────────────────│                       │
 │                       │                         │                         │                       │
 │                       │                         │  startFlow(context)     │                       │
 │                       │                         ├────────────────────────>│                       │
 │                       │                         │                         │ createTicket          │
 │                       │                         │                         ├──────────────────────>│
 │                       │                         │                         │                       │
 │                       │                         │  ticketId               │                       │
 │                       │                         │<────────────────────────│                       │
 │                       │  {status:'approval_pending', ticketId: 'xxx'}     │                       │
 │                       │<────────────────────────│                         │                       │
 │  返回审批中状态        │                         │                         │                       │
 │<──────────────────────│                         │                         │                       │
 │                       │                         │                         │                       │
 │  审批人审批工单 ─────────────────────────────────────────────────────────────────────────────────>│
 │                       │                         │                         │                       │
 │  审批通过 → 授临时权限 → 用户重新发起操作 → 执行成功                                              │
```

#### 2.9.7 接入检查清单

| 序号 | 检查项 | 说明 | 完成标志 |
|------|--------|------|---------|
| 1 | **RBAC 资源声明** | 在路由中使用 `requirePermission({ resource, action })` | 代码合并 |
| 2 | **资源名注册** | 在权限资源清单中新增 `resource: 'xxx'` | 文档更新 |
| 3 | **Capability 注册** | 在 CapabilityTree 中定义能力域与子能力 | 代码合并 |
| 4 | **能力映射配置** | `chatops_capabilities` 表中插入映射数据 | 迁移脚本 |
| 5 | **审批流程配置** | 通过低代码页面或 SQL 插入审批配置 | 配置可用 |
| 6 | **服务方法接入** | 在关键操作方法中调用 `checkApproval` + `startFlow` | 代码合并 |
| 7 | **前端权限控制** | 使用 `ChatOpsPermissionGuard` 包裹敏感操作按钮 | 前端完成 |
| 8 | **审计日志** | 关键操作写入 `chatops_audit_logs` | 日志可查 |

#### 2.9.8 与现有 10 个独立模块的关系

有 **10 个模块不纳入 Capability 体系**（auth、sso、session、tenant、role、api-key、abac-policy、permission-audit、module、eventbus），这些模块保持纯 RBAC 控制。

新系统如果属于这些基础设施类别，则**只需要第 1 步**（RBAC 声明），无需后续 Capability 映射和审批配置。

#### 2.9.9 接入一句话总结

> **新系统接入 = RBAC 声明（必做）+ Capability 映射（高风险操作必做）+ 审批配置（风险等级 4 必做）+ 服务方法调用检查（高风险操作必做）**，全部通过配置化完成，无需修改审批引擎本身代码。

---

## 3. 前端设计方案

### 3.1 页面结构

```
ChatOps 设置页 (/console/chatops/settings)
├── Tab 1: 问答卡片 (现有)
├── Tab 2: 命令配置 (现有)
├── Tab 3: 平台配置 (现有)
├── Tab 4: 通知与免打扰 (现有)
├── Tab 5: 权限管理 [NEW]
│   ├── 角色管理子Tab
│   ├── 命令权限子Tab
│   └── 环境权限子Tab
├── Tab 6: 版本管理 [NEW]
│   ├── 版本列表
│   ├── 变更历史
│   └── 回滚操作
├── Tab 7: 限流配置 [NEW]
├── Tab 8: 审计日志 [NEW]
├── Tab 9: 租户管理 [NEW]
└── Tab 10: Webhook 管理 [NEW]
```

### 3.2 权限管理 Tab 设计

```
┌─────────────────────────────────────────────────────────────┐
│ 权限管理                                                      │
├─────────────────────────────────────────────────────────────┤
│ [角色管理] [命令权限] [环境权限]                               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ 角色列表:                                                    │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 角色名    │ 描述        │ 命令数 │ 操作      │           │
│ ├───────────┼─────────────┼────────┼───────────┤           │
│ │ 运维管理员 │ 全部权限    │ 50     │ [编辑][删除]│          │
│ │ 开发者    │ 开发环境权限 │ 30     │ [编辑][删除]│          │
│ │ 只读用户  │ 仅查看      │ 0      │ [编辑][删除]│          │
│ └─────────────────────────────────────────────────────────┘ │
│ [+ 新建角色]                                                 │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 3.3 版本管理 Tab 设计

```
┌─────────────────────────────────────────────────────────────┐
│ 版本管理                                                      │
├─────────────────────────────────────────────────────────────┤
│ 选择命令: [deploy ▼]                          [+ 新建版本]   │
├─────────────────────────────────────────────────────────────┤
│ 版本历史:                                                    │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ v3 (当前) │ 2026-05-19 14:30 │ by admin │ [查看][回滚]  │ │
│ │ v2       │ 2026-05-15 10:20 │ by dev   │ [查看][回滚]  │ │
│ │ v1       │ 2026-05-01 09:00 │ by admin │ [查看][回滚]  │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ v3 详情:                                                    │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ command: /deploy env=prod version=v1.2.3                │ │
│ │ 参数: {"env": "prod", "version": "v1.2.3"}              │ │
│ │ 变更说明: 添加 version 参数支持                          │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ [与上一版本对比]                                             │
└─────────────────────────────────────────────────────────────┘
```

### 3.4 限流配置 Tab 设计

```
┌─────────────────────────────────────────────────────────────┐
│ 限流配置                                                      │
├─────────────────────────────────────────────────────────────┤
│ [+ 添加限流规则]                                              │
│                                                             │
│ 限流规则列表:                                                │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 目标类型 │ 目标     │ 命令     │ 限制      │ 窗口    │状态│ │
│ ├──────────┼──────────┼──────────┼───────────┼─────────┼────┤ │
│ │ 用户     │ @zhang   │ deploy   │ 10次/分钟  │ 60s    │ ✅ │ │
│ │ 群组     │ #devops  │ *        │ 50次/分钟  │ 60s    │ ✅ │ │
│ │ 命令     │ restart  │ restart  │ 5次/小时   │ 3600s  │ ✅ │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ 添加/编辑 限流规则:                                          │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 目标类型: [用户 ▼]  目标: [输入用户ID]                   │ │
│ │ 命令 (可选): [选择命令 ▼]                                │ │
│ │ 限制: [10] 次 / [分钟 ▼]                                 │ │
│ │ 描述: [说明...]                                          │ │
│ │ [保存] [取消]                                            │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 3.5 审计日志 Tab 设计

```
┌─────────────────────────────────────────────────────────────┐
│ 审计日志                                                      │
├─────────────────────────────────────────────────────────────┤
│ [执行日志] [配置变更] [登录日志]                               │
│                                                             │
│ 筛选: [时间范围] [用户] [操作类型] [状态]      [导出] [搜索]  │
│                                                             │
│ 日志列表:                                                   │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 时间         │ 用户   │ 操作类型     │ 资源   │ 状态    │ │
│ ├──────────────┼────────┼──────────────┼────────┼─────────┤ │
│ │ 14:30:25     │ admin  │ command.exec │ deploy │ 成功    │ │
│ │ 14:29:10     │ dev    │ config.change│ webhook│ 成功    │ │
│ │ 14:25:00     │ guest  │ login        │ -      │ 失败    │ │
│ │ 14:20:15     │ admin  │ permission   │ deploy │ 成功    │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ 详情 (点击行展开):                                           │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ IP: 10.0.0.1                                            │ │
│ │ User-Agent: Mozilla/5.0...                              │ │
│ │ 详情: {"command": "/deploy", "env": "prod"}            │ │
│ │ 错误: (无)                                               │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ [导出 PDF] [导出 Excel]                    显示 1-20 / 100  │
└─────────────────────────────────────────────────────────────┘
```

### 3.6 Webhook 管理 Tab 设计

```
┌─────────────────────────────────────────────────────────────┐
│ Webhook 管理                                                 │
├─────────────────────────────────────────────────────────────┤
│ [+ 添加 Webhook]                                             │
│                                                             │
│ Webhook 列表:                                               │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 名称      │ URL                  │ 事件            │状态│ │
│ ├───────────┼──────────────────────┼─────────────────┼────┤ │
│ │ CI通知    │ https://ci.../webhook│ exec,result,err │ ✅ │ │
│ │ 监控告警  │ https://mon.../alert │ error           │ ✅ │ │
│ │ 审计上报  │ https://audit...     │ config,perm     │ ❌ │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ 添加/编辑 Webhook:                                          │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 名称: [Webhook名称]                                      │ │
│ │ URL: [https://...]                                      │ │
│ │ 事件: [✓] command.execute  [✓] command.result          │ │
│ │        [ ] error  [ ] config.change  [ ] permission     │ │
│ │ Secret Key: [生成] [输入密钥]                             │ │
│ │ 自定义 Headers: Key: [Value:]                           │ │
│ │ 重试配置: 最大重试 [3] 次, 间隔 [1000] ms               │ │
│ │ [保存] [测试连接]                                         │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 3.7 租户管理 Tab 设计

```
┌─────────────────────────────────────────────────────────────┐
│ 租户管理                                                      │
├─────────────────────────────────────────────────────────────┤
│ 租户列表:                                                    │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 租户名    │ ID         │ 用户数 │ 命令数 │ 状态  │ 操作  │ │
│ ├───────────┼────────────┼────────┼────────┼────────┼──────┤ │
│ │ default   │ tenant_001 │ 50     │ 30     │ 活跃  │ [编辑]│ │
│ │ acme Corp │ tenant_002 │ 20     │ 15     │ 活跃  │ [编辑]│ │
│ │ old-corp  │ tenant_003 │ 5      │ 10     │ 冻结  │ [编辑]│ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ 租户详情/编辑:                                               │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 租户名称: [acme Corp]                                    │ │
│ │ 租户 ID: [tenant_002] (只读)                             │ │
│ │ 数据隔离级别: [✓] 配置隔离 [✓] 数据隔离                   │ │
│ │ 配额: CPU限制 [1000] 存储限制 [10GB]                     │ │
│ │ 状态: [活跃 ▼]                                           │ │
│ │ [保存]                                                   │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## 4. 后端 API 设计

### 4.1 权限管理 API

```
# 角色管理
GET    /api/v1/chatops/admin/roles           # 获取角色列表
POST   /api/v1/chatops/admin/roles           # 创建角色
GET    /api/v1/chatops/admin/roles/:id       # 获取角色详情
PUT    /api/v1/chatops/admin/roles/:id       # 更新角色
DELETE /api/v1/chatops/admin/roles/:id       # 删除角色

# 命令权限
GET    /api/v1/chatops/admin/permissions     # 获取命令权限列表
POST   /api/v1/chatops/admin/permissions     # 创建权限规则
PUT    /api/v1/chatops/admin/permissions/:id # 更新权限规则
DELETE /api/v1/chatops/admin/permissions/:id # 删除权限规则

# 环境权限
GET    /api/v1/chatops/admin/env-permissions           # 获取环境权限
PUT    /api/v1/chatops/admin/env-permissions/:env      # 更新环境权限

# Capability 映射（ChatOps 命令 → 全局 Capability）
GET    /api/v1/chatops/admin/capability-mappings       # 获取所有命令-Capability 映射
POST   /api/v1/chatops/admin/capability-mappings       # 创建映射
PUT    /api/v1/chatops/admin/capability-mappings/:id   # 更新映射
DELETE /api/v1/chatops/admin/capability-mappings/:id   # 删除映射

# 权限检查（执行命令前调用）
POST   /api/v1/chatops/admin/check-permission          # 检查用户是否有权执行某命令
GET    /api/v1/chatops/admin/allowed-commands          # 获取用户可执行的命令列表
```

### 4.2 版本管理 API

```
GET    /api/v1/chatops/admin/commands/:cmdId/versions     # 获取命令版本列表
POST   /api/v1/chatops/admin/commands/:cmdId/versions     # 创建新版本
GET    /api/v1/chatops/admin/versions/:id                 # 获取版本详情
POST   /api/v1/chatops/admin/versions/:id/rollback        # 回滚到指定版本
GET    /api/v1/chatops/admin/versions/:id/diff            # 与上一版本对比
```

### 4.3 限流配置 API

```
GET    /api/v1/chatops/admin/rate-limits         # 获取限流规则列表
POST   /api/v1/chatops/admin/rate-limits         # 创建限流规则
GET    /api/v1/chatops/admin/rate-limits/:id     # 获取限流规则详情
PUT    /api/v1/chatops/admin/rate-limits/:id     # 更新限流规则
DELETE /api/v1/chatops/admin/rate-limits/:id     # 删除限流规则
POST   /api/v1/chatops/admin/rate-limits/:id/toggle # 启用/禁用
```

### 4.4 审计日志 API

```
GET    /api/v1/chatops/admin/audit-logs          # 获取审计日志列表
GET    /api/v1/chatops/admin/audit-logs/:id      # 获取日志详情
GET    /api/v1/chatops/admin/audit-logs/export   # 导出日志 (PDF/Excel)
GET    /api/v1/chatops/admin/audit-logs/stats    # 统计报表
```

### 4.5 租户管理 API

```
GET    /api/v1/chatops/admin/tenants              # 获取租户列表
POST   /api/v1/chatops/admin/tenants              # 创建租户
GET    /api/v1/chatops/admin/tenants/:id          # 获取租户详情
PUT    /api/v1/chatops/admin/tenants/:id          # 更新租户
DELETE /api/v1/chatops/admin/tenants/:id          # 删除租户
POST   /api/v1/chatops/admin/tenants/:id/freeze   # 冻结租户
POST   /api/v1/chatops/admin/tenants/:id/unfreeze # 解冻租户
```

### 4.6 Webhook 管理 API

```
GET    /api/v1/chatops/admin/webhooks             # 获取 Webhook 列表
POST   /api/v1/chatops/admin/webhooks             # 创建 Webhook
GET    /api/v1/chatops/admin/webhooks/:id         # 获取 Webhook 详情
PUT    /api/v1/chatops/admin/webhooks/:id         # 更新 Webhook
DELETE /api/v1/chatops/admin/webhooks/:id         # 删除 Webhook
POST   /api/v1/chatops/admin/webhooks/:id/test    # 测试 Webhook
GET    /api/v1/chatops/admin/webhooks/:id/deliveries # 获取投递记录
```

## 5. 安全设计

### 5.1 权限控制

| 操作 | 所需角色 |
|------|----------|
| 查看审计日志 | admin, auditor |
| 导出报表 | admin, auditor |
| 管理角色权限 | super_admin |
| 管理租户 | super_admin |
| 修改限流规则 | admin |
| 管理 Webhook | admin |

### 5.2 审计要点

- 所有管理操作必须记录审计日志
- 敏感配置变更（如权限、租户）需记录变更前后值
- 导出操作需记录导出人、导出内容

### 5.3 数据隔离

- 租户间数据完全隔离
- 租户管理员只能查看所属租户数据
- 跨租户操作需 super_admin 权限

## 6. 前端视觉与交互设计

> 本节补充 ChatOps 配置后台的前端视觉规范与交互效果，确保与 Orion 系统整体设计语言一致。
> 所有设计基于现有 Design Token 体系（`src/tokens/`）和 Ant Design v5 主题配置。

### 6.1 设计原则

| 原则 | 说明 |
|------|------|
| **Apple/飞书风格** | 圆润圆角（8px/12px）、轻微阴影、充足留白 |
| **非线框风格** | `wireframe: false`，使用组件的立体感和层次 |
| **组件高度 36px** | 区别于传统 32px，增加触控友好度 |
| **间距遵循 4px 网格** | 所有间距基于 `spacing` tokens（4/8/12/16/24px） |
| **语义化色彩** | 功能状态使用 `colors` 中定义的语义色 |

### 6.2 色彩映射表

#### 6.2.1 功能状态色

| 状态 | 色彩值 | Token 引用 | 使用场景 |
|------|--------|-----------|---------|
| 成功 | `#52c41a` | `colors.success[500]` | 执行成功、权限通过 |
| 警告 | `#faad14` | `colors.warning[500]` | 限流触发、审批待处理 |
| 错误 | `#f5222d` | `colors.error[500]` | 执行失败、权限拒绝 |
| 信息 | `#3a98f4` | `colors.info[500]` | 操作提示、帮助说明 |
| 主操作 | `#3370E6` | `colors.primary[500]` | 主要按钮、链接 |
| 次要操作 | `#8c8c8c` | `colors.neutral[500]` | 次要按钮、禁用态 |

#### 6.2.2 权限状态色（新增）

| 状态 | 色彩值 | 使用场景 |
|------|--------|---------|
| 已授权 | `#52c41a` | Capability 检查通过 |
| 部分授权 | `#faad14` | 临时权限、需审批 |
| 未授权 | `#f5222d` | 能力不足、禁止操作 |
| 审批中 | `#7C5CFC` | 工单已提交待审批（紫色） |

### 6.3 布局与间距规范

#### 6.3.1 页面布局

```
ChatOps Settings 页面布局:
┌─────────────────────────────────────────────────────┐
│ 设置标题 (fontSize: 16px, fontWeight: 600)          │ ← padding: 0 0 16px
│ 副标题 (fontSize: 12px, color: textSecondary)        │
├─────────────────────────────────────────────────────┤
│ Tabs (tabBar padding: 0 16px)                        │
│ ┌─────────┬─────────┬─────────┬───────┬─────────┐   │
│ │问答卡片 │命令配置 │平台配置 │通知DND│权限管理 │...│  ← 新增 Tab
│ └─────────┴─────────┴─────────┴───────┴─────────┘   │
│                                                      │
│ Tab Content Area (padding: 16px)                     │
│ ┌──────────────────────────────────────────────────┐ │
│ │ 内容区域 (max-width: 700px for forms)            │ │
│ │                                                  │ │
│ │ Card gap: 16px (spacing.md)                      │ │
│ │ Form item gap: 12px (componentSpacing.formItemGap.sm) │
│ └──────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

#### 6.3.2 组件间距

| 场景 | 间距值 | Token |
|------|--------|-------|
| Card 之间 | `16px` | `spacing.md` |
| Form.Item 垂直间距 | `12px` | `componentSpacing.formItemGap.sm` |
| Space 内元素 | `8px` | `spacing.sm` |
| 按钮组间距 | `8px` | `spacing.sm` |
| Section 标题与内容 | `16px` | `spacing.md` |
| 表格操作列内按钮 | `8px` | `spacing.sm` |

### 6.4 组件规格

#### 6.4.1 卡片 (Card)

| 属性 | 值 | 说明 |
|------|-----|------|
| 圆角 | `12px` | `componentRadius.card`，Apple 风格 |
| 阴影 | `0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)` | `shadows.card` |
| 内边距 | `24px` | `componentSpacing.cardPadding.lg` |
| 边框 | `none` | 通过阴影而非边框区分层次 |
| 左侧装饰线 | `3px solid` | 状态标识（`#3370E6` 正常 / `#d9d9d9` 禁用） |

```tsx
// 示例：带状态标识的卡片
<Card
  size="small"
  style={{
    borderRadius: 12,
    boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
    borderLeft: enabled ? '3px solid #3370E6' : '3px solid #d9d9d9',
    opacity: enabled ? 1 : 0.5,
  }}
/>
```

#### 6.4.2 表格 (Table)

| 属性 | 值 |
|------|-----|
| 圆角 | `8px` |
| 行高 | `48px`（标准行）/ `36px`（紧凑模式） |
| 表头背景 | `#F5F5F7` (`colors.light.bg.secondary`) |
| 斑马纹 | `#fafafa` (`colors.neutral[50]`) |
| 悬停行 | `#EBF0FB` (`colors.primary[50]`) |
| 分页器位置 | 右下对齐 |
| 操作列宽度 | `200px`（容纳 3 个操作按钮） |

#### 6.4.3 表单 (Form)

| 属性 | 值 |
|------|-----|
| 表单最大宽度 | `700px` |
| Label 宽度 | `120px`（固定） |
| Input 圆角 | `6px` (`componentRadius.input`) |
| Input 高度 | `36px` (`componentSize`) |
| 错误提示色 | `#f5222d` (`colors.error[500]`) |
| 必填标识 | `*` 红色，位于 label 左侧 |

#### 6.4.4 标签 (Tag)

| 类型 | 背景色 | 文字色 |
|------|--------|--------|
| 风险等级 1 | `#f6ffed` | `#52c41a` |
| 风险等级 2 | `#e8f4fd` | `#3a98f4` |
| 风险等级 3 | `#fff7e6` | `#faad14` |
| 风险等级 4 | `#fff1f0` | `#f5222d` |
| 临时权限 | `#f9f0ff` | `#7C5CFC` |
| 已过期 | `#fafafa` | `#8c8c8c` |

#### 6.4.5 开关 (Switch)

| 状态 | 颜色 |
|------|------|
| 开启 | `#3370E6` (`colors.primary[500]`) |
| 关闭 | `#d9d9d9` (`colors.neutral[300]`) |
| 加载 | 显示 loading spinner |

### 6.5 交互状态设计

#### 6.5.1 按钮状态

| 状态 | 背景色 | 文字色 | 边框 | 光标 |
|------|--------|--------|------|------|
| 默认 (Primary) | `#3370E6` | `#fff` | none | pointer |
| 悬停 (Primary) | `#2B5DD6` | `#fff` | none | pointer |
| 按下 (Primary) | `#1F4BB5` | `#fff` | none | pointer |
| 禁用 | `#d9d9d9` | `#8c8c8c` | none | not-allowed |
| 加载中 | `#3370E6` (80% opacity) | `rgba(255,255,255,0.6)` | none | not-allowed |

#### 6.5.2 输入框状态

| 状态 | 边框色 | 阴影 |
|------|--------|------|
| 默认 | `#d9d9d9` | none |
| 聚焦 | `#3370E6` | `0 0 0 2px rgba(51,112,230,0.1)` |
| 错误 | `#f5222d` | `0 0 0 2px rgba(245,34,45,0.1)` |
| 禁用 | `#f0f0f0` 背景 | none |

#### 6.5.3 加载状态

| 场景 | 加载方式 | 动画时长 |
|------|---------|---------|
| 页面首次加载 | `Spin` 全局居中，显示进度文字 | `300ms` (`motionDurationMid`) |
| Tab 切换 | 骨架屏 + 淡入动画 | `200ms` (`motionDurationFast`) |
| 表格分页 | 行内 Loading 指示器 | `300ms` |
| 按钮操作 | `loading` 属性 + 禁用 | `200ms` |
| 数据刷新 | 顶部进度条 (Progress) | `400ms` (`motionDurationSlow`) |

#### 6.5.4 空状态

| 场景 | 展示内容 |
|------|---------|
| 无数据表格 | `Empty` 组件，自定义图片 + "暂无数据" + 操作按钮 |
| 无审批记录 | 引导文字："尚未有审批记录，当提交高风险操作后此处将显示待办事项" |
| 无审计日志 | "暂无操作记录" |
| 搜索无结果 | `Empty` + "未找到匹配结果，请尝试其他关键词" |

### 6.6 权限感知 UI 模式

#### 6.6.1 PermissionGuard 组件行为

```tsx
// ChatOpsPermissionGuard 使用模式
<ChatOpsPermissionGuard
  capability="chatops_advanced.command.kubectl.delete"
  fallback="disabled"  // "disabled" | "hidden" | "message"
>
  <Button danger>删除 Pod</Button>
</ChatOpsPermissionGuard>
```

| 行为 | 效果 |
|------|------|
| `disabled` | 按钮可点击但显示禁用态，tooltip 说明原因 |
| `hidden` | 元素完全隐藏，不占位 |
| `message` | 显示 Alert 提示缺少权限，附带申请按钮 |

#### 6.6.2 权限状态展示

| 位置 | 展示形式 |
|------|---------|
| 权限列表表格 | Tag 颜色标识（已授权/部分授权/未授权/审批中） |
| 命令浏览器 | 命令卡片右上角权限徽章（小 Tag） |
| 执行按钮 | 无权限时禁用 + tooltip 提示 |
| 设置页面 Tab | 无权限的 Tab 仍显示但内容为 PermissionGuard 提示 |

### 6.7 响应式行为

| 屏幕宽度 | 行为 |
|----------|------|
| `>= 1200px` (xl) | 完整布局，表格显示所有列 |
| `>= 768px` (md) | 隐藏次要列（描述、更新时间），表单宽度不变 |
| `< 768px` (sm) | Tab 切换为下拉菜单，表格改为卡片列表视图 |

### 6.8 表单校验展示

| 校验类型 | 展示效果 |
|----------|---------|
| 必填字段为空 | 红色边框 + 下方红色错误文字，触发于 `onBlur` |
| 格式错误（URL/数字） | 同上，触发于 `onChange` |
| 重复值检测 | 异步校验，loading 指示器 + 错误文字 |
| 批量校验 | 提交时统一展示 Modal 错误列表 |

### 6.9 动画规范

| 动画 | 时长 | 缓动函数 | 场景 |
|------|------|---------|------|
| 淡入 | `200ms` | `easeOut` | 模态框出现、Tooltip 显示 |
| 滑入 | `300ms` | `easeInOut` | Tab 内容切换 |
| 展开/折叠 | `300ms` | `easeInOut` | Collapse 面板展开 |
| 状态变化 | `200ms` | `easeOut` | Switch 开关切换 |
| 加载旋转 | 线性无限 | - | Loading spinner |

### 6.10 现有 Tab 与新增 Tab 视觉一致性

现有 Tab（问答卡片、命令配置、平台配置、通知DND）已使用的设计模式：

| 模式 | 现状 | 新增 Tab 是否复用 |
|------|------|------------------|
| Card 内嵌表单 + Switch 控制 | 是 | 是 |
| 顶部操作栏（保存/添加/重置） | 是 | 是 |
| 左侧 3px 装饰线标识启停状态 | 是 | 是 |
| `max-width: 700px` 表单居中 | 是 | 是 |
| `size="small"` 紧凑卡片 | 是 | 是 |

新增 Tab（权限管理、版本管理、限流配置、审计日志、租户隔离、Webhook管理）将遵循以上模式，在此基础上增加：

| 新增模式 | 说明 |
|----------|------|
| Table + 操作列 | 列表型数据使用 Ant Design Table，操作列固定右侧 |
| 风险等级 Tag | 命令/操作旁显示 `Tag color={level}` 标识风险等级 |
| 时间线展示 | 版本历史/审批流程使用 `Timeline` 组件 |
| 统计卡片 | 审计日志首页顶部显示 `Statistic` 统计摘要 |

## 7. 技术实现清单

### 7.1 数据库变更

| 文件 | 说明 |
|------|------|
| `db/migrations/0XX_chatops_admin.sql` | 新建 7 张表 + 索引 |
| `db/migrations/0XX_chatops_capabilities.sql` | 能力映射表 + 预置数据 |
| `db/migrations/0XX_chatops_approval_flow.sql` | 审批流程配置表 + 实例表 + module 扩展 |
| `db/migrations/0XX_chatops_temporary_permissions.sql` | 临时权限记录表 |
| `db/migrations/0XX_ticket_category_extension.sql` | 工单类型扩展（permission_request + chatops 来源） |

### 7.2 后端变更

| 文件 | 说明 |
|------|------|
| `src/api/chatops-admin-routes.ts` | 新建管理 API 路由 |
| `src/services/chatops/PermissionService.ts` | 权限服务 |
| `src/services/chatops/ChatOpsPermissionService.ts` | ChatOps 能力检查服务（调用 CapabilityEngine） |
| `src/services/chatops/PermissionRequestService.ts` | 权限申请服务 |
| `src/services/chatops/CommandVersionService.ts` | 版本服务 |
| `src/services/chatops/RateLimitService.ts` | 限流服务 |
| `src/services/chatops/AuditService.ts` | 审计服务 |
| `src/services/chatops/TenantService.ts` | 租户服务 |
| `src/services/chatops/WebhookService.ts` | Webhook 服务 |
| `src/services/chatops/ApprovalConfigService.ts` | 审批流程配置服务 |
| `src/services/approval/ApprovalFlowEngine.ts` | 系统级通用审批流程引擎（所有模块复用） |
| `src/services/authz/CapabilityEngine.ts` | 全局能力检查引擎（新增 Capability 检查层） |
| `src/services/authz/CapabilityRegistry.ts` | 能力树注册中心（含新系统接入注册表） |
| `src/services/ticketing/types.ts` | 扩展 `permission_request` 类型和 `chatops` 来源 |
| `src/components/ChatOps/ChatOpsPermissionGuard.tsx` | 前端权限守卫组件 |
| `src/repositories/ChatOpsAdminRepository.ts` | 管理数据访问 |
| `src/repositories/ChatOpsCapabilityRepository.ts` | 能力映射数据访问 |

### 7.3 前端变更

| 文件 | 说明 |
|------|------|
| `src/pages/ChatOps/ChatOpsSettings.tsx` | 扩展 Tab 数量 |
| `src/pages/ChatOps/PermissionAdmin.tsx` | 权限管理组件 |
| `src/pages/ChatOps/VersionAdmin.tsx` | 版本管理组件 |
| `src/pages/ChatOps/RateLimitAdmin.tsx` | 限流配置组件 |
| `src/pages/ChatOps/AuditLogAdmin.tsx` | 审计日志组件 |
| `src/pages/ChatOps/TenantAdmin.tsx` | 租户管理组件 |
| `src/pages/ChatOps/WebhookAdmin.tsx` | Webhook 管理组件 |
| `src/pages/Settings/CapabilityPermissionConfig.tsx` | 独立能力权限配置入口 |
| `src/api/chatops-admin.ts` | 新增管理 API 客户端 |

## 8. 实施优先级

| 优先级 | 模块 | 工作量 | 说明 |
|--------|------|--------|------|
| P0 | 权限管理（含 Capability 映射） | 4 人日 | 核心功能，需接入全局 Capability 系统 |
| P0 | 审计日志 | 3 人日 | 合规必需 |
| P1 | 版本管理 | 2 人日 | 重要运维能力 |
| P1 | 限流配置 | 2 人日 | 系统稳定性 |
| P2 | Webhook | 2 人日 | 扩展集成 |
| P2 | 租户管理 | 2 人日 | 多租户场景 |

**预计总工作量**: 15 人日（+1 人日用于 Capability 集成）

## 9. 验收标准

### 9.1 功能验收

- [ ] 管理员可以创建、编辑、删除角色
- [ ] 管理员可以为角色/用户分配命令执行权限
- [ ] 管理员可以配置不同环境的命令权限
- [ ] 管理员可以配置命令-Capability 映射
- [ ] 命令执行前会检查 Capability 权限（继承链验证）
- [ ] prod 环境命令需要更高风险等级 Capability
- [ ] 风险等级 4 的命令执行前会提示需要审批
- [ ] 命令版本可以查看历史并一键回滚
- [ ] 限流规则可以按用户/群组/命令配置
- [ ] 审计日志可以按时间、用户、操作类型筛选
- [ ] 审计日志可以导出 PDF/Excel
- [ ] 多租户数据完全隔离
- [ ] Webhook 可以配置事件订阅和重试策略

### 9.2 非功能验收

- [ ] 页面加载时间 < 2s
- [ ] API 响应时间 < 500ms
- [ ] 审计日志写入不影响主业务性能
- [ ] 限流检查在 10ms 内完成
- [ ] Capability 权限检查在 20ms 内完成

### 9.3 视觉验收

- [ ] 所有组件圆角符合 `8px/12px` 规范（Card `12px`，Button `6px`，Input `6px`）
- [ ] 功能状态色与设计 Token 一致（成功 `#52c41a`、警告 `#faad14`、错误 `#f5222d`、主操作 `#3370E6`）
- [ ] 权限状态 Tag 颜色正确（已授权绿、未授权红、审批中紫、临时权限淡紫）
- [ ] 表单输入框聚焦时显示蓝色边框 + 外发光（`0 0 0 2px rgba(51,112,230,0.1)`）
- [ ] 卡片悬停行背景色为 `#EBF0FB`（`colors.primary[50]`）
- [ ] 动画时长符合规范（淡入 `200ms`、切换 `300ms`）
- [ ] 空状态使用 Ant Design `Empty` 组件，文字提示友好
- [ ] 新增 Tab 与现有 Tab（问答卡片、命令配置）视觉风格一致
- [ ] 深色模式下色彩与阴影正确切换（`darkTheme` 配置生效）

---

**设计完成，等待评审。**