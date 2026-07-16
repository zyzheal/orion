-- Migration 026: SBOM Attestation & Supply Chain Provenance
-- Creates tables for SBOM documents, packages, attestations, vulnerability results, and waivers

-- SBOM 文档主表
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
  status          VARCHAR(20) NOT NULL DEFAULT 'active'  -- active | expired | revoked
);

-- SBOM 包清单
CREATE TABLE IF NOT EXISTS sbom_packages (
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
CREATE TABLE IF NOT EXISTS sbom_attestations (
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
CREATE TABLE IF NOT EXISTS sbom_vulnerability_results (
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

-- 漏洞豁免
CREATE TABLE IF NOT EXISTS sbom_waivers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cve_id          VARCHAR(20) NOT NULL,
  package_name    VARCHAR(255) NOT NULL,
  package_version VARCHAR(50) NOT NULL,
  reason          TEXT NOT NULL,
  approved_by     UUID NOT NULL,
  approved_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at      TIMESTAMPTZ NOT NULL,
  scope           VARCHAR(50) DEFAULT 'global',        -- global | project | environment
  scope_target    VARCHAR(100)                         -- project_id or env_name
);
CREATE INDEX idx_sbom_waivers_cve ON sbom_waivers(cve_id);
CREATE INDEX idx_sbom_waivers_active ON sbom_waivers(expires_at) WHERE expires_at > now();
