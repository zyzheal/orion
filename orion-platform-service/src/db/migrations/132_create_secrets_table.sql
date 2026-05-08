-- Create secrets table for pipeline secret management
-- Supports tenant-scoped secrets with different scopes (org, project, environment)
-- encrypted_value stores AES-256-GCM encrypted secret values

CREATE TABLE IF NOT EXISTS secrets (
  id VARCHAR(36) PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  encrypted_value BYTEA NOT NULL,
  scope VARCHAR(50) NOT NULL DEFAULT 'project', -- org, project, environment
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by VARCHAR(255),
  UNIQUE(tenant_id, name, scope)
);

-- Indexes for efficient tenant + scope lookups
CREATE INDEX IF NOT EXISTS idx_secrets_tenant_scope ON secrets(tenant_id, scope);
CREATE INDEX IF NOT EXISTS idx_secrets_tenant_name ON secrets(tenant_id, name);

-- Enable Row Level Security
ALTER TABLE secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE secrets FORCE ROW LEVEL SECURITY;

-- RLS policy: tenants can only see their own secrets
CREATE POLICY secrets_tenant_isolation ON secrets
  USING (tenant_id = current_setting('app.current_tenant_id', true));
