# 供应链安全详细规格 (Phase 3)

> **日期**: 2026-05-05
> **状态**: 实施中
> **能力域**: 2. 供应链安全
> **目标成熟度**: L2 → L2.5
> **关键交付**: 投毒检测、构建证明

## 一、功能描述

### 1.1 现状评估 (L2)

Orion 当前已实现：
- SBOM 生成与存储（`services/security/SecurityScannerService.ts`，`db/migrations/026_create_sbom_tables.sql`）
- SAST/SAST/依赖扫描（SecurityScannerService 集成 Gitleaks/Semgrep/Trivy）
- Secret 检测与脱敏（SecretSanitizer）
- SBOM API（`api/sbom-routes.ts`）
- 安全门禁（SecurityGateService）

**不足**：
- 无构建过程可追溯性（缺少 SLSA provenance）
- 无依赖投毒检测（typosquatting、恶意包上传）
- 无构建证明（build attestation）机制
- 缺少供应链风险评分与趋势分析

### 1.2 Phase 3 目标 (L2.5)

| 功能模块 | 描述 | 验收等级 |
|----------|------|:--------:|
| 投毒检测 | Typosquatting、恶意包、异常依赖版本检测 | L2.5 |
| 构建证明 | SLSA provenance 生成与验证 | L2.5 |
| 供应链风险评分 | 基于依赖健康度/漏洞/维护者信誉评分 | L2.5 |
| 依赖追踪图谱 | 依赖关系可视化、传递依赖追踪 | L2.5 |

## 二、验收标准

| # | 标准 | 验证方式 |
|---|------|----------|
| S1 | 投毒检测覆盖 3 类攻击：typosquatting、恶意版本、已知攻击者包 | 集成测试 |
| S2 | 构建证明符合 SLSA Level 2（构建来源、参数、产物 hash） | API 测试 |
| S3 | 供应链风险评分 0-100，基于漏洞密度/依赖健康度 | API 测试 |
| S4 | 依赖图谱展示直接+传递依赖（最大深度 5 层） | 前端验证 |
| S5 | 每个 artifact 关联完整 SBOM + provenance | 集成测试 |
| S6 | 新依赖引入时自动进行安全评分 | 单元测试 |
| S7 | 已知恶意包数据库每日更新（对接 OSV/NSQ） | 集成测试 |

## 三、API 设计

```
Base: /api/v1/supply-chain
```

| 方法 | 路径 | 描述 | 请求体 | 响应 |
|------|------|------|--------|------|
| GET | `/risk-score` | 获取供应链风险评分 | query: projectId | `{ score, breakdown, trend }` |
| POST | `/attestation/generate` | 生成构建证明 | `AttestationRequest` | `{ attestation, provenance }` |
| GET | `/attestation/:artifactId` | 获取制品构建证明 | - | `AttestationRecord` |
| POST | `/poisoning/scan` | 触发投毒检测 | `{ dependencies, packageManager }` | `{ risks, blockedPackages }` |
| GET | `/dependency-graph` | 获取依赖图谱 | query: projectId, depth | `{ nodes, edges }` |
| GET | `/malicious-db` | 查询已知恶意包 | query: name, version | `{ matches, lastUpdated }` |
| GET | `/artifacts/:id/supply-chain` | 制品供应链信息 | - | `{ sbom, attestation, riskScore }` |

```typescript
interface SupplyChainRiskScore {
  score: number;              // 0-100
  vulnerabilityScore: number;  // 漏洞维度
  dependencyHealthScore: number; // 依赖健康度
  provenanceScore: number;     // 构建证明完整性
  trend: 'improving' | 'stable' | 'degrading';
}

interface AttestationRequest {
  artifactId: string;
  buildSystem: string;         // 'tekton' | 'jenkins' | 'github-actions'
  buildSteps: BuildStep[];
  sourceDigest: string;        // git commit sha
  outputDigests: string[];     // 产物 hash
}

interface BuildStep {
  name: string;
  command: string;
  durationMs: number;
  digest: string;              // 步骤产物 hash
}

interface AttestationRecord {
  id: string;
  artifactId: string;
  slsaLevel: number;           // SLSA 级别
  builder: string;
  buildType: string;
  buildStartedOn: Date;
  buildFinishedOn: Date;
  invocation: Record<string, unknown>;
  buildConfig: Record<string, unknown>;
  materials: { name: string; digest: string; uri: string }[];
  provenance: string;          // 签名后的 provenance JSON
  verified: boolean;
}

interface PoisoningScanResult {
  risks: PoisoningRisk[];
  blockedPackages: string[];
  scanId: string;
  scannedAt: Date;
}

interface PoisoningRisk {
  packageName: string;
  version: string;
  riskType: 'typosquatting' | 'malicious' | 'compromised_maintainer' | 'suspicious_update';
  confidence: number;
  evidence: string;
  severity: 'critical' | 'high' | 'medium';
}

interface DependencyNode {
  name: string;
  version: string;
  riskScore: number;
  depth: number;
  isDirect: boolean;
}

interface DependencyGraph {
  nodes: DependencyNode[];
  edges: { from: string; to: string }[];
  totalDependencies: number;
  highRiskCount: number;
}
```

## 四、数据库变更

```sql
-- Migration 102: Supply Chain Security
CREATE TABLE IF NOT EXISTS build_attestations (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES tenants(id),
  artifact_id           UUID NOT NULL,
  slsa_level            INT DEFAULT 2,
  builder               VARCHAR(200),
  build_type            VARCHAR(100),
  build_started_on      TIMESTAMPTZ,
  build_finished_on     TIMESTAMPTZ,
  invocation            JSONB DEFAULT '{}',
  build_config          JSONB DEFAULT '{}',
  materials             JSONB DEFAULT '[]',
  provenance            TEXT,
  signature             TEXT,
  verified              BOOLEAN DEFAULT false,
  created_at            TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_build_attestations_artifact ON build_attestations(artifact_id);

CREATE TABLE IF NOT EXISTS poisoning_scan_results (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES tenants(id),
  scan_id               UUID NOT NULL,
  package_manager       VARCHAR(50),
  risks                 JSONB DEFAULT '[]',
  blocked_packages      TEXT[] DEFAULT '{}',
  scanned_at            TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_poisoning_scan_tenant ON poisoning_scan_results(tenant_id, scanned_at DESC);

CREATE TABLE IF NOT EXISTS supply_chain_scores (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES tenants(id),
  project_id            UUID,
  score                 INT NOT NULL,
  vulnerability_score   INT,
  dependency_health_score INT,
  provenance_score      INT,
  trend                 VARCHAR(20),
  calculated_at         TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_supply_chain_scores_project ON supply_chain_scores(project_id, calculated_at DESC);

CREATE TABLE IF NOT EXISTS malicious_packages (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_name          VARCHAR(500) NOT NULL,
  version               VARCHAR(100),
  ecosystem             VARCHAR(50),  -- npm, pypi, maven, etc.
  risk_type             VARCHAR(100),
  source                VARCHAR(200), -- OSV, NSQ, internal
  description           TEXT,
  published_at          TIMESTAMPTZ,
  synced_at             TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_malicious_packages_name ON malicious_packages(package_name);
```

## 五、前端设计

**路由**: `/supply-chain-security`

```
┌─────────────────────────────────────────────┐
│  供应链安全                                  │
├─────────────────────────────────────────────┤
│  风险评分: 72/100  [▓▓▓▓▓▓▓░░░]  ↓ 需关注  │
│  漏洞 12 | 高风险依赖 3 | 未验证制品 5       │
├─────────────────────────────────────────────┤
│  依赖图谱                                    │
│  ┌────────────────────────────────────────┐  │
│  │  ● express@4.18 (risk: 15)             │  │
│  │   ├── ● body-parser@1.20 (risk: 8)     │  │
│  │   ├── ● cookie@0.5 (risk: 5)           │  │
│  │   └── ⚠ debug@4.3 (risk: 65) [投毒!]  │  │
│  │      └── ● ms@2.1 (risk: 3)            │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  构建证明                                    │
│  ┌────────────────────────────────────────┐  │
│  │ app:v1.2.3  SLSA L2 ✅ 已验证          │  │
│  │ Builder: tekton  Source: abc1234       │  │
│  └────────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

| 文件 | 操作 | 描述 |
|------|------|------|
| `src/pages/SupplyChainSecurity/index.tsx` | 新建 | 供应链安全主页面 |
| `src/pages/DependencyGraph/index.tsx` | 新建 | 依赖图谱可视化 |
| `src/components/DependencyGraphViz/index.tsx` | 新建 | D3.js 依赖图组件 |
| `src/components/RiskScoreCard/index.tsx` | 新建 | 风险评分卡片 |
| `src/api/supply-chain.ts` | 新建 | 供应链安全 API |

## 六、测试策略

| 类型 | 用例数 | 描述 |
|------|:------:|------|
| 单元测试 | 18 | PoisoningDetector、AttestationGenerator、RiskScorer |
| 集成测试 | 6 | 投毒检测→阻断→告警完整流程 |
| E2E 测试 | 3 | 前端查看依赖图谱→定位风险→查看详情 |

## 七、非功能性要求

| 指标 | 目标 |
|------|------|
| 投毒检测响应 | < 2s（单次扫描 100 个依赖） |
| 恶意包数据库更新 | 每日自动同步 |
| 构建证明生成 | < 1s |
| 依赖图谱加载 | < 3s（500 节点） |

## 八、实施计划

| 模块 | 后端 (天) | 前端 (天) | 测试 (天) |
|------|:---------:|:---------:|:---------:|
| 投毒检测 | 4 | 1 | 2 |
| 构建证明 | 3 | 1 | 1 |
| 风险评分 | 2 | 1 | 1 |
| 依赖图谱 | 1 | 3 | 1 |
| **合计** | **10** | **6** | **5** |

---

_文档版本: v1.0 | 创建日期: 2026-05-05_
