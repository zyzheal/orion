CREATE TABLE IF NOT EXISTS dr_plans (
	id UUID PRIMARY KEY,
	tenant_id VARCHAR(64) NOT NULL,
	name VARCHAR(256) NOT NULL,
	plan_type VARCHAR(64) NOT NULL, rpo INT NOT NULL DEFAULT 3600, rto INT NOT NULL DEFAULT 7200, status VARCHAR(32) NOT NULL DEFAULT 'draft', last_tested TIMESTAMPTZ, config JSONB DEFAULT '{}',
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_dr_plans_tenant ON dr_plans(tenant_id, created_at);
