-- 001_create_cmdb_tables.sql
-- CMDB PostgreSQL schema for Orion.
-- Supports CI CRUD, relations, version history, and audit logging.

-- ============================================================
-- CI Items
-- ============================================================
CREATE TABLE IF NOT EXISTS ci_items (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     UUID NOT NULL,
    name          VARCHAR(255) NOT NULL,
    ci_type       VARCHAR(100) NOT NULL,
    description   TEXT,
    status        VARCHAR(50) NOT NULL DEFAULT 'active',
    environment   VARCHAR(100),
    tags          TEXT[],
    owner         VARCHAR(255),
    attributes    JSONB,
    version       INT NOT NULL DEFAULT 1,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW(),
    deleted_at    TIMESTAMPTZ
);

-- ============================================================
-- CI Versions (version history for audit/rollback)
-- ============================================================
CREATE TABLE IF NOT EXISTS ci_versions (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ci_id      UUID NOT NULL REFERENCES ci_items(id) ON DELETE CASCADE,
    version    INT NOT NULL,
    changes    TEXT,
    data       JSONB NOT NULL,
    actor      VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CI Relations (relationships between CIs)
-- ============================================================
CREATE TABLE IF NOT EXISTS ci_relations (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     UUID NOT NULL,
    source_ci_id  UUID NOT NULL REFERENCES ci_items(id) ON DELETE CASCADE,
    target_ci_id  UUID NOT NULL REFERENCES ci_items(id) ON DELETE CASCADE,
    relation_type VARCHAR(100) NOT NULL,
    description   TEXT,
    created_by    VARCHAR(255),
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW(),
    deleted_at    TIMESTAMPTZ
);

-- ============================================================
-- CI Audit Log (mutation trail for compliance)
-- ============================================================
CREATE TABLE IF NOT EXISTS ci_audit_log (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id  UUID NOT NULL,
    ci_id      UUID NOT NULL,
    action     VARCHAR(50) NOT NULL,
    actor      VARCHAR(255),
    old_value  JSONB,
    new_value  JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_ci_tenant ON ci_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ci_type ON ci_items(ci_type);
CREATE INDEX IF NOT EXISTS idx_ci_status ON ci_items(status);
CREATE INDEX IF NOT EXISTS idx_ci_environment ON ci_items(environment);
CREATE INDEX IF NOT EXISTS idx_ci_deleted ON ci_items(deleted_at);
CREATE INDEX IF NOT EXISTS idx_ci_name_search ON ci_items(name);
CREATE INDEX IF NOT EXISTS idx_ci_version ON ci_versions(ci_id, version);
CREATE INDEX IF NOT EXISTS idx_relations_tenant ON ci_relations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_relations_source ON ci_relations(source_ci_id);
CREATE INDEX IF NOT EXISTS idx_relations_target ON ci_relations(target_ci_id);
CREATE INDEX IF NOT EXISTS idx_relations_deleted ON ci_relations(deleted_at);
CREATE INDEX IF NOT EXISTS idx_audit_tenant ON ci_audit_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_ci ON ci_audit_log(ci_id);
