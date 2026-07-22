-- Feature flags table with full targeting, rollout, and environment support.
CREATE TABLE IF NOT EXISTS feature_flags (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    name VARCHAR(256) NOT NULL,
    key VARCHAR(128) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    default_value BOOLEAN NOT NULL DEFAULT false,
    rollout_pct INT NOT NULL DEFAULT 100,
    rollout_strategy VARCHAR(20) NOT NULL DEFAULT 'percentage',
    targeting_rules JSONB NOT NULL DEFAULT '[]',
    environments JSONB NOT NULL DEFAULT '["production"]',
    tags JSONB NOT NULL DEFAULT '[]',
    created_by VARCHAR(128) NOT NULL DEFAULT '',
    updated_by VARCHAR(128) NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_feature_flags_tenant ON feature_flags(tenant_id);
CREATE UNIQUE INDEX idx_feature_flags_key ON feature_flags(tenant_id, key);
CREATE INDEX idx_feature_flags_status ON feature_flags(tenant_id, status);

-- Toggle history records every change to a flag's enabled/default state.
CREATE TABLE IF NOT EXISTS flag_toggle_history (
    id UUID PRIMARY KEY,
    flag_id UUID NOT NULL REFERENCES feature_flags(id) ON DELETE CASCADE,
    old_value BOOLEAN NOT NULL,
    new_value BOOLEAN NOT NULL,
    changed_by VARCHAR(128) NOT NULL DEFAULT '',
    reason TEXT NOT NULL DEFAULT '',
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_flag_toggle_history_flag ON flag_toggle_history(flag_id);
