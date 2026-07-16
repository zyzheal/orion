-- Global Parameters table (Task 8)
-- Cross-pipeline shared parameters with scoping support

CREATE TABLE IF NOT EXISTS global_params (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
    key VARCHAR(255) NOT NULL,
    value TEXT NOT NULL,
    description TEXT,
    is_secret BOOLEAN DEFAULT false,
    scope VARCHAR(16) NOT NULL DEFAULT 'tenant',  -- tenant | pipeline | global
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    -- Unique constraint per tenant + key
    UNIQUE(tenant_id, key)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_global_params_tenant ON global_params(tenant_id);
CREATE INDEX IF NOT EXISTS idx_global_params_key ON global_params(key);
CREATE INDEX IF NOT EXISTS idx_global_params_scope ON global_params(scope);
CREATE INDEX IF NOT EXISTS idx_global_params_expires ON global_params(expires_at);

-- Row Level Security
ALTER TABLE global_params ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_global_params ON global_params
    USING (
        current_setting('app.current_tenant_id', true) IS NOT NULL
        AND current_setting('app.current_tenant_id', true) != ''
        AND tenant_id::text = current_setting('app.current_tenant_id')
    );
