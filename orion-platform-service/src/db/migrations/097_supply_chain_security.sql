-- 097: Supply Chain Security
-- SBOM 增强、依赖链分析、制品签名

-- supply_chain_sboms 表（增强 SBOM）
CREATE TABLE IF NOT EXISTS supply_chain_sboms (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  pipeline_id     UUID REFERENCES pipelines(id) ON DELETE SET NULL,
  artifact_id     VARCHAR(100) NOT NULL,
  sbom_format     VARCHAR(20) NOT NULL DEFAULT 'cyclonedx',  -- cyclonedx, spdx
  sbom_version    VARCHAR(20) NOT NULL DEFAULT '1.4',
  components      JSONB NOT NULL DEFAULT '[]',
  dependencies    JSONB NOT NULL DEFAULT '[]',
  vulnerabilities JSONB NOT NULL DEFAULT '[]',
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_supply_chain_sboms_tenant ON supply_chain_sboms(tenant_id);
CREATE INDEX idx_supply_chain_sboms_artifact ON supply_chain_sboms(artifact_id);
CREATE INDEX idx_supply_chain_sboms_pipeline ON supply_chain_sboms(pipeline_id);

-- dependency_graphs 表（依赖关系图）
CREATE TABLE IF NOT EXISTS dependency_graphs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  package_name    VARCHAR(200) NOT NULL,
  package_version VARCHAR(50) NOT NULL,
  direct_deps     JSONB NOT NULL DEFAULT '[]',
  transitive_deps JSONB NOT NULL DEFAULT '[]',
  vulnerable_paths JSONB NOT NULL DEFAULT '[]',
  depth           INT NOT NULL DEFAULT 0,
  analyzed_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_dependency_graphs_tenant ON dependency_graphs(tenant_id);
CREATE INDEX idx_dependency_graphs_package ON dependency_graphs(package_name, package_version);

-- artifact_signatures 表（制品签名）
CREATE TABLE IF NOT EXISTS artifact_signatures (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  artifact_id     VARCHAR(100) NOT NULL,
  signature       TEXT NOT NULL,
  signature_type  VARCHAR(30) NOT NULL DEFAULT 'sha256',  -- sha256, rsa, ecdsa
  public_key      TEXT,
  certificate     TEXT,
  signed_by       VARCHAR(100) NOT NULL,
  signed_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  verified        BOOLEAN NOT NULL DEFAULT false,
  verified_at     TIMESTAMPTZ,
  metadata        JSONB NOT NULL DEFAULT '{}'
);
CREATE INDEX idx_artifact_signatures_tenant ON artifact_signatures(tenant_id);
CREATE INDEX idx_artifact_signatures_artifact ON artifact_signatures(artifact_id);
CREATE INDEX idx_artifact_signatures_signed_by ON artifact_signatures(signed_by);

-- 启用 RLS
ALTER TABLE supply_chain_sboms ENABLE ROW LEVEL SECURITY;
ALTER TABLE dependency_graphs ENABLE ROW LEVEL SECURITY;
ALTER TABLE artifact_signatures ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_supply_chain_sboms ON supply_chain_sboms
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));
CREATE POLICY tenant_isolation_dependency_graphs ON dependency_graphs
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));
CREATE POLICY tenant_isolation_artifact_signatures ON artifact_signatures
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));
