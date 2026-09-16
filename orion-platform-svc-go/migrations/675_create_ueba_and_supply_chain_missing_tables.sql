-- 675_create_ueba_and_supply_chain_missing_tables.sql
-- 2 个模块: ueba / supply-chain。
-- supply_chain_vulnerabilities 用 cve_id 作为逻辑标识（非 UUID），INSERT 无 id 列。
-- 回滚见 675_create_ueba_and_supply_chain_missing_tables_down.sql。

CREATE TABLE IF NOT EXISTS ueba_alerts (
    id            UUID PRIMARY KEY,
    tenant_id     UUID NOT NULL,
    user_id       UUID NOT NULL,
    entity_type   TEXT NOT NULL DEFAULT '',
    entity_id     TEXT NOT NULL DEFAULT '',
    event_type    TEXT NOT NULL DEFAULT '',
    severity      TEXT NOT NULL DEFAULT 'medium',
    score         DOUBLE PRECISION NOT NULL DEFAULT 0,
    anomaly_type  TEXT NOT NULL DEFAULT '',
    description   TEXT NOT NULL DEFAULT '',
    evidence      JSONB DEFAULT '{}',
    status        TEXT NOT NULL DEFAULT 'open',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ueba_alerts_tenant ON ueba_alerts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ueba_alerts_user ON ueba_alerts(user_id);

CREATE TABLE IF NOT EXISTS ueba_profiles (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id      UUID NOT NULL,
    user_id        UUID NOT NULL,
    entity_type    TEXT NOT NULL DEFAULT '',
    entity_id      TEXT NOT NULL DEFAULT '',
    profile_data   JSONB DEFAULT '{}',
    last_update_at TIMESTAMPTZ,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ueba_profiles_tenant ON ueba_profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ueba_profiles_user ON ueba_profiles(user_id);

-- supply_chain_vulnerabilities: 无 id 列，用 (cve_id, tenant_id, name, version) 作为唯一约束。
CREATE TABLE IF NOT EXISTS supply_chain_vulnerabilities (
    cve_id         TEXT PRIMARY KEY,
    tenant_id      UUID NOT NULL,
    name           TEXT NOT NULL DEFAULT '',
    version        TEXT NOT NULL DEFAULT '',
    description    TEXT NOT NULL DEFAULT '',
    severity       TEXT NOT NULL DEFAULT 'medium',
    remediation    TEXT NOT NULL DEFAULT '',
    affected_range TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_supply_chain_vulnerabilities_tenant ON supply_chain_vulnerabilities(tenant_id);
CREATE INDEX IF NOT EXISTS idx_supply_chain_vulnerabilities_name ON supply_chain_vulnerabilities(name);

CREATE TABLE IF NOT EXISTS supply_chain_reports (
    id                     UUID PRIMARY KEY,
    tenant_id              UUID NOT NULL,
    pipeline_id            UUID,
    artifact_id            TEXT NOT NULL DEFAULT '',
    sbom_count             INTEGER NOT NULL DEFAULT 0,
    component_count        INTEGER NOT NULL DEFAULT 0,
    signature_count        INTEGER NOT NULL DEFAULT 0,
    vulnerability_summary  JSONB DEFAULT '{}',
    compliance_status      TEXT NOT NULL DEFAULT '',
    risk_score             DOUBLE PRECISION NOT NULL DEFAULT 0,
    generated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_supply_chain_reports_tenant ON supply_chain_reports(tenant_id);
CREATE INDEX IF NOT EXISTS idx_supply_chain_reports_pipeline ON supply_chain_reports(pipeline_id);
