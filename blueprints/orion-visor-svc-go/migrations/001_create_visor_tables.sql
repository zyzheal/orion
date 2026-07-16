CREATE TABLE IF NOT EXISTS dashboards (
	id UUID PRIMARY KEY,
	tenant_id VARCHAR(64) NOT NULL,
	name VARCHAR(256) NOT NULL,
	dashboard_type VARCHAR(64) NOT NULL, config JSONB NOT NULL DEFAULT '{}', layout JSONB DEFAULT '{}', shared BOOLEAN NOT NULL DEFAULT false,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_dashboards_tenant ON dashboards(tenant_id, created_at);
