-- Handler-registry module tables

CREATE TABLE IF NOT EXISTS handler_registries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_handler_registries_tenant_id ON handler_registries(tenant_id);

CREATE TABLE IF NOT EXISTS handler_registry_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    domain VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    display_name VARCHAR(255),
    description VARCHAR(255),
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    config JSONB,
    registered_by VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_handler_registry_entries_tenant_id ON handler_registry_entries(tenant_id);
CREATE INDEX IF NOT EXISTS idx_handler_registry_entries_domain ON handler_registry_entries(domain);
CREATE INDEX IF NOT EXISTS idx_handler_registry_entries_status ON handler_registry_entries(status);
