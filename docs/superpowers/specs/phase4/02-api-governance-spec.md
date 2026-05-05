# API 治理详细规格 (Phase 4)

> **日期**: 2026-05-05
> **状态**: 概念探索
> **能力域**: 2. API 治理 (API Governance)
> **目标成熟度**: L2 → L3
> **关键交付**: 契约测试自动化、API 版本管理、变更影响分析

## 一、功能描述

### 1.1 现状评估 (L2)

Orion 当前已实现：
- API 路由集中管理（`api/routes.ts` 统一注册）
- 基础 API 文档（Fastify Swagger 插件）
- 部分 API 路径一致性校验（前端/后端路径对齐 ~95%）
- 认证中间件（JWT + RBAC）

**不足**：
- 无 OpenAPI 契约自动化生成与校验
- 无 Provider/Consumer 契约测试
- 无 API 变更影响分析
- 无 API 版本生命周期管理
- 无 API 废弃与迁移提醒

### 1.2 Phase 4 目标 (L3) — 长期愿景

| 功能模块 | 描述 | 验收等级 |
|----------|------|:--------:|
| 契约测试自动化 | OpenAPI Spec 驱动，Provider/Consumer 契约测试自动执行 | L3 |
| API 版本管理 | API 版本生命周期、向后兼容检查、Breaking Change 拦截 | L3 |
| 变更影响分析 | API 变更自动分析下游影响面，生成影响报告 | L2.5 |
| API 废弃管理 | 废弃 API 标记、迁移路径推荐、调用方通知 | L2.5 |

## 二、验收标准

### 2.1 契约测试自动化

| # | 标准 | 验证方式 |
|---|------|----------|
| C1 | 从 OpenAPI Spec 自动生成契约测试用例 | 单元测试 |
| C2 | Provider 测试：验证 API 实现与契约一致（字段、类型、约束） | 集成测试 |
| C3 | Consumer 测试：验证客户端调用契约 | 单元测试 |
| C4 | CI/CD 集成：PR 合并前自动运行契约测试 | CI 验证 |
| C5 | 契约变更检测：Spec 变更时标记 Breaking / Non-breaking | 单元测试 |

### 2.2 API 版本管理

| # | 标准 | 验证方式 |
|---|------|----------|
| V1 | 支持 URL 版本（/api/v1/）和 Header 版本（API-Version） | API 测试 |
| V2 | 版本生命周期：draft → active → deprecated → retired | API 测试 |
| V3 | Breaking Change 自动检测（删除字段、修改类型、新增必填字段） | 单元测试 |
| V4 | Non-breaking Change 自动放行（新增可选字段） | 单元测试 |

### 2.3 变更影响分析

| # | 标准 | 验证方式 |
|---|------|----------|
| I1 | API 变更时自动扫描所有调用方（前端页面、外部消费者） | 集成测试 |
| I2 | 生成影响报告：影响模块数、影响接口数、风险评估 | API 测试 |
| I3 | 提供迁移建议（旧字段到新字段映射） | 人工审查 |

## 三、API 设计

```
Base: /api/v1/governance
```

### 3.1 契约测试 API

| 方法 | 路径 | 描述 | 请求体 | 响应 |
|------|------|------|--------|------|
| POST | `/contracts/upload` | 上传 OpenAPI Spec | multipart: `openapi.yaml` | `{ contractId, version, endpoints, validated }` |
| GET | `/contracts` | 契约列表 | query: service, version, status | `{ data: Contract[], total }` |
| GET | `/contracts/:id` | 契约详情 | - | `{ id, spec, endpoints[], lastVerified }` |
| POST | `/contracts/:id/verify` | 执行契约验证 | `{ scope?: 'provider' \| 'consumer' }` | `{ result, passed, failed, warnings[] }` |
| GET | `/contracts/:id/changes` | 契约变更历史 | - | `{ changes: ContractChange[] }` |

### 3.2 API 版本管理 API

| 方法 | 路径 | 描述 | 请求体 | 响应 |
|------|------|------|--------|------|
| GET | `/versions` | API 版本列表 | query: service, status | `{ data: ApiVersion[], total }` |
| PUT | `/versions/:id/status` | 更新版本状态 | `{ status: 'active' \| 'deprecated' \| 'retired' }` | `{ id, status, deprecationDate? }` |
| POST | `/versions/:id/compatibility-check` | 兼容性检查 | `{ newSpec: string }` | `{ compatible: boolean, breakingChanges[], nonBreakingChanges[] }` |

### 3.3 变更影响分析 API

| 方法 | 路径 | 描述 | 请求体 | 响应 |
|------|------|------|--------|------|
| POST | `/impact-analysis` | 执行变更影响分析 | `{ contractId, changes: ApiChange[] }` | `{ riskLevel, impactedServices[], impactedClients[], migrationSuggestions[] }` |

### 3.4 TypeScript 接口

```typescript
interface Contract {
  id: string;
  serviceName: string;
  version: string;
  spec: Record<string, unknown>;    // OpenAPI 3.x 解析后
  endpoints: ContractEndpoint[];
  status: 'active' | 'deprecated' | 'retired';
  lastVerifiedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface ContractEndpoint {
  path: string;
  method: string;
  requestSchema?: Record<string, unknown>;
  responseSchema: Record<string, unknown>;
  authRequired: boolean;
  rateLimit?: number;
}

interface ContractVerificationResult {
  contractId: string;
  scope: 'provider' | 'consumer';
  passed: boolean;
  total: number;
  passedCount: number;
  failedCount: number;
  warnings: string[];
  failures: VerificationFailure[];
  verifiedAt: Date;
}

interface VerificationFailure {
  endpoint: string;
  field: string;
  expected: string;
  actual: string;
  severity: 'error' | 'warning';
}

interface CompatibilityCheckResult {
  compatible: boolean;
  breakingChanges: BreakingChange[];
  nonBreakingChanges: string[];
}

interface BreakingChange {
  endpoint: string;
  type: 'field_removed' | 'type_changed' | 'required_added' | 'path_changed';
  description: string;
  severity: 'high' | 'medium';
}

interface ImpactAnalysisResult {
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  impactedServices: { name: string; endpoints: string[] }[];
  impactedClients: { name: string; type: 'frontend' | 'external' }[];
  migrationSuggestions: { from: string; to: string; note: string }[];
}
```

## 四、数据库变更

### 4.1 新增表：api_contracts

```sql
-- Migration 117: API governance - contracts & versions
CREATE TABLE IF NOT EXISTS api_contracts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  service_name    VARCHAR(200) NOT NULL,
  version         VARCHAR(50) NOT NULL,
  spec            JSONB NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'active',
  endpoints_count INT DEFAULT 0,
  last_verified_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(service_name, version)
);
CREATE INDEX idx_api_contracts_tenant ON api_contracts(tenant_id);
CREATE INDEX idx_api_contracts_service ON api_contracts(service_name);
CREATE INDEX idx_api_contracts_status ON api_contracts(status);
```

### 4.2 新增表：api_versions

```sql
CREATE TABLE IF NOT EXISTS api_versions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  contract_id     UUID NOT NULL REFERENCES api_contracts(id) ON DELETE CASCADE,
  version_tag     VARCHAR(50) NOT NULL,       -- 'v1', 'v2', 'v2.1'
  status          VARCHAR(20) NOT NULL DEFAULT 'active',
  deprecation_date TIMESTAMPTZ,
  retirement_date  TIMESTAMPTZ,
  replacement_version VARCHAR(50),
  changelog       TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(contract_id, version_tag)
);
CREATE INDEX idx_api_versions_contract ON api_versions(contract_id);
CREATE INDEX idx_api_versions_status ON api_versions(status);
```

### 4.3 新增表：api_verification_runs

```sql
CREATE TABLE IF NOT EXISTS api_verification_runs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  contract_id     UUID NOT NULL REFERENCES api_contracts(id) ON DELETE CASCADE,
  scope           VARCHAR(20) NOT NULL,       -- 'provider' | 'consumer'
  passed          BOOLEAN NOT NULL,
  total           INT DEFAULT 0,
  passed_count    INT DEFAULT 0,
  failed_count    INT DEFAULT 0,
  warnings        JSONB DEFAULT '[]',
  failures        JSONB DEFAULT '[]',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_api_verification_runs_contract ON api_verification_runs(contract_id);
```

## 五、前端设计

### 5.1 契约管理页面

**路由**: `/api-governance/contracts`

**页面结构**:
```
┌─────────────────────────────────────────────┐
│  API 治理 - 契约管理              [上传 Spec]│
├─────────────────────────────────────────────┤
│  服务: [全部 ▼]  状态: [Active ▼]           │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │ 服务名     │ 版本 │ 端点 │ 状态 │ 验证  │  │
│  │ platform   │ 2.1  │ 48   │ 活跃 │ ✓通过│  │
│  │   最近更新 2h   │        │      │ 2026-05-05 │  │
│  │              [验证] [详情] [版本对比]    │  │
│  ├────────────────────────────────────────┤  │
│  │ gateway    │ 1.0  │ 12   │ 活跃 │ 警告 │  │
│  │   最近更新 1d   │        │ 1/12 不匹配    │  │
│  └────────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

### 5.2 API 版本管理页面

**路由**: `/api-governance/versions`

**页面结构**:
```
┌─────────────────────────────────────────────┐
│  API 治理 - 版本管理                         │
├─────────────────────────────────────────────┤
│                                              │
│  platform-service                            │
│  ┌────────────────────────────────────────┐  │
│  │ v2.1  ● 活跃     2026-04-01            │  │
│  │ v2.0  ○ 废弃     2026-01-15  退役: 待排期│  │
│  │ v1.0  ○ 退役     2025-06-01  已退役     │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  兼容性检查                                  │
│  当前版本: [v2.1 ▼]                          │
│  新 Spec: [openapi-new.yaml       ] [选择文件]│
│  [检查兼容性]                                │
│  ✓ 兼容 - 2 个新增可选字段                    │
└─────────────────────────────────────────────┘
```

### 5.3 前端文件变更

| 文件 | 操作 | 描述 |
|------|------|------|
| `src/pages/ApiGovernance/ContractList.tsx` | 新建 | 契约管理页面 |
| `src/pages/ApiGovernance/ContractDetail.tsx` | 新建 | 契约详情页面 |
| `src/pages/ApiGovernance/VersionList.tsx` | 新建 | API 版本管理 |
| `src/pages/ApiGovernance/CompatibilityCheck.tsx` | 新建 | 兼容性检查 |
| `src/pages/ApiGovernance/ImpactAnalysis.tsx` | 新建 | 变更影响分析 |
| `src/api/apiGovernance.ts` | 新建 | API 客户端 |
| `src/components/SpecViewer/index.tsx` | 新建 | OpenAPI Spec 查看器 |
| `src/components/CompatibilityReport/index.tsx` | 新建 | 兼容性报告组件 |

## 六、测试策略

| 类型 | 模块 | 用例数 |
|------|------|:------:|
| 单元测试 | ContractService（契约解析/验证） | 15 |
| 单元测试 | CompatibilityChecker（Breaking Change 检测） | 12 |
| 单元测试 | ImpactAnalyzer（影响面分析） | 8 |
| 集成测试 | 契约上传 → 验证 → 报告 | 3 |
| 集成测试 | 版本兼容性检查流程 | 2 |
| E2E 测试 | 前端上传 Spec 并查看验证结果 | 2 |

## 七、非功能性要求

| 维度 | 要求 |
|------|------|
| 性能 | 契约验证 < 2s（100 端点） |
| 性能 | 兼容性检查 < 500ms |
| 安全 | Spec 上传校验（大小限制 5MB、格式校验） |
| 安全 | 契约存储不包含敏感信息 |
| 可维护性 | 代码覆盖率 > 80% |
| 可维护性 | 契约测试可集成至 CI（GitHub Actions / Tekton） |

## 八、实施计划

| 模块 | 后端 (天) | 前端 (天) | 测试 (天) |
|------|:---------:|:---------:|:---------:|
| 契约测试自动化 | 5 | 3 | 2 |
| API 版本管理 | 3 | 2.5 | 1.5 |
| 变更影响分析 | 3 | 2 | 1.5 |
| **合计** | **11** | **7.5** | **5** |

> 注：可复用 Phase 1 中已实现的 API 文档/质量门禁基础设施，减少重复开发。

---

_文档版本: v1.0 | 创建日期: 2026-05-05 | 状态: 概念探索_
