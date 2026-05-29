CREATE TABLE IF NOT EXISTS efficiency_metrics (
	id UUID PRIMARY KEY,
	tenant_id VARCHAR(64) NOT NULL,
	name VARCHAR(256) NOT NULL,
	metric_type VARCHAR(64) NOT NULL, value DOUBLE PRECISION NOT NULL, target DOUBLE PRECISION DEFAULT 0, unit VARCHAR(32), period VARCHAR(32),
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_efficiency_metrics_tenant ON efficiency_metrics(tenant_id, created_at);
