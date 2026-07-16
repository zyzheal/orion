-- Developer-portal module tables

CREATE TABLE IF NOT EXISTS developer_portals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE TABLE IF NOT EXISTS portal_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    title VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    content TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'draft',
    views BIGINT DEFAULT 0,
    helpful BIGINT DEFAULT 0,
    version VARCHAR(50),
    created_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_portal_documents_tenant_id ON portal_documents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_portal_documents_category ON portal_documents(category);
CREATE INDEX IF NOT EXISTS idx_portal_documents_status ON portal_documents(status);

CREATE TABLE IF NOT EXISTS document_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    document_id VARCHAR(255) NOT NULL,
    version VARCHAR(50) NOT NULL,
    content TEXT,
    created_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE TABLE IF NOT EXISTS mock_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    method VARCHAR(20) NOT NULL,
    path VARCHAR(255) NOT NULL,
    responses JSONB,
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_mock_rules_tenant_id ON mock_rules(tenant_id);

CREATE TABLE IF NOT EXISTS sdk_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    language VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    output_url VARCHAR(255),
    error TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sdk_tasks_tenant_id ON sdk_tasks(tenant_id);

CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    api_name VARCHAR(255) NOT NULL,
    plan_name VARCHAR(255),
    quota_per_day BIGINT DEFAULT 0,
    quota_per_month BIGINT DEFAULT 0,
    used_per_day BIGINT DEFAULT 0,
    used_per_month BIGINT DEFAULT 0,
    reason TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    approved_by VARCHAR(255),
    reject_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant_id ON subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

CREATE TABLE IF NOT EXISTS usage_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    subscription_id VARCHAR(255) NOT NULL,
    api_name VARCHAR(255),
    method VARCHAR(20),
    path VARCHAR(255),
    status BIGINT DEFAULT 0,
    latency_ms BIGINT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_usage_records_tenant_id ON usage_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_usage_records_subscription_id ON usage_records(subscription_id);

CREATE TABLE IF NOT EXISTS playground_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    method VARCHAR(20) NOT NULL,
    path VARCHAR(255) NOT NULL,
    headers JSONB,
    body JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE TABLE IF NOT EXISTS response_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    request_id VARCHAR(255) NOT NULL,
    status BIGINT DEFAULT 0,
    headers JSONB,
    body JSONB,
    latency_ms BIGINT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);
