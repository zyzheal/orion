CREATE TABLE IF NOT EXISTS secrets (
	id UUID PRIMARY KEY,
	tenant_id VARCHAR(64) NOT NULL,
	name VARCHAR(256) NOT NULL,
	value_encrypted TEXT NOT NULL,
	scope VARCHAR(32) NOT NULL DEFAULT 'project',
	description TEXT,
	created_by VARCHAR(128),
	version INT NOT NULL DEFAULT 1,
	environment VARCHAR(64) NOT NULL DEFAULT 'production',
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	UNIQUE (tenant_id, name, scope)
);
CREATE INDEX IF NOT EXISTS idx_secrets_tenant ON secrets(tenant_id, name);
CREATE INDEX IF NOT EXISTS idx_secrets_tenant_scope ON secrets(tenant_id, scope);
