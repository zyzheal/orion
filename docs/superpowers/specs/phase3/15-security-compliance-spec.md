# 安全合规详细规格 (Phase 3)

> **日期**: 2026-05-05
> **状态**: 编写中
> **能力域**: 15. 安全合规
> **目标成熟度**: L2 → L2.5
> **关键交付**: 自动化合规

## 一、功能描述

### 1.1 现状评估 (L2)

Orion 当前安全能力：
- 安全扫描（`services/security/SecurityScannerService.ts`）
- OPA 策略引擎（`api/policy-routes.ts`）
- AI 安全加固（`api/ai-security-routes.ts`）
- RBAC 权限控制（`api/role-routes.ts`）
- 审计日志（`api/audit-routes.ts`）
- API Key 管理（`api/api-key-routes.ts`）

**不足**：
- 无合规框架自动化检查（SOC2、ISO27001、GDPR）
- 无合规报告自动生成
- 无合规差距追踪与 remediation 工作流
- 无持续合规监控

### 1.2 Phase 3 目标 (L2.5)

| 功能模块 | 描述 | 验收等级 |
|----------|------|:--------:|
| 合规框架 | SOC2、ISO27001、GDPR 自动化检查 | L2.5 |
| 合规报告 | 自动生成合规状态报告 | L2.5 |
| 差距追踪 | 合规差距发现→分配→修复→验证工作流 | L2.5 |
| 持续监控 | 实时合规状态监控与告警 | L2.5 |

## 二、验收标准

| # | 标准 | 验证方式 |
|---|------|----------|
| SC1 | 合规框架覆盖 3+ 标准：SOC2、ISO27001、GDPR | API 测试 |
| SC2 | 每个标准含 10+ 检查项，自动评估合规状态 | 单元测试 |
| SC3 | 合规报告自动生成（PDF/JSON），含覆盖率、差距、趋势 | API 测试 |
| SC4 | 差距追踪：发现→分配→修复→验证闭环工作流 | 集成测试 |
| SC5 | 持续监控：每 24 小时自动运行合规检查 | 集成测试 |
| SC6 | 合规告警：关键不合规项即时通知负责人 | 集成测试 |
| SC7 | 审计证据自动采集：配置、日志、策略执行记录 | API 测试 |

## 三、API 设计

```
Base: /api/v1/compliance
```

| 方法 | 路径 | 描述 | 请求体 | 响应 |
|------|------|------|--------|------|
| GET | `/frameworks` | 获取合规框架列表 | - | `{ data: ComplianceFramework[] }` |
| GET | `/frameworks/:id/checks` | 获取框架检查项 | - | `{ data: ComplianceCheck[] }` |
| POST | `/assessments/run` | 执行合规评估 | `{ frameworkId, scope? }` | `{ assessmentId, status }` |
| GET | `/assessments/:id` | 获取评估结果 | - | `ComplianceAssessment` |
| GET | `/assessments/:id/report` | 获取合规报告 | query: format | `{ content, format }` |
| GET | `/gaps` | 获取合规差距列表 | query: framework, severity | `{ data: ComplianceGap[], total }` |
| POST | `/gaps/:id/remediate` | 创建修复任务 | `{ assignee, dueDate }` | `{ taskId }` |
| GET | `/gaps/:id/evidence` | 获取审计证据 | - | `{ evidence: Evidence[] }` |
| GET | `/dashboard` | 获取合规仪表盘 | - | `ComplianceDashboard` |
| GET | `/monitoring` | 获取持续监控状态 | - | `{ lastCheck, status, alerts }` |

```typescript
interface ComplianceFramework {
  id: string;
  name: string;             // 'soc2' | 'iso27001' | 'gdpr'
  displayName: string;
  description: string;
  version: string;
  checkCount: number;
  lastAssessedAt?: Date;
  overallScore: number;     // 0-100
}

interface ComplianceCheck {
  id: string;
  frameworkId: string;
  controlId: string;        // 'CC6.1', 'A.9.1', etc.
  title: string;
  description: string;
  category: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  autoCheckable: boolean;
  checkMethod: 'api' | 'config' | 'log' | 'manual';
  checkConfig: Record<string, unknown>;
}

interface ComplianceAssessment {
  id: string;
  frameworkId: string;
  status: 'running' | 'completed' | 'failed';
  totalChecks: number;
  passedChecks: number;
  failedChecks: number;
  skippedChecks: number;
  score: number;
  gaps: ComplianceGap[];
  startedAt: Date;
  completedAt?: Date;
}

interface ComplianceGap {
  id: string;
  assessmentId: string;
  checkId: string;
  controlId: string;
  title: string;
  severity: string;
  description: string;
  evidence: Evidence[];
  remediationTaskId?: string;
  status: 'open' | 'assigned' | 'in_progress' | 'resolved' | 'accepted';
  identifiedAt: Date;
  resolvedAt?: Date;
}

interface Evidence {
  id: string;
  type: 'config' | 'log' | 'policy' | 'screenshot';
  source: string;
  content: string;
  collectedAt: Date;
}

interface ComplianceDashboard {
  overallScore: number;
  frameworks: {
    frameworkId: string;
    name: string;
    score: number;
    passedPercent: number;
    gapCount: number;
  }[];
  openGaps: number;
  criticalGaps: number;
  trend: { date: string; score: number }[];
  lastAssessmentAt: Date;
}
```

## 四、数据库变更

```sql
-- Migration 115: Security Compliance
CREATE TABLE IF NOT EXISTS compliance_frameworks (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  VARCHAR(50) NOT NULL UNIQUE,
  display_name          VARCHAR(200),
  description           TEXT,
  version               VARCHAR(20),
  overall_score         INT DEFAULT 0,
  last_assessed_at      TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS compliance_checks (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  framework_id          UUID NOT NULL REFERENCES compliance_frameworks(id),
  control_id            VARCHAR(50) NOT NULL,
  title                 VARCHAR(300),
  description           TEXT,
  category              VARCHAR(50),
  severity              VARCHAR(20),
  auto_checkable        BOOLEAN DEFAULT false,
  check_method          VARCHAR(20),
  check_config          JSONB DEFAULT '{}'
);
CREATE INDEX idx_compliance_checks_framework ON compliance_checks(framework_id);

CREATE TABLE IF NOT EXISTS compliance_assessments (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES tenants(id),
  framework_id          UUID NOT NULL REFERENCES compliance_frameworks(id),
  status                VARCHAR(20) DEFAULT 'running',
  total_checks          INT DEFAULT 0,
  passed_checks         INT DEFAULT 0,
  failed_checks         INT DEFAULT 0,
  skipped_checks        INT DEFAULT 0,
  score                 INT DEFAULT 0,
  gaps                  JSONB DEFAULT '[]',
  started_at            TIMESTAMPTZ DEFAULT now(),
  completed_at          TIMESTAMPTZ
);
CREATE INDEX idx_compliance_assessments_tenant ON compliance_assessments(tenant_id, started_at DESC);

CREATE TABLE IF NOT EXISTS compliance_gaps (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES tenants(id),
  assessment_id         UUID REFERENCES compliance_assessments(id),
  check_id              UUID REFERENCES compliance_checks(id),
  control_id            VARCHAR(50),
  title                 VARCHAR(300),
  severity              VARCHAR(20),
  description           TEXT,
  evidence              JSONB DEFAULT '[]',
  remediation_task_id   UUID,
  status                VARCHAR(20) DEFAULT 'open',
  identified_at         TIMESTAMPTZ DEFAULT now(),
  resolved_at           TIMESTAMPTZ
);
CREATE INDEX idx_compliance_gaps_tenant ON compliance_gaps(tenant_id, status);

CREATE TABLE IF NOT EXISTS compliance_evidence (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gap_id                UUID REFERENCES compliance_gaps(id),
  evidence_type         VARCHAR(20),
  source                VARCHAR(200),
  content               TEXT,
  collected_at          TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_compliance_evidence_gap ON compliance_evidence(gap_id);
```

## 五、前端设计

**路由**: `/compliance`

```
┌─────────────────────────────────────────────┐
│  安全合规                                    │
├─────────────────────────────────────────────┤
│  总体合规评分: 82/100  [▓▓▓▓▓▓▓▓░░]         │
├─────────────────────────────────────────────┤
│  合规框架                                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐     │
│  │ SOC2     │ │ ISO27001 │ │ GDPR     │     │
│  │ 85/100   │ │ 78/100   │ │ 83/100   │     │
│  │ ✅ 24/28 │ │ ⚠️ 18/23 │ │ ✅ 15/18 │     │
│  │ [详情]   │ │ [详情]   │ │ [详情]   │     │
│  └──────────┘ └──────────┘ └──────────┘     │
│                                              │
│  待修复差距: 7 个 | 关键: 2 个                │
│  ┌────────────────────────────────────────┐  │
│  │ CC6.1  访问控制  🔴 关键  未分配        │  │
│  │ A.9.2  密码策略  🟡 中    修复中 05/10  │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  [生成报告] [执行评估] [查看证据]              │
└─────────────────────────────────────────────┘
```

| 文件 | 操作 | 描述 |
|------|------|------|
| `src/pages/Compliance/index.tsx` | 新建 | 安全合规主页面 |
| `src/pages/ComplianceReport/index.tsx` | 新建 | 合规报告页面 |
| `src/pages/GapManagement/index.tsx` | 新建 | 差距管理页面 |
| `src/components/ComplianceScore/index.tsx` | 新建 | 合规评分组件 |
| `src/api/compliance.ts` | 新建 | 合规 API |

## 六、测试策略

| 类型 | 用例数 | 描述 |
|------|:------:|------|
| 单元测试 | 15 | ComplianceChecker、GapTracker、EvidenceCollector |
| 集成测试 | 4 | 评估→差距→修复→验证完整流程 |

## 七、非功能性要求

| 指标 | 目标 |
|------|------|
| 评估执行时间 | < 5 分钟（单框架） |
| 报告生成 | < 30s |
| 监控频率 | 每 24 小时 |
| 告警延迟 | < 5 分钟 |

## 八、实施计划

| 模块 | 后端 (天) | 前端 (天) | 测试 (天) |
|------|:---------:|:---------:|:---------:|
| 合规框架 | 3 | 1 | 2 |
| 评估引擎 | 2 | 1 | 1 |
| 差距追踪 | 2 | 2 | 1 |
| 报告生成 | 1 | 2 | 1 |
| 持续监控 | 1 | 1 | 0.5 |
| **合计** | **9** | **7** | **5.5** |

---

_文档版本: v1.0 | 创建日期: 2026-05-05_
