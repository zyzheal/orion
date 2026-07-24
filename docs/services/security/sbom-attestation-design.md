# SBOM Attestation & Supply Chain Provenance - 设计文档

## 1. 概述

### 1.1 愿景
自动为每次构建生成 SBOM（软件物料清单），通过加密签名实现供应链溯源，并在发现漏洞时自动阻止部署。满足美国 EO 14028 和欧盟 CRA 合规要求。

### 1.2 核心价值
- **合规驱动** — 自动生成 SPDX/CycloneDX 格式 SBOM，满足法规强制要求
- **安全门禁** — 基于 SBOM 的漏洞扫描结果自动阻止不安全制品进入下游阶段
- **溯源能力** — 通过 Sigstore/cosign 实现无密钥签名，确保 SBOM 不可篡改

### 1.3 用户角色
- **安全工程师** — 查看 SBOM 合规报告、管理豁免策略
- **研发工程师** — 查看构建产物依赖清单、处理漏洞告警
- **运维/SRE** — 配置 SBOM 扫描策略、管理 attestation 生命周期

## 2. 架构设计

### 2.1 组件分解

```
┌─────────────────────────────────────────────────────────────┐
│                        Pipeline Stage 2 (Build)              │
│                                                              │
│  ┌──────────┐    ┌──────────┐    ┌──────────────────────┐   │
│  │ Syft     │───▶│ CycloneDX│───▶│ SBOM Attestation     │   │
│  │ (生成)    │    │ (转换)    │    │ Service (Sigstore)   │   │
│  └──────────┘    └──────────┘    └──────────┬───────────┘   │
│                                              │               │
│  ┌──────────────────────────────────────────┐│               │
│  │ Grype (漏洞扫描) ───▶ Policy Gate       │◀┘               │
│  └──────────────────────────────────────────┘                │
└─────────────────────────────────────────────────────────────┘
         │                          │
         ▼                          ▼
┌─────────────────┐    ┌──────────────────────┐
│ SBOM Storage    │    │ Attestation Registry │
│ (PostgreSQL)    │    │ (Sigstore Fulcio)    │
└─────────────────┘    └──────────────────────┘
```

### 2.2 集成点
- **Pipeline 引擎 (M5)** — 作为 Stage 2 构建后的强制阶段
- **插件 SPI (M15)** — SBOM 生成器插件接口（Syft, CycloneDX, SPDX 等）
- **安全合规 (M18)** — 策略执行与漏洞阻断
- **制品管理 (M29)** — SBOM 作为构建产物关联存储
- **审批工作台 (M3)** — 部署门禁的合规检查输入

## 3. 数据模型

### 3.1 PostgreSQL 表

```sql
-- SBOM 文档主表
CREATE TABLE sbom_documents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  build_id        UUID NOT NULL REFERENCES builds(id),
  pipeline_run_id UUID NOT NULL REFERENCES pipeline_runs(id),
  format          VARCHAR(20) NOT NULL,              -- spdx | cyclonedx
  spec_version    VARCHAR(10) NOT NULL,              -- e.g. "2.3", "1.4"
  document_id     VARCHAR(255) NOT NULL UNIQUE,       -- URI-style identifier
  content         JSONB NOT NULL,                     -- Full SBOM JSON
  package_count   INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at      TIMESTAMPTZ,
  status          VARCHAR(20) NOT NULL DEFAULT 'active'  -- active | expired | revoked
);

-- SBOM 包清单
CREATE TABLE sbom_packages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sbom_id         UUID NOT NULL REFERENCES sbom_documents(id) ON DELETE CASCADE,
  name            VARCHAR(255) NOT NULL,
  version         VARCHAR(50) NOT NULL,
  purl            VARCHAR(500),                       -- Package URL
  cpe             VARCHAR(255),                       -- Common Platform Enumeration
  license         VARCHAR(100),
  supplier        VARCHAR(255),
  source_location VARCHAR(500),                       -- Git repo URL
  checksum        VARCHAR(128)                        -- SHA-256 digest
);
CREATE INDEX idx_sbom_packages_sbom_id ON sbom_packages(sbom_id);
CREATE INDEX idx_sbom_packages_purl ON sbom_packages(purl);

-- SBOM 签名证明
CREATE TABLE sbom_attestations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sbom_id         UUID NOT NULL REFERENCES sbom_documents(id) ON DELETE CASCADE,
  attestation_type VARCHAR(50) NOT NULL,              -- sigstore-cosign | in-toto
  signature       TEXT NOT NULL,                       -- Base64 encoded signature
  certificate     TEXT,                                -- Fulcio certificate
  transparency_log_url TEXT,                           -- Rekor transparency log
  signed_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  verified        BOOLEAN NOT NULL DEFAULT false,
  verified_at     TIMESTAMPTZ
);

-- 漏洞扫描结果
CREATE TABLE sbom_vulnerability_results (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sbom_id         UUID NOT NULL REFERENCES sbom_documents(id) ON DELETE CASCADE,
  scanner         VARCHAR(50) NOT NULL DEFAULT 'grype',
  scanned_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  total_vulns     INT NOT NULL DEFAULT 0,
  critical_count  INT NOT NULL DEFAULT 0,
  high_count      INT NOT NULL DEFAULT 0,
  medium_count    INT NOT NULL DEFAULT 0,
  low_count       INT NOT NULL DEFAULT 0,
  gate_passed     BOOLEAN NOT NULL,
  gate_policy     VARCHAR(50)                         -- e.g. "block-critical"
);

-- 漏洞详情
CREATE TABLE sbom_vulnerability_details (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  result_id       UUID NOT NULL REFERENCES sbom_vulnerability_results(id) ON DELETE CASCADE,
  cve_id          VARCHAR(20) NOT NULL,
  severity        VARCHAR(10) NOT NULL,                -- critical | high | medium | low
  cvss_score      DECIMAL(3,1),
  affected_package VARCHAR(255) NOT NULL,
  fixed_version   VARCHAR(50),                         -- Available fix version
  description     TEXT,
  references      JSONB                                -- CVE links
);

-- 漏洞豁免
CREATE TABLE sbom_waivers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cve_id          VARCHAR(20) NOT NULL,
  package_name    VARCHAR(255) NOT NULL,
  package_version VARCHAR(50) NOT NULL,
  reason          TEXT NOT NULL,
  approved_by     UUID NOT NULL REFERENCES users(id),
  approved_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at      TIMESTAMPTZ NOT NULL,
  scope           VARCHAR(50) DEFAULT 'global',        -- global | project | environment
  scope_target    VARCHAR(100)                         -- project_id or env_name
);

-- 供应链溯源
CREATE TABLE sbom_provenance (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  build_id        UUID NOT NULL REFERENCES builds(id),
  provenance_type VARCHAR(20) NOT NULL DEFAULT 'slsa', -- slsa | in-toto
  content         JSONB NOT NULL,                      -- SLSA provenance JSON
  signature       TEXT NOT NULL,
  builder_id      VARCHAR(255) NOT NULL,
  build_trigger   VARCHAR(50) NOT NULL,                -- manual | schedule | webhook
  source_uri      VARCHAR(500) NOT NULL,               -- Git source URI
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

## 4. API 设计

### 4.1 SBOM 文档

```
GET    /api/v1/sbom/documents?buildId=&format=&status=&page=&perPage=
POST   /api/v1/sbom/documents                           # 创建 (pipeline 内部调用)
GET    /api/v1/sbom/documents/:id
GET    /api/v1/sbom/documents/:id/packages              # 包清单
GET    /api/v1/sbom/documents/:id/download?format=spdx|cyclonedx  # 下载
DELETE /api/v1/sbom/documents/:id                       # 撤销
```

### 4.2 Attestation

```
POST   /api/v1/sbom/attestations/:sbomId/sign           # 签名
GET    /api/v1/sbom/attestations/:sbomId                 # 获取签名
POST   /api/v1/sbom/attestations/:sbomId/verify          # 验证
```

### 4.3 漏洞扫描

```
POST   /api/v1/sbom/vulnerability/scan                   # 触发扫描 (body: sbomId)
GET    /api/v1/sbom/vulnerability/results?sbomId=        # 扫描结果
GET    /api/v1/sbom/vulnerability/results/:id/details    # 漏洞详情
POST   /api/v1/sbom/vulnerability/gate/check             # 门禁检查 (body: sbomId, policy)
```

### 4.4 豁免管理

```
GET/POST /api/v1/sbom/waivers                            # 豁免 CRUD
GET/PUT/DELETE /api/v1/sbom/waivers/:id
GET    /api/v1/sbom/waivers/active?scope=&target=        # 有效豁免
```

### 4.5 溯源

```
POST   /api/v1/sbom/provenance                            # 创建溯源
GET    /api/v1/sbom/provenance?buildId=                   # 查询溯源
GET    /api/v1/sbom/provenance/:id/verify                 # 验证溯源
```

### 4.6 合规报告

```
GET    /api/v1/sbom/compliance/report?startDate=&endDate=&scope=  # 合规报告
GET    /api/v1/sbom/compliance/eo14028                    # EO 14028 合规状态
GET    /api/v1/sbom/compliance/eu-cra                     # EU CRA 合规状态
```

### 4.7 Pipeline 门禁

```
POST   /api/v1/sbom/gate/evaluate?buildId=                # 评估构建门禁
GET    /api/v1/sbom/gate/history?buildId=                 # 门禁历史
```

## 5. Pipeline 集成

### 5.1 Stage 2 (Build) 集成

SBOM 作为构建后的强制子阶段：

```yaml
# Tekton Task 定义
apiVersion: tekton.dev/v1beta1
kind: Task
metadata:
  name: generate-sbom
spec:
  steps:
    - name: generate-sbom
      image: anchore/syft:latest
      script: |
        syft $(params.artifact) -o cyclonedx-json > sbom.json
    - name: sign-sbom
      image: gcr.io/projectsigstore/cosign:latest
      script: |
        cosign sign-blob --yes sbom.json > sbom.sig
    - name: scan-vulnerabilities
      image: anchore/grype:latest
      script: |
        grype sbom:sbom.json --fail-on=$(params.failThreshold)
```

### 5.2 策略矩阵

| 环境 | 阻断级别 | 豁免策略 |
|------|----------|----------|
| Development | 不阻断（仅告警） | 自动豁免 |
| Staging | 阻断 Critical | 安全团队审批 |
| Production | 阻断 Critical + High | CISO 审批 + 时效豁免 |

## 6. UI/UX 设计

### 6.1 供应链仪表盘 (`/sbom/dashboard`)

- 合规概览卡片：总构建数、SBOM 覆盖率、漏洞趋势、合规评分
- SBOM 列表：构建 ID、格式、包数量、漏洞数、状态、操作（查看/下载）
- 合规报告：EO 14028 / EU CRA 合规状态表格 + 导出 PDF

### 6.2 SBOM 详情 (`/sbom/documents/:id`)

- 文档信息：格式、版本、构建 ID、创建时间
- 包清单：表格（名称、版本、许可证、漏洞数），可搜索过滤
- 漏洞扫描：严重级别分布图 + 漏洞列表（CVE ID、严重级别、修复版本）
- 签名证明：签名状态、证书信息、透明日志链接
- 操作：下载 SBOM、重新扫描、申请豁免

### 6.3 豁免管理 (`/sbom/waivers`)

- 豁免列表：CVE、包名、范围、审批人、有效期、状态
- 创建豁免：表单（CVE 搜索、包选择、原因输入、范围选择、有效期）

## 7. 安全与权限

| 权限 | 角色 |
|------|------|
| `sbom:read` | developer, tech_lead, sre, security, auditor, admin |
| `sbom:download` | developer, tech_lead, sre, security, admin |
| `sbom:scan` | sre, security, admin |
| `sbom:waiver:create` | security, admin |
| `sbom:waiver:approve` | security_lead, admin |
| `sbom:provenance:verify` | sre, security, auditor, admin |
| `sbom:compliance:report` | security, auditor, admin |

## 8. 测试策略

- **L1 单元** — SBOM 解析器、签名验证、漏洞匹配、豁免逻辑
- **L2 集成** — Syft 集成、Grype 扫描、Sigstore 签名、Pipeline 触发
- **L3 E2E** — 完整构建流程：构建 → 生成 SBOM → 签名 → 扫描 → 门禁 → 部署
- **L4 合规** — EO 14028 / EU CRA 合规检查自动化验证
- **L5 性能** — 大 SBOM（10000+ 包）解析 < 10s，签名验证 < 1s
