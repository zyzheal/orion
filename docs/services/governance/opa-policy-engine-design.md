# OPA Policy-as-Code Engine - 设计文档

## 1. 概述

### 1.1 愿景
统一的策略引擎，将组织策略以代码形式定义、测试、版本化，并在 CI/CD 全链路（代码审查、构建、部署、运行时）自动执行。

### 1.2 核心价值
- **一致性** — 一套策略覆盖从 PR 合并到生产运行的全生命周期
- **可测试** — 策略即代码，可在合并前测试，避免策略变更导致的生产事故
- **可审计** — 策略变更有完整 Git 历史，每次评估有日志记录

### 1.3 用户角色
- **安全/合规团队** — 定义策略、查看合规报告
- **平台工程师** — 管理策略仓库、集成 Pipeline 门禁
- **研发工程师** — 查看策略违规原因、申请临时豁免

## 2. 架构设计

### 2.1 组件分解

```
┌──────────────────────────────────────────────────────────────┐
│                     Policy-as-Code Engine                    │
│                                                               │
│  ┌────────────┐    ┌────────────┐    ┌──────────────────┐    │
│  │ Policy     │───▶│ OPA        │───▶│ Policy           │    │
│  │ Repository │    │ Engine     │    │ Evaluation       │    │
│  │ (Git)      │    │ (Sidecar)  │    │ Logger           │    │
│  └────────────┘    └────────────┘    └──────────────────┘    │
│         │                  │                   │              │
│  ┌──────▼──────┐   ┌──────▼──────┐   ┌────────▼─────────┐   │
│  │ Bundle      │   │ Policy      │   │ Pipeline Gate    │   │
│  │ Manager     │   │ Test Runner │   │ Integration      │   │
│  └─────────────┘   └─────────────┘   └──────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

### 2.2 集成点
- **Pipeline 引擎 (M5)** — 策略评估作为 Pipeline 门禁
- **审批工作台 (M3)** — 违规展示 + 豁免审批
- **安全合规 (M18)** — 策略定义 + 合规报告
- **GitOps 配置 (M7)** — 策略版本化存储

## 3. 数据模型

```sql
-- 策略定义
CREATE TABLE policy_definitions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(100) NOT NULL UNIQUE,
  description     TEXT,
  category        VARCHAR(50) NOT NULL,           -- security | cost | quality | governance
  rego_path       VARCHAR(255) NOT NULL,           -- Path in policy repo
  gate_id         VARCHAR(50),                     -- Pipeline gate identifier
  severity        VARCHAR(20) NOT NULL DEFAULT 'warning', -- block | warning | info
  enabled         BOOLEAN NOT NULL DEFAULT true,
  metadata        JSONB DEFAULT '{}',              -- Tags, owners, SLA
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 策略包 (从 Git 同步的 bundle)
CREATE TABLE policy_bundles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bundle_name     VARCHAR(100) NOT NULL,
  git_ref         VARCHAR(100) NOT NULL,            -- branch/tag/commit
  rego_content    JSONB NOT NULL,                   -- {file_path: rego_source}
  test_results    JSONB,                            -- Test run results
  deployed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  deployed_by     UUID REFERENCES users(id),
  status          VARCHAR(20) NOT NULL DEFAULT 'active' -- active | deprecated | failed
);
CREATE INDEX idx_policy_bundles_name ON policy_bundles(bundle_name);

-- 策略评估日志
CREATE TABLE policy_evaluations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id       UUID REFERENCES policy_definitions(id),
  run_id          UUID NOT NULL,                     -- Pipeline run ID
  input_context   JSONB NOT NULL,                    -- Evaluation input
  result          JSONB NOT NULL,                    -- Allow/deny + reasons
  evaluated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  evaluation_ms   INT                                -- Evaluation duration
);
CREATE INDEX idx_policy_evaluations_run ON policy_evaluations(run_id);

-- 违规记录
CREATE TABLE policy_violations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id   UUID REFERENCES policy_evaluations(id),
  policy_id       UUID REFERENCES policy_definitions(id),
  severity        VARCHAR(20) NOT NULL,
  message         TEXT NOT NULL,
  resource_type   VARCHAR(50),                       -- pipeline | deployment | image | config
  resource_id     VARCHAR(255),
  status          VARCHAR(20) NOT NULL DEFAULT 'open', -- open | waived | resolved
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 策略豁免
CREATE TABLE policy_overrides (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id       UUID REFERENCES policy_definitions(id),
  violation_id    UUID REFERENCES policy_violations(id),
  reason          TEXT NOT NULL,
  approved_by     UUID REFERENCES users(id),
  approved_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at      TIMESTAMPTZ NOT NULL,
  scope           VARCHAR(50) DEFAULT 'global'       -- global | project | environment
);
```

## 4. API 设计

### 4.1 策略管理
```
GET    /api/v1/policies                             # 策略列表
POST   /api/v1/policies                             # 创建策略
GET    /api/v1/policies/:id                         # 详情
PUT    /api/v1/policies/:id                         # 更新
DELETE /api/v1/policies/:id                         # 删除
PATCH  /api/v1/policies/:id/toggle                  # 启用/禁用
```

### 4.2 Bundle 同步
```
POST   /api/v1/policies/bundles/sync                # 从 Git 同步
GET    /api/v1/policies/bundles                     # Bundle 列表
GET    /api/v1/policies/bundles/:id                 # Bundle 详情
```

### 4.3 策略评估
```
POST   /api/v1/policies/evaluate                    # 手动评估 (body: policy_id, input)
GET    /api/v1/policies/evaluations?runId=          # 评估历史
POST   /api/v1/policies/gate/:gateId/evaluate       # Pipeline 门禁评估
```

### 4.4 违规与豁免
```
GET    /api/v1/policies/violations?status=&severity=  # 违规列表
GET    /api/v1/policies/violations/:id               # 违规详情
POST   /api/v1/policies/violations/:id/waive         # 申请豁免
POST   /api/v1/policies/violations/:id/resolve       # 标记已解决
GET/POST /api/v1/policies/overrides                  # 豁免 CRUD
```

### 4.5 策略测试
```
POST   /api/v1/policies/test                        # 运行测试 (body: rego, test_cases)
GET    /api/v1/policies/test/results/:id            # 测试结果
```

## 5. Pipeline 集成

### 5.1 门禁映射

| Stage | 门禁 | 策略类别 | 示例策略 |
|-------|------|----------|----------|
| Stage 1 (Scan) | 代码扫描门禁 | security | "必须通过 Secret 扫描" |
| Stage 2 (Build) | 构建门禁 | quality | "容器镜像不可用 root" |
| Stage 5 (Release) | 发布门禁 | governance | "必须 2+ 审批" |
| Stage 6 (Deploy) | 部署门禁 | security, cost | "不可部署到超预算环境" |
| Stage 7 (Monitor) | 定期评估 | compliance | "所有服务必须有 Runbook" |

### 5.2 评估流程

```
Pipeline 到达门禁
  → PolicyEngine.evaluate(gate_id, context)
    → 加载该 gate 下所有 enabled policies
    → 对每条策略执行 OPA evaluate(rego, input)
    → 收集所有 deny 结果
    → 如果存在 block 级别 deny → 门禁不通过
    → 否则通过（warning 级别记录违规但放行）
  → 返回 {passed: boolean, violations: [...], warnings: [...]}
```

## 6. UI/UX 设计

### 6.1 策略管理页 (`/policies`)
- 策略表格：名称、分类、严重级别、门禁、启用状态、操作
- 分类过滤 + 关键词搜索
- 创建/编辑：表单（名称、描述、分类、严重级别、Rego 路径、关联门禁）

### 6.2 Rego 编辑器 (`/policies/:id/editor`)
- 分屏布局：左侧 Rego 代码编辑器（语法高亮），右侧测试面板
- 测试面板：输入 JSON 编辑器 + 运行测试按钮 + 结果展示
- 版本对比：与上一个版本的 Rego diff

### 6.3 违规仪表盘 (`/policies/violations`)
- 统计卡片：活跃违规数、按严重级别分布、平均解决时间
- 违规表格：策略名、资源、严重级别、状态、创建时间
- 操作：标记解决、申请豁免

### 6.4 合规报告 (`/policies/compliance`)
- 按时间范围、环境、项目筛选
- 策略通过率趋势图
- 导出 PDF/CSV

## 7. 安全与权限

| 权限 | 角色 |
|------|------|
| `policy:read` | developer, tech_lead, sre, security, auditor, admin |
| `policy:manage` | sre, security, admin |
| `policy:bundle:sync` | sre, admin |
| `policy:evaluate` | developer (dev/staging), sre, admin (production) |
| `policy:waiver:approve` | security_lead, admin |
| `policy:test` | sre, security, admin |

## 8. 测试策略

- **L1 单元** — Rego 解析器、评估逻辑、违规匹配、豁免优先级
- **L2 集成** — OPA 引擎集成、Git bundle 同步、Pipeline 门禁触发
- **L3 E2E** — 策略从定义 → 测试 → 部署 → 评估 → 违规 → 豁免全链路
- **L4 性能** — 100 条策略并发评估 < 500ms
- **L5 安全** — Rego 注入防护、越权评估拦截
