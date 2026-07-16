-- Migration: 353_create_feature_flags_tables.sql
-- Purpose: Persist feature flag module (feature flags + toggle history)

-- Feature Flags
CREATE TABLE IF NOT EXISTS feature_flags (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
    key             VARCHAR(200) NOT NULL,
    name            VARCHAR(200) NOT NULL,
    description     TEXT DEFAULT '',
    status          VARCHAR(20) DEFAULT 'active',  -- active, inactive, archived
    default_value   BOOLEAN DEFAULT FALSE,
    rollout_percentage INTEGER NOT NULL DEFAULT 0,
    rollout_strategy VARCHAR(20) DEFAULT 'percentage',  -- percentage, targeted, gradual
    targeting_rules JSONB DEFAULT '[]',
    environments    JSONB DEFAULT '["development","staging","production"]',
    tags            JSONB DEFAULT '[]',
    created_by      VARCHAR(100) NOT NULL DEFAULT 'system',
    updated_by      VARCHAR(100),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_feature_flags_tenant_key UNIQUE (tenant_id, key)
);

CREATE INDEX IF NOT EXISTS idx_feature_flags_tenant ON feature_flags(tenant_id);
CREATE INDEX IF NOT EXISTS idx_feature_flags_status ON feature_flags(status);
CREATE INDEX IF NOT EXISTS idx_feature_flags_key ON feature_flags(key);
CREATE INDEX IF NOT EXISTS idx_feature_flags_created_at ON feature_flags(created_at DESC);

-- Toggle History
CREATE TABLE IF NOT EXISTS flag_toggle_history (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flag_id         UUID NOT NULL REFERENCES feature_flags(id) ON DELETE CASCADE,
    old_value       BOOLEAN NOT NULL,
    new_value       BOOLEAN NOT NULL,
    changed_by      VARCHAR(100) NOT NULL DEFAULT 'system',
    reason          TEXT,
    changed_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_toggle_history_flag ON flag_toggle_history(flag_id);
CREATE INDEX IF NOT EXISTS idx_toggle_history_changed_at ON flag_toggle_history(changed_at DESC);
