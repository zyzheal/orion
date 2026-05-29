CREATE TABLE IF NOT EXISTS skills (
	id UUID PRIMARY KEY,
	tenant_id VARCHAR(64) NOT NULL,
	name VARCHAR(256) NOT NULL,
	description TEXT, category VARCHAR(64) NOT NULL, input_schema JSONB DEFAULT '{}', output_schema JSONB DEFAULT '{}', version VARCHAR(32) NOT NULL DEFAULT '0.1.0',
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_skills_tenant ON skills(tenant_id, created_at);
