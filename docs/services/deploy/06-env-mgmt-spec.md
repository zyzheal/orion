# 环境管理详细规格 (Phase 1)

> **日期**: 2026-05-05
> **状态**: 编写中
> **能力域**: 6. 环境管理
> **目标成熟度**: L2 → L2.3
> **关键交付**: 休眠回收、TTL 管理

## 一、功能描述

### 1.1 现状评估 (L2)

Orion 当前已实现：
- EphemeralEnvService（临时环境创建/列表/唤醒/销毁 + K8s Provisioner + PostgreSQL Repository）
- Ephemeral Environment 表（migration 066：PR-based 临时环境、auto-destroy、cost tracking）
- Environments 表（migration 008：静态环境 dev/staging/prod）
- EphemeralEnvList + EphemeralEnvDetail 前端页面（状态筛选、唤醒/销毁操作、成本计算）
- 环境模板基础支持（create input 含 templateId 字段）
- 环境成本计算（CPU/Memory/Storage 费率）

**不足**：
- 休眠回收仅针对临时环境（静态环境无休眠能力）
- TTL 管理仅针对临时环境（auto-destroy 固定 24h，不可配置）
- 无环境模板管理（templateId 无对应模板表）
- 无环境数据注入/种子数据能力
- 无环境状态面板（缺少资源占用/健康状态聚合视图）
- 环境创建仍为手动流程（无自助申请审批流）

### 1.2 Phase 1 目标 (L2.3)

| 功能模块 | 描述 | 验收等级 |
|----------|------|:--------:|
| 休眠回收 | 静态环境休眠/唤醒、空闲检测自动休眠、回收资源 | L2.3 |
| TTL 管理 | 可配置 TTL（按环境/租户/项目）、到期预警、自动清理 | L2.3 |
| 环境模板 | 环境模板 CRUD、从模板快速创建、模板参数化 | L2.3 |
| 状态面板 | 环境资源占用视图、健康状态、成本趋势 | L2.2 |

## 二、验收标准

### 2.1 休眠回收

| # | 标准 | 验证方式 |
|---|------|----------|
| H1 | 支持手动休眠/唤醒静态环境 | API 测试 |
| H2 | 空闲检测（无访问/无部署超过阈值自动休眠） | 集成测试 |
| H3 | 休眠后释放 K8s 资源（Namespace 保留，Pods 缩容到 0） | 集成测试 |
| H4 | 唤醒后恢复环境（Pods 重新部署，数据保留） | 集成测试 |
| H5 | 休眠/唤醒操作写入审计日志 | 代码审查 |

### 2.2 TTL 管理

| # | 标准 | 验证方式 |
|---|------|----------|
| T1 | 支持按环境设置 TTL（小时/天） | API 测试 |
| T2 | 支持按租户设置默认 TTL | API 测试 |
| T3 | TTL 到期前预警（24h/1h 通知） | 集成测试 |
| T4 | TTL 到期自动清理（或休眠） | 集成测试 |
| T5 | TTL 可续期（延长 TTL） | API 测试 |
| T6 | TTL 面板（即将到期环境列表） | 前端验证 |

### 2.3 环境模板

| # | 标准 | 验证方式 |
|---|------|----------|
| M1 | 环境模板 CRUD（名称/资源配置/服务列表/环境变量） | API 测试 |
| M2 | 从模板创建环境（预填配置） | API 测试 |
| M3 | 模板参数化（可覆盖资源配置） | API 测试 |
| M4 | 预置模板：开发环境、测试环境、演示环境 | 前端验证 |

### 2.4 状态面板

| # | 标准 | 验证方式 |
|---|------|----------|
| S1 | 环境卡片视图（状态/资源/成本一目了然） | 前端验证 |
| S2 | 资源占用分布（CPU/Memory/Storage 按环境分布） | 前端验证 |
| S3 | 成本趋势（近 7/30 天环境费用趋势） | 前端验证 |
| S4 | 健康状态（各环境服务健康检查） | 前端验证 |

## 三、API 设计

### 3.1 休眠/唤醒 API

```
Base: /api/v1/environments/:envId
```

| 方法 | 路径 | 描述 | 请求体 | 响应 |
|------|------|------|--------|------|
| POST | `/hibernate` | 休眠环境 | `{ reason?: string }` | `{ id, status: 'hibernated', hibernatedAt }` |
| POST | `/wake` | 唤醒环境 | - | `{ id, status: 'running', wakingAt }` |
| GET | `/hibernation-config` | 获取休眠配置 | - | `{ idleTimeoutMinutes, autoHibernationEnabled }` |
| PUT | `/hibernation-config` | 更新休眠配置 | `{ idleTimeoutMinutes, autoHibernationEnabled }` | `{ success }` |

### 3.2 TTL 管理 API

```
Base: /api/v1/environments/:envId/ttl
```

| 方法 | 路径 | 描述 | 请求体 | 响应 |
|------|------|------|--------|------|
| GET | `/ttl` | 获取 TTL 配置 | - | `{ ttlHours, expiresAt, warnings[] }` |
| PUT | `/ttl` | 设置 TTL | `{ ttlHours, action: 'cleanup' | 'hibernate' }` | `{ expiresAt }` |
| POST | `/ttl/extend` | 续期 TTL | `{ extendHours }` | `{ newExpiresAt }` |
| GET | `/ttl/expiring` | 获取即将到期环境 | query: hours | `{ environments: [{ id, name, expiresAt, warningLevel }] }` |

### 3.3 环境模板 API

```
Base: /api/v1/environment-templates
```

| 方法 | 路径 | 描述 | 请求体 | 响应 |
|------|------|------|--------|------|
| GET | `/` | 获取模板列表 | query: category, page, limit | `{ data: EnvTemplate[], total }` |
| GET | `/:id` | 获取模板详情 | - | `{ id, name, config, parameters, presets }` |
| POST | `/` | 创建模板 | `TemplateCreateInput` | `{ id, name }` |
| PUT | `/:id` | 更新模板 | `TemplateUpdateInput` | `{ ... }` |
| DELETE | `/:id` | 删除模板 | - | `{ success }` |
| POST | `/:id/create-env` | 从模板创建环境 | `{ name, tenantId, overrides? }` | `{ environmentId, name, status }` |

**EnvTemplate 结构**:

```typescript
interface EnvTemplate {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  category: 'development' | 'testing' | 'staging' | 'demo' | 'custom';
  config: {
    cpu: string;
    memory: string;
    storage: string;
    services: { name: string; image: string; replicas: number }[];
    envVars: Record<string, string>;
  };
  ttlHours: number;                // 默认 TTL
  autoHibernation: boolean;        // 是否自动休眠
  createdBy: string;
  usageCount: number;
  createdAt: Date;
  updatedAt: Date;
}
```

### 3.4 环境状态 API

```
Base: /api/v1/environments/status
```

| 方法 | 路径 | 描述 | 请求体 | 响应 |
|------|------|------|--------|------|
| GET | `/` | 获取环境状态概览 | query: tenantId | `{ summary, byStatus, resourceUsage, costTrend }` |

**EnvironmentStatus 结构**:

```typescript
interface EnvironmentStatus {
  summary: {
    total: number;
    running: number;
    hibernated: number;
    expired: number;
  };
  byStatus: { status: string; count: number; envs: { id: string; name: string }[] }[];
  resourceUsage: {
    totalCpu: string;
    totalMemory: string;
    totalStorage: string;
    perEnvironment: { id: string; name: string; cpu: string; memory: string; storage: string }[];
  };
  costTrend: {
    date: string;
    costCents: number;
  }[];
}
```

## 四、数据库变更

### 4.1 新增表：environment_templates

```sql
CREATE TABLE IF NOT EXISTS environment_templates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name            VARCHAR(200) NOT NULL,
  description     TEXT,
  category        VARCHAR(50) NOT NULL DEFAULT 'custom',
  config          JSONB NOT NULL DEFAULT '{}',
  ttl_hours       INT DEFAULT 24,
  auto_hibernation BOOLEAN DEFAULT false,
  created_by      UUID REFERENCES users(id),
  usage_count     INT DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_env_templates_tenant ON environment_templates(tenant_id);
CREATE INDEX idx_env_templates_category ON environment_templates(category);
```

### 4.2 新增表：environment_hibernation_log

```sql
CREATE TABLE IF NOT EXISTS environment_hibernation_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  environment_id  UUID NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
  action          VARCHAR(20) NOT NULL,             -- 'hibernate', 'wake', 'auto-hibernate'
  reason          TEXT,
  actor_id        UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_env_hibernation_log_env ON environment_hibernation_log(environment_id);
CREATE INDEX idx_env_hibernation_log_action ON environment_hibernation_log(action);
```

### 4.3 新增表：environment_ttl_config

```sql
CREATE TABLE IF NOT EXISTS environment_ttl_config (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  environment_id  UUID NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
  ttl_hours       INT NOT NULL,
  expires_at      TIMESTAMPTZ,
  action_on_expire VARCHAR(20) NOT NULL DEFAULT 'hibernate',  -- 'hibernate' | 'cleanup'
  warning_hours   INT[] DEFAULT '{24, 1}',         -- 提前预警时间
  extended_count  INT DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(environment_id)
);
```

### 4.4 修改 environments 表

```sql
ALTER TABLE environments
  ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES environment_templates(id),
  ADD COLUMN IF NOT EXISTS hibernated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_accessed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ttl_config_id UUID REFERENCES environment_ttl_config(id);

-- 新增 hibernated 状态支持
COMMENT ON COLUMN environments.status IS 'active, inactive, hibernated, expired, deleted';
```

### 4.5 迁移脚本

```sql
-- Migration 085: Environment hibernation, TTL management, templates
```

## 五、前端设计

### 5.1 环境管理主页

**路由**: `/environments`

**页面结构**:
```
┌─────────────────────────────────────────────┐
│  环境管理                        [创建环境]  │
├─────────────────────────────────────────────┤
│                                              │
│  总览                                        │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐        │
│  │ 运行中  │ │ 已休眠  │ │ 月成本  │        │
│  │   5     │ │   2     │ │  $12.5  │        │
│  └─────────┘ └─────────┘ └─────────┘        │
│                                              │
│  环境卡片视图                                 │
│  ┌────────────────────────────────────────┐  │
│  │ 🟢 dev-frontend                        │  │
│  │ CPU: 2c  Mem: 4Gi  Storage: 10Gi       │  │
│  │ TTL: 23h  Cost: $0.8/day               │  │
│  │ [休眠] [详情] [续期]                    │  │
│  ├────────────────────────────────────────┤  │
│  │ ⚫ test-api (已休眠)                    │  │
│  │ CPU: 0c  Mem: 0Gi  Storage: 10Gi       │  │
│  │ 休眠 2d  Cost: $0.02/day (storage only)│  │
│  │ [唤醒] [详情] [销毁]                    │  │
│  ├────────────────────────────────────────┤  │
│  │ 🟡 staging (即将到期)                  │  │
│  │ CPU: 4c  Mem: 8Gi  Storage: 20Gi       │  │
│  │ TTL: 1h ⚠️  Cost: $1.6/day             │  │
│  │ [续期] [详情] [立即销毁]                │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  [从模板创建] [批量休眠] [刷新]               │
└─────────────────────────────────────────────┘
```

### 5.2 环境模板管理

**路由**: `/environment-templates`

**页面结构**:
```
┌─────────────────────────────────────────────┐
│  环境模板                        [新建模板]  │
├─────────────────────────────────────────────┤
│                                              │
│  预置模板                                   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐     │
│  │ 开发环境 │ │ 测试环境 │ │ 演示环境 │     │
│  │ 2C/4Gi   │ │ 4C/8Gi   │ │ 1C/2Gi   │     │
│  │ TTL: 24h │ │ TTL: 48h │ │ TTL: 8h  │     │
│  │ [使用]   │ │ [使用]   │ │ [使用]   │     │
│  └──────────┘ └──────────┘ └──────────┘     │
│                                              │
│  自定义模板                                 │
│  ┌──────────┐                                │
│  │ My Custom│                                │
│  │ 8C/16Gi  │                                │
│  │ TTL: 72h │                                │
│  │ 使用 3 次 │                                │
│  │ [使用] [编辑] [删除]                       │
│  └──────────┘                                │
└─────────────────────────────────────────────┘
```

### 5.3 前端文件变更

| 文件 | 操作 | 描述 |
|------|------|------|
| `src/pages/EnvironmentList/index.tsx` | 修改 | 添加休眠/TTL/模板功能 |
| `src/pages/EnvironmentTemplates/index.tsx` | 新建 | 环境模板管理 |
| `src/pages/EnvironmentStatus/index.tsx` | 新建 | 环境状态面板 |
| `src/api/environmentTemplates.ts` | 新建 | 模板 API 客户端 |
| `src/api/environmentTTL.ts` | 新建 | TTL API 客户端 |
| `src/components/EnvironmentCard/index.tsx` | 修改 | 添加休眠/TTL 展示 |
| `src/components/ResourceUsageChart/index.tsx` | 新建 | 资源占用图表 |

## 六、测试策略

### 6.1 单元测试

| 模块 | 文件 | 测试用例 |
|------|------|----------|
| EnvironmentHibernationService | `services/ephemeral-env/EnvironmentHibernationService.ts` | 休眠/唤醒/空闲检测（10 cases） |
| TTLManager | `services/ephemeral-env/TTLManager.ts` | TTL 设置/续期/到期清理（8 cases） |
| EnvironmentTemplateService | `services/environment/EnvironmentTemplateService.ts` | 模板 CRUD/参数化创建（6 cases） |

### 6.2 集成测试

| 场景 | 描述 |
|------|------|
| 休眠完整流程 | 创建环境 → 休眠 → 验证资源释放 → 唤醒 → 验证恢复 |
| TTL 到期清理 | 设置 TTL 1h → 等待到期 → 验证自动休眠/清理 |
| 模板创建环境 | 选择模板 → 覆盖参数 → 创建 → 验证配置正确应用 |

### 6.3 E2E 测试

| 场景 | 描述 |
|------|------|
| 环境管理 E2E | 从模板创建 → 配置 TTL → 使用 → 休眠 → 唤醒 → 验证 |

## 七、非功能性要求

### 7.1 性能

| 指标 | 目标 |
|------|------|
| 环境列表加载 | < 500ms（含状态查询） |
| 休眠操作响应 | < 2s（K8s 缩容） |
| 唤醒操作响应 | < 5s（K8s 部署） |

### 7.2 安全性

| 要求 | 实现 |
|------|------|
| Tenant 隔离 | 所有查询按 tenant_id 过滤 |
| 权限控制 | 环境创建需 member，销毁需 admin |

## 八、实施计划

| 模块 | 后端 (天) | 前端 (天) | 测试 (天) |
|------|:---------:|:---------:|:---------:|
| 休眠回收 | 1.5 | 1 | 1 |
| TTL 管理 | 1.5 | 1.5 | 1 |
| 环境模板 | 1 | 1.5 | 0.5 |
| 状态面板 | 0.5 | 2 | 0.5 |
| **合计** | **4.5** | **6** | **3** |

---

_文档版本: v1.0 | 创建日期: 2026-05-05 | 状态: 编写中_
