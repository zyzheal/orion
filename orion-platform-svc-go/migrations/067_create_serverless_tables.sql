-- Serverless module tables

CREATE TABLE IF NOT EXISTS serverless_functions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    runtime VARCHAR(50) NOT NULL DEFAULT 'nodejs',
    handler VARCHAR(255) NOT NULL,
    memory INTEGER DEFAULT 512,
    timeout INTEGER DEFAULT 30,
    environment JSONB,
    code TEXT,
    replicas INTEGER DEFAULT 1,
    status VARCHAR(50) NOT NULL DEFAULT 'created',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_serverless_functions_tenant_id ON serverless_functions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_serverless_functions_status ON serverless_functions(status);
CREATE INDEX IF NOT EXISTS idx_serverless_functions_runtime ON serverless_functions(runtime);

CREATE TABLE IF NOT EXISTS serverless_deployments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    function_id VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_serverless_deployments_tenant_id ON serverless_deployments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_serverless_deployments_function_id ON serverless_deployments(function_id);
CREATE INDEX IF NOT EXISTS idx_serverless_deployments_status ON serverless_deployments(status);
CREATE INDEX IF NOT EXISTS idx_serverless_deployments_created_at ON serverless_deployments(created_at DESC);

CREATE TABLE IF NOT EXISTS serverless_function_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    function_id VARCHAR(255) NOT NULL,
    level VARCHAR(20) NOT NULL DEFAULT 'info',
    message TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_serverless_function_logs_tenant_id ON serverless_function_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_serverless_function_logs_function_id ON serverless_function_logs(function_id);
CREATE INDEX IF NOT EXISTS idx_serverless_function_logs_level ON serverless_function_logs(level);
CREATE INDEX IF NOT EXISTS idx_serverless_function_logs_created_at ON serverless_function_logs(created_at DESC);

CREATE TABLE IF NOT EXISTS serverless_triggers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    function_id VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'http',
    name VARCHAR(255) NOT NULL,
    config TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_serverless_triggers_tenant_id ON serverless_triggers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_serverless_triggers_function_id ON serverless_triggers(function_id);
CREATE INDEX IF NOT EXISTS idx_serverless_triggers_type ON serverless_triggers(type);
