# 质量门禁详细规格 (Phase 1)

> **日期**: 2026-05-05
> **状态**: 编写中
> **能力域**: 3. 质量门禁
> **目标成熟度**: L3 → L3.3
> **关键交付**: 门禁豁免机制、趋势分析面板

## 一、功能描述

### 1.1 现状评估 (L3)

Orion 当前已实现：
- Policy CRUD（PolicyService + PolicyRepository + PostgreSQL）
- OPA 策略评估（PolicyEvaluationService，支持真实 OPA REST API + Mock 降级）
- 违规管理（Violations：list/waive/resolve）
- 策略覆盖（Overrides：create/list，Map 内存存储）
- 策略 Bundle 管理（listBundles/syncBundles，Mock 实现）
- Rego 策略测试（testPolicy，语法验证级别）
- 策略开关（toggle）
- 风险评估（RiskAssessmentService：XGBoost 26 特征 + SHAP 可解释性 + PostgreSQL Repository）
- 安全评分（0-100 分，按代码质量/安全/测试/性能维度）

**不足**：
- Overrides 无持久化（Map 内存存储）
- 无门禁豁免审批流程（waive 无审批链/有效期/审计）
- 无质量门禁趋势分析（历史通过率/趋势图/改进建议）
- Bundle 管理为 Mock（无真实 OPA Bundle 同步）
- 质量门禁缺乏与 Pipeline 的深度集成（evaluateGate 仅 mock）

### 1.2 Phase 1 目标 (L3.3)

| 功能模块 | 描述 | 验收等级 |
|----------|------|:--------:|
| 门禁豁免机制 | 多级审批、有效期、豁免原因分类、自动过期 | L3.3 |
| 趋势分析面板 | 门禁通过率趋势、违规分布、改进建议 | L3.3 |
| Override 持久化 | 将 Overrides 迁移至 PostgreSQL | L3.3 |
| 门禁与 Pipeline 集成 | Pipeline 关键节点自动触发质量门禁评估 | L3.3 |

## 二、验收标准

### 2.1 门禁豁免机制

| # | 标准 | 验证方式 |
|---|------|----------|
| E1 | 豁免申请含原因分类（business-urgency/tech-debt/false-positive/temporary） | API 测试 |
| E2 | 豁免支持多级审批（submit → review → approve/reject） | API 测试 |
| E3 | 豁免有效期（expiresAt），到期自动失效 | 单元测试 |
| E4 | 豁免需关联具体 Violation 和 Policy | API 测试 |
| E5 | 豁免审批链写入审计日志 | 代码审查 |
| E6 | 支持临时豁免（24h 自动过期）和长期豁免（需 admin 审批） | API 测试 |

### 2.2 趋势分析面板

| # | 标准 | 验证方式 |
|---|------|----------|
| T1 | 门禁通过率趋势（7/30/90 天） | API 测试 |
| T2 | 违规按 severity/policy 类型分布统计 | API 测试 |
| T3 | Top 5 频繁失败 Policy 排名 | API 测试 |
| T4 | 豁免统计（活跃/过期/审批中） | API 测试 |
| T5 | 改进建议（基于失败模式分析自动生成） | API 测试 |

### 2.3 Override 持久化

| # | 标准 | 验证方式 |
|---|------|----------|
| O1 | 创建 policy_overrides 表 | 迁移脚本 |
| O2 | Override CRUD 通过 Repository 访问数据库 | 单元测试 |
| O3 | Override 支持 tenant_id 隔离 | API 测试 |

### 2.4 门禁与 Pipeline 集成

| # | 标准 | 验证方式 |
|---|------|----------|
| P1 | Pipeline Run 完成时自动触发质量门禁评估 | 集成测试 |
| P2 | 门禁失败可阻断部署（block policy） | 集成测试 |
| P3 | 门禁通过/失败状态在 Pipeline Run 详情中展示 | 前端验证 |

## 三、API 设计

### 3.1 豁免机制 API

```
Base: /api/v1/policies/exemptions
```

| 方法 | 路径 | 描述 | 请求体 | 响应 |
|------|------|------|--------|------|
| POST | `/` | 提交豁免申请 | `ExemptionRequest` | `{ id, violationId, status, submittedAt }` |
| GET | `/` | 获取豁免列表 | query: status, policyId, page, limit | `{ data: Exemption[], total }` |
| GET | `/:id` | 获取豁免详情 | - | `{ id, violationId, reason, category, approvalChain, status }` |
| POST | `/:id/review` | 审批豁免 | `{ action: 'approve' | 'reject', comment }` | `{ id, status, reviewedBy, reviewedAt }` |
| DELETE | `/:id` | 撤销豁免 | - | `{ success }` |

**Exemption 结构**:

```typescript
interface Exemption {
  id: string;
  violationId: string;
  policyId: string;
  runId: string;
  reason: string;               // 豁免原因描述
  category: 'business-urgency' | 'tech-debt' | 'false-positive' | 'temporary';
  requestedBy: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired' | 'revoked';
  expiresAt: Date;              // 自动过期时间
  approvalChain: ApprovalStep[];
  createdAt: Date;
  updatedAt: Date;
}

interface ApprovalStep {
  approver: string;
  action: 'approve' | 'reject';
  comment?: string;
  reviewedAt: Date;
}
```

### 3.2 趋势分析 API

```
Base: /api/v1/quality-gates
```

| 方法 | 路径 | 描述 | 请求体 | 响应 |
|------|------|------|--------|------|
| GET | `/trend` | 门禁通过率趋势 | query: days, policyId | `{ data: [{ date, passRate, total, passed, failed }] }` |
| GET | `/distribution` | 违规分布 | query: days, groupBy | `{ bySeverity: {}, byPolicy: {} }` |
| GET | `/top-failing` | Top 失败 Policy | query: limit, days | `{ policies: [{ id, name, failCount, failRate }] }` |
| GET | `/exemption-stats` | 豁免统计 | - | `{ active, expired, pending, approvalRate }` |
| GET | `/recommendations` | 改进建议 | query: policyId | `{ suggestions: [{ type, description, priority }] }` |

**TrendData 结构**:

```typescript
interface TrendData {
  date: string;
  passRate: number;       // 0-1
  total: number;
  passed: number;
  failed: number;
  waived: number;
}

interface ViolationDistribution {
  bySeverity: Record<string, number>;   // { critical: 5, high: 12, medium: 28 }
  byPolicy: Record<string, number>;     // { 'security-scan': 15, 'code-coverage': 8 }
}

interface FailingPolicy {
  id: string;
  name: string;
  failCount: number;
  failRate: number;
  avgResolutionTime: number;    // ms
}
```

### 3.3 改进建议

```typescript
interface Recommendation {
  type: 'increase-coverage' | 'fix-vulnerability' | 'update-policy' | 'add-test';
  description: string;
  priority: 'high' | 'medium' | 'low';
  evidence: {
    metric: string;
    currentValue: number;
    targetValue: number;
  };
}
```

生成逻辑：
- 代码覆盖率 < 60% → 建议增加测试
- 安全漏洞 critical > 0 → 建议修复漏洞
- 某 Policy 失败率 > 50% → 建议审查 Policy 合理性
- 测试失败率上升 → 建议增加/修复测试用例

## 四、数据库变更

### 4.1 新增表：policy_overrides (持久化)

```sql
CREATE TABLE IF NOT EXISTS policy_overrides (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  policy_id       UUID REFERENCES policies(id) ON DELETE SET NULL,
  resource_type   VARCHAR(100),
  resource_id     VARCHAR(255),
  override_type   VARCHAR(50) NOT NULL DEFAULT 'allow',
  reason          TEXT NOT NULL,
  created_by      UUID REFERENCES users(id),
  expires_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_policy_overrides_tenant ON policy_overrides(tenant_id);
CREATE INDEX idx_policy_overrides_policy ON policy_overrides(policy_id);
CREATE INDEX idx_policy_overrides_expires ON policy_overrides(expires_at);
```

### 4.2 新增表：policy_exemptions

```sql
CREATE TABLE IF NOT EXISTS policy_exemptions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  violation_id    UUID NOT NULL REFERENCES policy_violations(id) ON DELETE CASCADE,
  policy_id       UUID REFERENCES policies(id) ON DELETE SET NULL,
  run_id          UUID REFERENCES pipeline_runs(id) ON DELETE SET NULL,
  reason          TEXT NOT NULL,
  category        VARCHAR(50) NOT NULL,
  requested_by    UUID REFERENCES users(id),
  status          VARCHAR(20) NOT NULL DEFAULT 'pending',
  expires_at      TIMESTAMPTZ,
  approval_chain  JSONB DEFAULT '[]',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_policy_exemptions_tenant ON policy_exemptions(tenant_id);
CREATE INDEX idx_policy_exemptions_violation ON policy_exemptions(violation_id);
CREATE INDEX idx_policy_exemptions_status ON policy_exemptions(status);
CREATE INDEX idx_policy_exemptions_expires ON policy_exemptions(expires_at);
```

### 4.3 新增表：quality_gate_snapshots

质量门禁每日快照（用于趋势分析）。

```sql
CREATE TABLE IF NOT EXISTS quality_gate_snapshots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  snapshot_date   DATE NOT NULL,
  policy_id       UUID REFERENCES policies(id) ON DELETE SET NULL,
  total_evaluations INT NOT NULL DEFAULT 0,
  passed_count    INT NOT NULL DEFAULT 0,
  failed_count    INT NOT NULL DEFAULT 0,
  waived_count    INT NOT NULL DEFAULT 0,
  avg_evaluation_ms DECIMAL(10,2),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(tenant_id, snapshot_date, policy_id)
);
CREATE INDEX idx_quality_gate_snapshots_date ON quality_gate_snapshots(snapshot_date DESC);
CREATE INDEX idx_quality_gate_snapshots_tenant ON quality_gate_snapshots(tenant_id);
```

### 4.4 迁移脚本

```sql
-- Migration 082: Quality gate enhancement
-- Exemption mechanism, override persistence, trend analysis snapshots
```

## 五、前端设计

### 5.1 质量门禁仪表盘

**路由**: `/quality-gates/dashboard`

**页面结构**:
```
┌─────────────────────────────────────────────┐
│  质量门禁仪表盘                              │
├─────────────────────────────────────────────┤
│                                              │
│  总览 (最近 7 天)                             │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐        │
│  │ 通过率  │ │ 总评估  │ │ 违规数  │        │
│  │  87.3%  │ │  1,245  │ │   89    │        │
│  │ ↑ 3.2%  │ │ → +120  │ │ ↓ 15    │        │
│  └─────────┘ └─────────┘ └─────────┘        │
│                                              │
│  通过率趋势 (30 天)                           │
│  ┌────────────────────────────────────────┐  │
│  │ 📈 折线图: 82% → 85% → 87% → 89% → 87%  │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  违规分布                                     │
│  ┌──────────────────┐ ┌──────────────────┐   │
│  │ 按严重度          │ │ 按 Policy        │   │
│  │ 🔴 Critical:  5  │ │ Security:   45%  │   │
│  │ 🟠 High:     12  │ │ Coverage:   30%  │   │
│  │ 🟡 Medium:   28  │ │ Style:      15%  │   │
│  │ 🟢 Low:      44  │ │ Performance: 10% │   │
│  └──────────────────┘ └──────────────────┘   │
│                                              │
│  Top 5 频繁失败 Policy                        │
│  ┌────────────────────────────────────────┐  │
│  │ Policy           │ 失败率 │ 次数 │ 建议  │  │
│  │ Security Scan    │  45%   │  56  │ 🔧   │  │
│  │ Code Coverage    │  38%   │  47  │ 📝   │  │
│  │ License Check    │  22%   │  27  │ ⚙️   │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  豁免管理                                     │
│  ┌────────────────────────────────────────┐  │
│  │ 活跃: 12  审批中: 3  已过期: 8           │  │
│  │ [申请豁免] [查看列表]                    │  │
│  └────────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

### 5.2 豁免申请页面

**路由**: `/quality-gates/exemptions/new`

**页面结构**:
```
┌─────────────────────────────────────────────┐
│  申请豁免                                    │
├─────────────────────────────────────────────┤
│                                              │
│  关联违规: [select: violation-abc123 ▼]      │
│  违规详情: Security Scan - CVE-2026-1234      │
│                                              │
│  豁免类型:                                    │
│  ○ 业务紧急  ○ 技术债务  ○ 误报  ○ 临时     │
│                                              │
│  有效期: [○ 24h 自动过期] [● 自定义]          │
│  过期时间: [2026-05-12 10:00]               │
│                                              │
│  豁免原因:                                    │
│  ┌────────────────────────────────────────┐  │
│  │ 该漏洞仅影响测试环境，生产环境不受影响... │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  附件: [上传文件]                             │
│                                              │
│  [取消] [提交申请]                           │
└─────────────────────────────────────────────┘
```

### 5.3 前端文件变更

| 文件 | 操作 | 描述 |
|------|------|------|
| `src/pages/QualityGateDashboard/index.tsx` | 新建 | 质量门禁仪表盘 |
| `src/pages/ExemptionRequest/index.tsx` | 新建 | 豁免申请 + 审批页面 |
| `src/pages/QualityGateTrend/index.tsx` | 新建 | 趋势分析页面 |
| `src/api/qualityGate.ts` | 新建 | 质量门禁 API 客户端 |
| `src/components/PassRateChart/index.tsx` | 新建 | 通过率趋势图组件 |
| `src/components/ViolationPie/index.tsx` | 新建 | 违规分布饼图组件 |
| `src/components/ExemptionApproval/index.tsx` | 新建 | 豁免审批组件 |

## 六、测试策略

### 6.1 单元测试

| 模块 | 文件 | 测试用例 |
|------|------|----------|
| ExemptionService | `services/policy/ExemptionService.ts` | 申请/审批/过期/撤销（12 cases） |
| QualityGateTrendService | `services/policy/QualityGateTrendService.ts` | 趋势计算/分布统计/建议生成（10 cases） |
| OverrideRepository | `repositories/PolicyOverrideRepository.ts` | CRUD/过期清理（6 cases） |

### 6.2 集成测试

| 场景 | 描述 |
|------|------|
| 豁免完整流程 | 申请 → 审批通过 → 违规状态变更 → 到期自动失效 |
| Pipeline 门禁集成 | Run 完成 → 触发评估 → 门禁失败 → 阻断部署 |
| 趋势快照生成 | 每日定时任务 → 生成快照 → 趋势查询返回正确数据 |

### 6.3 E2E 测试

| 场景 | 描述 |
|------|------|
| 质量门禁仪表盘 E2E | 查看通过率 → 筛选时间范围 → 验证数据更新 |
| 豁免申请 E2E | 选择违规 → 填写原因 → 提交 → 审批 → 验证状态 |

## 七、非功能性要求

### 7.1 性能

| 指标 | 目标 |
|------|------|
| 趋势查询响应 | < 200ms（90 天数据） |
| 豁免审批响应 | < 100ms |
| 快照生成 | < 5s（全量计算） |

### 7.2 安全性

| 要求 | 实现 |
|------|------|
| 审批权限 | 豁免申请需 member 权限，审批需 admin 权限 |
| 审计日志 | 豁免申请/审批/撤销均写入审计日志 |
| 数据隔离 | 所有查询按 tenant_id 过滤 |

### 7.3 可维护性

| 要求 | 实现 |
|------|------|
| 代码覆盖率 | > 80% |
| Override 迁移 | 从 Map 迁移到 PostgreSQL，保持 API 兼容 |

## 八、实施计划

| 模块 | 后端 (天) | 前端 (天) | 测试 (天) |
|------|:---------:|:---------:|:---------:|
| 豁免机制 | 2 | 2 | 1 |
| 趋势分析 | 1.5 | 2 | 1 |
| Override 持久化 | 0.5 | 0.5 | 0.5 |
| Pipeline 集成 | 1 | 0.5 | 0.5 |
| **合计** | **5** | **5** | **3** |

---

_文档版本: v1.0 | 创建日期: 2026-05-05 | 状态: 编写中_
