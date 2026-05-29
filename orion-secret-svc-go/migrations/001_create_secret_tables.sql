CREATE TABLE IF NOT EXISTS secrets (
	id UUID PRIMARY KEY,
	tenant_id VARCHAR(64) NOT NULL,
	name VARCHAR(256) NOT NULL,
	value_encrypted TEXT NOT NULL,
	version INT NOT NULL DEFAULT 1,
	environment VARCHAR(64) NOT NULL DEFAULT 'production',
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_secrets_tenant ON secrets(tenant_id, name);
