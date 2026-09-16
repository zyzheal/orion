-- 666_create_policy_and_canary_missing_tables.sql
-- 4 个模块: abac-policy / auth-mfa / canary-analysis / canary-traffic。
-- 回滚见 666_create_policy_and_canary_missing_tables_down.sql。

CREATE TABLE IF NOT EXISTS abac_policies (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     UUID NOT NULL,
    name          TEXT NOT NULL,
    description   TEXT NOT NULL DEFAULT '',
    resource_type TEXT NOT NULL DEFAULT '',
    action        TEXT NOT NULL DEFAULT '',
    effect        TEXT NOT NULL DEFAULT 'allow',
    conditions    JSONB DEFAULT '{}',
    status        TEXT NOT NULL DEFAULT 'active',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_abac_policies_tenant ON abac_policies(tenant_id);

CREATE TABLE IF NOT EXISTS mfa_devices (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id  UUID NOT NULL,
    user_id    UUID NOT NULL,
    type       TEXT NOT NULL DEFAULT 'totp',
    secret     TEXT NOT NULL,
    digits     INTEGER NOT NULL DEFAULT 6,
    period     INTEGER NOT NULL DEFAULT 30,
    issuer     TEXT NOT NULL DEFAULT '',
    label      TEXT NOT NULL DEFAULT '',
    status     TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_mfa_devices_tenant ON mfa_devices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_mfa_devices_user ON mfa_devices(user_id);

CREATE TABLE IF NOT EXISTS canary_analyses (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id  UUID NOT NULL,
    name       TEXT NOT NULL,
    status     TEXT NOT NULL DEFAULT 'running',
    metadata   JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_canary_analyses_tenant ON canary_analyses(tenant_id);

CREATE TABLE IF NOT EXISTS canary_traffic (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                UUID NOT NULL,
    name                     TEXT NOT NULL,
    service_name             TEXT NOT NULL,
    strategy                 TEXT NOT NULL DEFAULT 'linear',
    control_plane_url        TEXT NOT NULL DEFAULT '',
    canary_url               TEXT NOT NULL DEFAULT '',
    control_weight           INTEGER NOT NULL DEFAULT 100,
    canary_weight            INTEGER NOT NULL DEFAULT 0,
    target_weight            INTEGER NOT NULL DEFAULT 100,
    status                   TEXT NOT NULL DEFAULT 'active',
    health_endpoint          TEXT NOT NULL DEFAULT '',
    metrics_endpoint         TEXT NOT NULL DEFAULT '',
    last_updated             TIMESTAMPTZ,
    enabled                  BOOLEAN NOT NULL DEFAULT TRUE,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_canary_traffic_tenant ON canary_traffic(tenant_id);
