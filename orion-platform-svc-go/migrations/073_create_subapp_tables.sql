-- SubApp module tables

CREATE TABLE IF NOT EXISTS subapp_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    key VARCHAR(255) NOT NULL,
    version VARCHAR(100),
    entry_dev VARCHAR(512) NOT NULL,
    entry_prod VARCHAR(512) NOT NULL,
    routes JSONB,
    permissions JSONB,
    keep_alive BOOLEAN DEFAULT FALSE,
    preload BOOLEAN DEFAULT FALSE,
    description TEXT,
    icon TEXT,
    api_domain VARCHAR(255),
    status VARCHAR(50) NOT NULL DEFAULT 'enabled',
    sort_order INTEGER DEFAULT 0,
    created_by VARCHAR(255),
    updated_by VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    UNIQUE(tenant_id, key)
);

CREATE INDEX IF NOT EXISTS idx_subapp_configs_tenant_id ON subapp_configs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_subapp_configs_status ON subapp_configs(status);
CREATE INDEX IF NOT EXISTS idx_subapp_configs_sort_order ON subapp_configs(sort_order);

CREATE TABLE IF NOT EXISTS subapp_config_histories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    subapp_key VARCHAR(255) NOT NULL,
    action VARCHAR(50) NOT NULL,
    old_value JSONB,
    new_value JSONB,
    changed_by VARCHAR(255),
    change_summary TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_subapp_config_histories_tenant_id ON subapp_config_histories(tenant_id);
CREATE INDEX IF NOT EXISTS idx_subapp_config_histories_subapp_key ON subapp_config_histories(subapp_key);
CREATE INDEX IF NOT EXISTS idx_subapp_config_histories_created_at ON subapp_config_histories(created_at DESC);
