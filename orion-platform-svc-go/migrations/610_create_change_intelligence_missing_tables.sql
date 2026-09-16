-- 610_create_change_intelligence_missing_tables.sql
-- change-intelligence 模块 3 张表无 CREATE TABLE。
-- 回滚见 610_create_change_intelligence_missing_tables_down.sql。

CREATE TABLE IF NOT EXISTS change_intelligence_analyses (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id         UUID NOT NULL,
    change_id         TEXT NOT NULL DEFAULT '',
    service_name      TEXT NOT NULL DEFAULT '',
    risk_score        INTEGER NOT NULL DEFAULT 0,
    blast_radius      JSONB DEFAULT '{}',
    affected_services TEXT NOT NULL DEFAULT '',
    recommendations   TEXT NOT NULL DEFAULT '',
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by        TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_change_intelligence_analyses_tenant ON change_intelligence_analyses(tenant_id);
CREATE INDEX IF NOT EXISTS idx_change_intelligence_analyses_change ON change_intelligence_analyses(change_id);

CREATE TABLE IF NOT EXISTS change_intelligence_blast_radius (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    analysis_id   UUID NOT NULL,
    service_id    TEXT NOT NULL DEFAULT '',
    service_name  TEXT NOT NULL DEFAULT '',
    impact_level  TEXT NOT NULL DEFAULT '',
    probability   DECIMAL(5,2) NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_change_intelligence_blast_radius_analysis ON change_intelligence_blast_radius(analysis_id);

CREATE TABLE IF NOT EXISTS change_intelligence_risk_factors (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    analysis_id   UUID NOT NULL,
    factor        TEXT NOT NULL DEFAULT '',
    score         DECIMAL(5,2) NOT NULL DEFAULT 0,
    description   TEXT NOT NULL DEFAULT '',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_change_intelligence_risk_factors_analysis ON change_intelligence_risk_factors(analysis_id);
