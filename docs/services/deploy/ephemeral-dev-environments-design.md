# Ephemeral Development Environments - 设计文档

## 1. 概述

### 1.1 愿景
每个 PR 自动获得完整的、与生产镜像一致的开发环境，包含前端、后端、数据库、缓存、消息队列，PR 合并后自动销毁。

### 1.2 核心价值
- **消除 "Works on My Machine"** — 环境即代码，每 PR 独立、可重现
- **零等待开发** — PR 创建后自动拉起环境，开发即用即弃
- **成本可控** — 环境生命周期与 PR 绑定，闲置自动回收
- **真实数据测试** — 匿名化的生产数据快照，依赖服务自动 Mock

### 1.3 用户角色
- **研发工程师** — 创建/使用/销毁环境
- **Tech Lead** — 查看环境资源消耗、审批大型环境申请
- **运维/SRE** — 管理环境模板、配置资源配额、监控集群负载

## 2. 架构设计

### 2.1 组件分解

```
┌─────────────────────────────────────────────────────────────┐
│                  Ephemeral Dev Environments                   │
│                                                               │
│  PR Created ──▶ ┌─────────────┐                               │
│                 │ Environment │──▶ Namespace Provisioning     │
│                 │ Orchestrator│    (K8s Namespace + Policies) │
│                 └──────┬──────┘                               │
│                        │                                      │
│          ┌─────────────┼─────────────┐                        │
│          ▼             ▼             ▼                        │
│  ┌───────────┐ ┌───────────┐ ┌───────────────┐               │
│  │ Deploy    │ │ Data      │ │ Dependency    │               │
│  │ Services  │ │ Seed      │ │ Mock/Stub     │               │
│  │ (Frontend │ │ (Anonymized│ │ (External      │               │
│  │  Backend) │ │  DB Dump) │ │  Services)     │               │
│  └───────────┘ └───────────┘ └───────────────┘               │
│                        │                                      │
│                        ▼                                      │
│  ┌──────────────────────────────┐                             │
│  │ Preview URL Generator        │                             │
│  │ https://pr-{id}-{hash}.dev   │                             │
│  └──────────────────────────────┘                             │
│                                                               │
│  PR Merged/Closed ──▶ Auto Teardown (Namespace + Resources)  │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 集成点
- **智能部署 (M16)** — 环境编排与 Pod 调度
- **CMDB (M32)** — 服务依赖拓扑用于环境自动装配
- **GitOps 配置 (M7)** — 环境配置从 Git 获取
- **FinOps (M22)** — 环境成本追踪
- **多租户 (M12)** — Namespace 级隔离
- **通知中心 (M13)** — 环境就绪通知

## 3. 数据模型

```sql
-- 临时环境
CREATE TABLE ephemeral_environments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pr_id           VARCHAR(100) NOT NULL,
  repo_id         VARCHAR(100) NOT NULL,
  branch_name     VARCHAR(255) NOT NULL,
  namespace       VARCHAR(63) NOT NULL UNIQUE,      -- K8s namespace
  template_id     UUID REFERENCES environment_templates(id),
  status          VARCHAR(20) NOT NULL DEFAULT 'provisioning', -- provisioning | running | idle | tearing_down | destroyed
  preview_url     VARCHAR(255),
  commit_sha      VARCHAR(40),
  resources       JSONB,                              -- {cpu, memory, storage} allocated
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  idle_since      TIMESTAMPTZ,
  auto_destroy_at TIMESTAMPTZ,                        -- Auto-destroy deadline
  destroyed_at    TIMESTAMPTZ,
  destroy_reason  VARCHAR(100)                        -- pr_merged | pr_closed | timeout | manual
);
CREATE INDEX idx_eph_env_pr ON ephemeral_environments(pr_id, repo_id);

-- 环境模板
CREATE TABLE environment_templates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(100) NOT NULL UNIQUE,
  description     TEXT,
  services        JSONB NOT NULL,                     -- [{name, image, replicas, resources}]
  dependencies    JSONB,                              -- [{service_name, type: db|cache|mq, image}]
  data_seed_config JSONB,                             -- Data seeding settings
  network_policies JSONB,                             -- Network isolation rules
  resource_limits JSONB,                              -- {cpu_limit, memory_limit, storage_limit}
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 数据种子配置
CREATE TABLE data_seed_configs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  env_id          UUID REFERENCES ephemeral_environments(id) ON DELETE CASCADE,
  source_env      VARCHAR(50) DEFAULT 'staging',      -- Source environment for seed data
  anonymization   JSONB,                              -- Anonymization rules per table
  tables          TEXT[],                              -- Tables to seed
  status          VARCHAR(20) DEFAULT 'pending',       -- pending | seeding | completed | failed
  seeded_at       TIMESTAMPTZ,
  error_message   TEXT
);

-- 环境依赖 Mock 配置
CREATE TABLE dependency_mocks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  env_id          UUID REFERENCES ephemeral_environments(id) ON DELETE CASCADE,
  service_name    VARCHAR(100) NOT NULL,
  mock_type       VARCHAR(50) NOT NULL,                -- stub | proxy | recorder
  mock_config     JSONB,                               -- Mock-specific configuration
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

## 4. API 设计

```
# Environment
POST   /api/v1/ephemeral-envs                         # 创建环境 (body: prId, repoId, templateId)
GET    /api/v1/ephemeral-envs?prId=&repoId=&status=   # 环境列表
GET    /api/v1/ephemeral-envs/:id                     # 环境详情
POST   /api/v1/ephemeral-envs/:id/wake                # 唤醒空闲环境
POST   /api/v1/ephemeral-envs/:id/teardown            # 销毁环境
GET    /api/v1/ephemeral-envs/:id/logs                # 环境事件日志

# Template
GET    /api/v1/ephemeral-envs/templates               # 模板列表
POST   /api/v1/ephemeral-envs/templates               # 创建模板
GET/PUT/DELETE /api/v1/ephemeral-envs/templates/:id   # 模板 CRUD

# Preview
GET    /api/v1/ephemeral-envs/:id/preview              # 获取 Preview URL
GET    /api/v1/ephemeral-envs/:id/status               # 健康检查

# Cost
GET    /api/v1/ephemeral-envs/:id/cost                 # 环境成本
GET    /api/v1/ephemeral-envs/cost/summary?period=     # 成本汇总
```

## 5. 工作流

### 5.1 PR 创建 → 环境自动拉起

```
1. PR 创建 (GitLab Webhook)
   → Event Bus 发布 pr_created 事件
   → Ephemeral Env Orchestrator 接收事件

2. Namespace 配置
   → 从 Environment Template 加载服务定义
   → 从 CMDB 查询服务依赖拓扑
   → 生成 K8s Namespace + NetworkPolicy + ResourceQuota

3. 服务部署
   → 部署 Frontend (PR 分支代码)
   → 部署 Backend (PR 分支代码)
   → 部署依赖服务 (DB/Cache/MQ，使用模板定义的低配版本)

4. 数据种子
   → 从 Staging 拉取匿名化数据快照
   → 导入到环境数据库

5. 外部依赖 Mock
   → 根据依赖拓扑自动配置 Mock/Stub
   → 第三方 API 使用 Proxy Mock

6. Preview URL 生成
   → 生成 https://pr-{id}-{hash}.dev.orion.internal
   → 发送通知到 PR 作者

7. PR 合并/关闭 → 自动销毁
   → 等待 30 分钟缓冲期
   → 删除 Namespace + 所有资源
   → 记录成本到 FinOps
```

## 6. UI/UX 设计

### 6.1 环境列表 (`/ephemeral-envs`)
- 表格：PR 号、仓库、分支、状态、Preview URL、创建时间、资源消耗
- 状态过滤：Provisioning / Running / Idle / Destroyed
- 操作：打开 Preview、唤醒、销毁、查看成本

### 6.2 环境详情 (`/ephemeral-envs/:id`)
- 状态横幅：环境状态 + Preview 链接
- 服务列表：服务名、镜像、副本数、健康状态、资源使用
- 依赖拓扑图：服务依赖可视化（来自 CMDB）
- 数据种子状态：种子进度、匿名化规则
- 事件时间线：Provisioning → Running → Idle → Teardown
- 成本卡片：CPU/内存/存储/网络费用
- 操作：唤醒、销毁、查看日志

### 6.3 模板管理 (`/ephemeral-envs/templates`)
- 模板卡片：名称、描述、服务数、资源配额、使用次数
- 创建/编辑模板：服务定义表单 + 依赖配置 + 资源限额

### 6.4 成本仪表盘 (`/ephemeral-envs/cost`)
- 统计卡片：总环境数、月成本、平均单环境成本、空闲浪费
- 趋势图：按周/月的环境成本趋势
- Top 消费者：按用户/项目的资源消耗排名

## 7. 安全与权限

| 权限 | 角色 |
|------|------|
| `ephemeral-env:read` | developer, tech_lead, sre, admin |
| `ephemeral-env:create` | developer (own PRs), sre, admin |
| `ephemeral-env:wake` | developer, sre, admin |
| `ephemeral-env:teardown` | developer (own), sre, admin |
| `ephemeral-env:template:manage` | sre, admin |
| `ephemeral-env:cost:read` | tech_lead, sre, admin |

## 8. 扩展性与性能

- **资源配额** — 每个环境默认限制：2 CPU、4Gi 内存、10Gi 存储
- **并发限制** — 每租户同时运行环境上限（默认 10）
- **空闲回收** — 环境 2 小时无访问 → 标记 Idle → 24 小时 → 自动销毁
- **低配模式** — 临时环境使用缩配版本（1 副本、低资源请求）
- **节点自动伸缩** — K8s Cluster Autoscaler 根据环境数自动伸缩节点

## 9. 测试策略

- **L1 单元** — Orchestrator 调度逻辑、资源配额计算、Preview URL 生成
- **L2 集成** — K8s Namespace 创建、服务部署、数据种子导入
- **L3 E2E** — PR 创建 → 环境拉起 → 开发测试 → PR 合并 → 环境销毁全链路
- **L4 性能** — 环境拉起时间 < 5min（含数据种子），销毁时间 < 2min
- **L5 成本** — 环境成本追踪精度 < 5% 误差
