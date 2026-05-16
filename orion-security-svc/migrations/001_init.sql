-- Migration 001: Security Service Core Tables
-- Creates tables for SBOM, Policy, Risk Assessment, and Supply Chain Security
-- Includes tables from orion-security-svc services
-- tenant_id convention: UUID NOT NULL per docs/standards/database-conventions.md

-- ==================== SBOM Tables ====================

-- SBOM 文档主表 (from 026_create_sbom_tables.sql)
CREATE TABLE IF NOT EXISTS sbom_documents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  build_id        UUID NOT NULL,
  pipeline_run_id UUID NOT NULL,
  format          VARCHAR(20) NOT NULL,              -- spdx | cyclonedx
  spec_version    VARCHAR(10) NOT NULL,              -- e.g. "2.3", "1.4"
  document_id     VARCHAR(255) NOT NULL UNIQUE,       -- URI-style identifier
  content         JSONB NOT NULL,                     -- Full SBOM JSON
  package_count   INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at      TIMESTAMPTZ,
  status          VARCHAR(20) NOT NULL DEFAULT 'active',  -- active | expired | revoked
  tenant_id       UUID NOT NULL
);
CREATE INDEX idx_sbom_documents_build_id ON sbom_documents(build_id);
CREATE INDEX idx_sbom_documents_pipeline_run_id ON sbom_documents(pipeline_run_id);
CREATE INDEX idx_sbom_documents_tenant_id ON sbom_documents(tenant_id);

-- SBOM 包清单 (denormalized tenant_id for RLS compatibility)
CREATE TABLE IF NOT EXISTS sbom_packages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL,
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
CREATE INDEX idx_sbom_packages_tenant ON sbom_packages(tenant_id);
CREATE INDEX idx_sbom_packages_sbom_id ON sbom_packages(sbom_id);
CREATE INDEX idx_sbom_packages_purl ON sbom_packages(purl);
CREATE INDEX idx_sbom_packages_name_version ON sbom_packages(name, version);

-- SBOM 签名证明 (denormalized tenant_id for RLS compatibility)
CREATE TABLE IF NOT EXISTS sbom_attestations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL,
  sbom_id         UUID NOT NULL REFERENCES sbom_documents(id) ON DELETE CASCADE,
  attestation_type VARCHAR(50) NOT NULL,              -- sigstore-cosign | in-toto
  signature       TEXT NOT NULL,                       -- Base64 encoded signature
  certificate     TEXT,                                -- Fulcio certificate
  transparency_log_url TEXT,                           -- Rekor transparency log
  signed_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  verified        BOOLEAN NOT NULL DEFAULT false,
  verified_at     TIMESTAMPTZ
);
CREATE INDEX idx_sbom_attestations_tenant ON sbom_attestations(tenant_id);
CREATE INDEX idx_sbom_attestations_sbom_id ON sbom_attestations(sbom_id);

-- 漏洞扫描结果 (denormalized tenant_id for RLS compatibility)
CREATE TABLE IF NOT EXISTS sbom_vulnerability_results (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL,
  sbom_id         UUID NOT NULL REFERENCES sbom_documents(id) ON DELETE CASCADE,
  scanner         VARCHAR(50) NOT NULL DEFAULT 'grype',
  scanned_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  total_vulns     INT NOT NULL DEFAULT 0,
  critical_count  INT NOT NULL DEFAULT 0,
  high_count      INT NOT NULL DEFAULT 0,
  medium_count    INT NOT NULL DEFAULT 0,
  low_count       INT NOT NULL DEFAULT 0,
  gate_passed     BOOLEAN NOT NULL,
  gate_policy     VARCHAR(50),                         -- e.g. "block-critical"
  scan_content    JSONB
);
CREATE INDEX idx_sbom_vuln_results_tenant ON sbom_vulnerability_results(tenant_id);
CREATE INDEX idx_sbom_vuln_results_sbom_id ON sbom_vulnerability_results(sbom_id);
CREATE INDEX idx_sbom_vuln_results_scanned_at ON sbom_vulnerability_results(scanned_at);

-- 漏洞详细记录 (individual vulnerability records per SBOM)
CREATE TABLE IF NOT EXISTS sbom_vulnerabilities (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL,
  sbom_id         UUID NOT NULL REFERENCES sbom_documents(id) ON DELETE CASCADE,
  cve_id          VARCHAR(20) NOT NULL,
  package_name    VARCHAR(255) NOT NULL,
  package_version VARCHAR(50) NOT NULL,
  severity        VARCHAR(20) NOT NULL,
  cvss_score      DECIMAL(3,1),
  description     TEXT,
  remediation     TEXT,
  status          VARCHAR(20) NOT NULL DEFAULT 'open',  -- open | fixed | waived
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_sbom_vulnerabilities_tenant ON sbom_vulnerabilities(tenant_id);
CREATE INDEX idx_sbom_vulnerabilities_sbom_id ON sbom_vulnerabilities(sbom_id);
CREATE INDEX idx_sbom_vulnerabilities_cve ON sbom_vulnerabilities(cve_id);
CREATE INDEX idx_sbom_vulnerabilities_severity ON sbom_vulnerabilities(severity);
CREATE INDEX idx_sbom_vulnerabilities_status ON sbom_vulnerabilities(status);

-- 漏洞豁免 (denormalized tenant_id for RLS compatibility)
CREATE TABLE IF NOT EXISTS sbom_waivers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL,
  cve_id          VARCHAR(20) NOT NULL,
  package_name    VARCHAR(255) NOT NULL,
  package_version VARCHAR(50) NOT NULL,
  reason          TEXT NOT NULL,
  approved_by     UUID NOT NULL,
  approved_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at      TIMESTAMPTZ NOT NULL,
  scope           VARCHAR(50) DEFAULT 'global',        -- global | project | environment
  scope_target    VARCHAR(100),                        -- project_id or env_name
  status          VARCHAR(20) DEFAULT 'active'         -- active | revoked | expired
);
CREATE INDEX idx_sbom_waivers_tenant ON sbom_waivers(tenant_id);
CREATE INDEX idx_sbom_waivers_cve ON sbom_waivers(cve_id);
CREATE INDEX idx_sbom_waivers_active ON sbom_waivers(expires_at) WHERE expires_at > now();
CREATE INDEX idx_sbom_waivers_status ON sbom_waivers(status);

-- ==================== Policy Tables ====================

-- 策略定义
CREATE TABLE IF NOT EXISTS policy_definitions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(255) NOT NULL,
  description     TEXT,
  category        VARCHAR(50) NOT NULL,               -- security | compliance | quality | operational
  rule            JSONB NOT NULL,                      -- Rego policy rule
  severity        VARCHAR(20) NOT NULL DEFAULT 'medium', -- critical | high | medium | low
  enabled         BOOLEAN NOT NULL DEFAULT true,
  version         INT NOT NULL DEFAULT 1,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  tenant_id       UUID NOT NULL
);
CREATE INDEX idx_policy_definitions_category ON policy_definitions(category);
CREATE INDEX idx_policy_definitions_enabled ON policy_definitions(enabled);
CREATE INDEX idx_policy_definitions_tenant_id ON policy_definitions(tenant_id);

-- 策略评估记录
CREATE TABLE IF NOT EXISTS policy_evaluations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL,
  policy_id       UUID NOT NULL REFERENCES policy_definitions(id),
  resource_type   VARCHAR(50) NOT NULL,               -- image | manifest | artifact | pipeline
  resource_id     VARCHAR(255) NOT NULL,
  result          VARCHAR(20) NOT NULL,               -- pass | fail | warn | error
  details         JSONB,
  evaluated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  evaluated_by    UUID,
  build_id        UUID,
  pipeline_run_id UUID
);
CREATE INDEX idx_policy_evaluations_tenant ON policy_evaluations(tenant_id);
CREATE INDEX idx_policy_evaluations_policy_id ON policy_evaluations(policy_id);
CREATE INDEX idx_policy_evaluations_resource ON policy_evaluations(resource_type, resource_id);
CREATE INDEX idx_policy_evaluations_evaluated_at ON policy_evaluations(evaluated_at);
CREATE INDEX idx_policy_evaluations_build_id ON policy_evaluations(build_id);

-- 策略违规记录
CREATE TABLE IF NOT EXISTS policy_violations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL,
  evaluation_id   UUID NOT NULL REFERENCES policy_evaluations(id),
  policy_id       UUID NOT NULL REFERENCES policy_definitions(id),
  severity        VARCHAR(20) NOT NULL,
  message         TEXT NOT NULL,
  remediation     TEXT,
  resource_type   VARCHAR(50) NOT NULL,
  resource_id     VARCHAR(255) NOT NULL,
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at     TIMESTAMPTZ,
  resolved_by     UUID,
  status          VARCHAR(20) NOT NULL DEFAULT 'open', -- open | resolved | dismissed
);
CREATE INDEX idx_policy_violations_tenant ON policy_violations(tenant_id);
CREATE INDEX idx_policy_violations_evaluation_id ON policy_violations(evaluation_id);
CREATE INDEX idx_policy_violations_policy_id ON policy_violations(policy_id);
CREATE INDEX idx_policy_violations_status ON policy_violations(status);

-- 策略豁免/覆盖
CREATE TABLE IF NOT EXISTS policy_overrides (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL,
  policy_id       UUID NOT NULL REFERENCES policy_definitions(id),
  resource_type   VARCHAR(50) NOT NULL,
  resource_id     VARCHAR(255) NOT NULL,
  reason          TEXT NOT NULL,
  overrides_by    UUID NOT NULL,
  approved_by     UUID,
  expires_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  status          VARCHAR(20) NOT NULL DEFAULT 'active', -- active | revoked | expired
);
CREATE INDEX idx_policy_overrides_tenant ON policy_overrides(tenant_id);
CREATE INDEX idx_policy_overrides_policy_id ON policy_overrides(policy_id);
CREATE INDEX idx_policy_overrides_resource ON policy_overrides(resource_type, resource_id);
CREATE INDEX idx_policy_overrides_status ON policy_overrides(status);

-- 质量门禁结果
CREATE TABLE IF NOT EXISTS quality_gate_results (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL,
  gate_name       VARCHAR(255) NOT NULL,
  build_id        UUID NOT NULL,
  pipeline_run_id UUID,
  status          VARCHAR(20) NOT NULL,               -- passed | failed | skipped
  score           INT,
  checks          JSONB NOT NULL,                     -- Array of check results
  evaluated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  evaluated_by    UUID,
);
CREATE INDEX idx_quality_gate_results_tenant ON quality_gate_results(tenant_id);
CREATE INDEX idx_quality_gate_results_build_id ON quality_gate_results(build_id);
CREATE INDEX idx_quality_gate_results_gate_name ON quality_gate_results(gate_name);

-- 质量门禁趋势
CREATE TABLE IF NOT EXISTS quality_gate_trends (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL,
  gate_name       VARCHAR(255) NOT NULL,
  period          DATE NOT NULL,                      -- Daily aggregation
  total_runs      INT NOT NULL DEFAULT 0,
  passed_runs     INT NOT NULL DEFAULT 0,
  failed_runs     INT NOT NULL DEFAULT 0,
  skipped_runs    INT NOT NULL DEFAULT 0,
  avg_score       DECIMAL(5,2),
  trend           VARCHAR(20),                        -- improving | stable | declining
  UNIQUE(gate_name, period, tenant_id)
);
CREATE INDEX idx_quality_gate_trends_tenant ON quality_gate_trends(tenant_id);
CREATE INDEX idx_quality_gate_trends_gate_name ON quality_gate_trends(gate_name);
CREATE INDEX idx_quality_gate_trends_period ON quality_gate_trends(period);

-- 策略豁免申请
CREATE TABLE IF NOT EXISTS policy_exemptions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL,
  policy_id       UUID NOT NULL REFERENCES policy_definitions(id),
  resource_type   VARCHAR(50) NOT NULL,
  resource_id     VARCHAR(255) NOT NULL,
  justification   TEXT NOT NULL,
  requested_by    UUID NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending | approved | rejected
  approved_by     UUID,
  approved_at     TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
);
CREATE INDEX idx_policy_exemptions_tenant ON policy_exemptions(tenant_id);
CREATE INDEX idx_policy_exemptions_policy_id ON policy_exemptions(policy_id);
CREATE INDEX idx_policy_exemptions_status ON policy_exemptions(status);

-- ==================== Risk Assessment Tables ====================

-- 风险评估
CREATE TABLE IF NOT EXISTS risk_assessments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL,
  resource_type   VARCHAR(50) NOT NULL,               -- image | deployment | artifact | pipeline
  resource_id     VARCHAR(255) NOT NULL,
  resource_name   VARCHAR(255),
  risk_score      INT NOT NULL DEFAULT 0,            -- 0-100
  risk_level      VARCHAR(20) NOT NULL,               -- critical | high | medium | low | minimal
  factors         JSONB,                               -- Risk factor details
  mitigations     JSONB,                               -- Recommended mitigations
  assessed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  assessed_by     UUID,
  expires_at      TIMESTAMPTZ,
);
CREATE INDEX idx_risk_assessments_tenant ON risk_assessments(tenant_id);
CREATE INDEX idx_risk_assessments_resource ON risk_assessments(resource_type, resource_id);
CREATE INDEX idx_risk_assessments_risk_level ON risk_assessments(risk_level);
CREATE INDEX idx_risk_assessments_risk_score ON risk_assessments(risk_score);

-- 风险事件历史
CREATE TABLE IF NOT EXISTS risk_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL,
  event_type      VARCHAR(50) NOT NULL,               -- vulnerability_found | config_changed | deployment_failed
  resource_type   VARCHAR(50) NOT NULL,
  resource_id     VARCHAR(255) NOT NULL,
  severity        VARCHAR(20) NOT NULL,
  description     TEXT NOT NULL,
  metadata        JSONB,
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
);
CREATE INDEX idx_risk_events_tenant ON risk_events(tenant_id);
CREATE INDEX idx_risk_events_resource ON risk_events(resource_type, resource_id);
CREATE INDEX idx_risk_events_event_type ON risk_events(event_type);
CREATE INDEX idx_risk_events_occurred_at ON risk_events(occurred_at);

-- ==================== Supply Chain Security Tables ====================

-- 供应链信任评分
CREATE TABLE IF NOT EXISTS supply_chain_trust_scores (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL,
  entity_type     VARCHAR(50) NOT NULL,               -- registry | repository | builder
  entity_id       VARCHAR(255) NOT NULL,
  entity_name     VARCHAR(255),
  trust_score     DECIMAL(5,2) NOT NULL DEFAULT 0,   -- 0-100
  trust_level     VARCHAR(20) NOT NULL,               -- trusted | moderate | untrusted
  factors         JSONB,                               -- Score breakdown
  last_scored_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(entity_type, entity_id, tenant_id)
);
CREATE INDEX idx_supply_chain_trust_tenant ON supply_chain_trust_scores(tenant_id);
CREATE INDEX idx_supply_chain_trust_entity ON supply_chain_trust_scores(entity_type, entity_id);
CREATE INDEX idx_supply_chain_trust_level ON supply_chain_trust_scores(trust_level);

-- 供应链分析结果
CREATE TABLE IF NOT EXISTS supply_chain_analyses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL,
  build_id        UUID NOT NULL,
  pipeline_run_id UUID,
  analysis_type   VARCHAR(50) NOT NULL,               -- provenance | attestations | dependencies
  result          JSONB NOT NULL,
  passed          BOOLEAN NOT NULL DEFAULT true,
  issues          JSONB,
  analyzed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  analyzed_by     UUID,
);
CREATE INDEX idx_supply_chain_analyses_tenant ON supply_chain_analyses(tenant_id);
CREATE INDEX idx_supply_chain_analyses_build_id ON supply_chain_analyses(build_id);
CREATE INDEX idx_supply_chain_analyses_pipeline_run_id ON supply_chain_analyses(pipeline_run_id);
CREATE INDEX idx_supply_chain_analyses_type ON supply_chain_analyses(analysis_type);

-- Provenance 记录
CREATE TABLE IF NOT EXISTS provenances (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL,
  build_id        UUID NOT NULL,
  provenance_type VARCHAR(50) NOT NULL,               -- slsa | in-toto
  content         JSONB NOT NULL,
  signature       TEXT,
  builder_id      VARCHAR(255),
  build_trigger   VARCHAR(100),
  source_uri      VARCHAR(500),
  verified        BOOLEAN NOT NULL DEFAULT false,
  verified_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
);
CREATE INDEX idx_provenances_tenant ON provenances(tenant_id);
CREATE INDEX idx_provenances_build_id ON provenances(build_id);
CREATE INDEX idx_provenances_provenance_type ON provenances(provenance_type);
CREATE INDEX idx_provenances_verified ON provenances(verified);
