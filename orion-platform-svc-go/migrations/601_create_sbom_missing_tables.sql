-- 601_create_sbom_missing_tables.sql
-- sbom 模块 4 张表无 CREATE TABLE。
-- 回滚见 601_create_sbom_missing_tables_down.sql。

CREATE TABLE IF NOT EXISTS sbom_documents (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id            UUID NOT NULL,
    name                 TEXT NOT NULL DEFAULT '',
    version              TEXT NOT NULL DEFAULT '',
    format               TEXT NOT NULL DEFAULT 'spdx',
    status               TEXT NOT NULL DEFAULT 'generated',
    artifact_id           TEXT NOT NULL DEFAULT '',
    artifact_type         TEXT NOT NULL DEFAULT '',
    components_count      INTEGER NOT NULL DEFAULT 0,
    vulnerabilities_count INTEGER NOT NULL DEFAULT 0,
    licenses_count        INTEGER NOT NULL DEFAULT 0,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at           TIMESTAMPTZ,
    metadata             TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_sbom_documents_tenant ON sbom_documents(tenant_id);

CREATE TABLE IF NOT EXISTS sbom_components (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sbom_id       UUID NOT NULL,
    name          TEXT NOT NULL DEFAULT '',
    version       TEXT NOT NULL DEFAULT '',
    type          TEXT NOT NULL DEFAULT '',
    supplier      TEXT,
    author        TEXT,
    publisher     TEXT,
    purl          TEXT,
    cpe           TEXT,
    swid          TEXT,
    hash          TEXT NOT NULL DEFAULT '',
    license_id    TEXT NOT NULL DEFAULT '',
    license_name  TEXT NOT NULL DEFAULT '',
    license_type  TEXT NOT NULL DEFAULT '',
    dependencies TEXT NOT NULL DEFAULT '',
    properties   TEXT NOT NULL DEFAULT '',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sbom_components_sbom ON sbom_components(sbom_id);

CREATE TABLE IF NOT EXISTS sbom_vulnerabilities (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sbom_id           UUID NOT NULL,
    component_id      UUID,
    component_name    TEXT NOT NULL DEFAULT '',
    cve_id            TEXT NOT NULL DEFAULT '',
    severity          TEXT NOT NULL DEFAULT 'unknown',
    cvss_score        DECIMAL(5,2) NOT NULL DEFAULT 0,
    description       TEXT NOT NULL DEFAULT '',
    affected_versions TEXT NOT NULL DEFAULT '',
    fixed_versions    TEXT,
    "references"      TEXT NOT NULL DEFAULT '',
    status            TEXT NOT NULL DEFAULT 'open',
    published_at      TIMESTAMPTZ,
    discovered_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sbom_vulnerabilities_sbom ON sbom_vulnerabilities(sbom_id);

CREATE TABLE IF NOT EXISTS sbom_attestations (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sbom_id     UUID NOT NULL,
    type        TEXT NOT NULL DEFAULT '',
    policy      TEXT NOT NULL DEFAULT '',
    verified_by TEXT NOT NULL DEFAULT '',
    verified_at TIMESTAMPTZ,
    signature   TEXT NOT NULL DEFAULT '',
    public_key  TEXT NOT NULL DEFAULT '',
    payload     TEXT NOT NULL DEFAULT '',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sbom_attestations_sbom ON sbom_attestations(sbom_id);
