CREATE TABLE IF NOT EXISTS pipeline_templates (
	id UUID PRIMARY KEY,
	tenant_id VARCHAR(64) NOT NULL,
	name VARCHAR(256) NOT NULL,
	description TEXT, yaml_content TEXT NOT NULL, version INT NOT NULL DEFAULT 1, tags JSONB DEFAULT '[]',
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_pipeline_templates_tenant ON pipeline_templates(tenant_id, created_at);
