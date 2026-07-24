-- Gateway-dynamic module tables

CREATE TABLE IF NOT EXISTS gateway_routes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    path VARCHAR(255) NOT NULL,
    methods VARCHAR(255) NOT NULL,
    upstream_url VARCHAR(255) NOT NULL,
    enabled BOOLEAN DEFAULT FALSE,
    priority INTEGER DEFAULT 0,
    metadata JSONB,
    created_by VARCHAR(255),
    updated_by VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_gateway_routes_tenant_id ON gateway_routes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_gateway_routes_path ON gateway_routes(path);
CREATE INDEX IF NOT EXISTS idx_gateway_routes_enabled ON gateway_routes(enabled);
