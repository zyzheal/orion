CREATE TABLE IF NOT EXISTS federated_clusters (
	id UUID PRIMARY KEY,
	tenant_id UUID NOT NULL,
	name VARCHAR(256) NOT NULL,
	peer_url TEXT NOT NULL, protocol VARCHAR(32) NOT NULL DEFAULT 'https', status VARCHAR(32) NOT NULL DEFAULT 'pending', config JSONB DEFAULT '{}', last_sync TIMESTAMPTZ,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_federated_clusters_tenant ON federated_clusters(tenant_id, created_at);
