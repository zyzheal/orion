CREATE TABLE IF NOT EXISTS feature_flags (
	id UUID PRIMARY KEY,
	tenant_id VARCHAR(64) NOT NULL,
	name VARCHAR(256) NOT NULL,
	key VARCHAR(128) NOT NULL,
	description TEXT NOT NULL DEFAULT '',
	enabled BOOLEAN NOT NULL DEFAULT false,
	rollout_pct INT NOT NULL DEFAULT 100,
	environment VARCHAR(64) NOT NULL DEFAULT 'production',
	rules JSONB NOT NULL DEFAULT '{}',
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_feature_flags_tenant ON feature_flags(tenant_id, environment);
CREATE UNIQUE INDEX idx_feature_flags_key ON feature_flags(tenant_id, key);
