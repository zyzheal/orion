-- API Marketplace tables
-- Created: 2026-07-12

CREATE TABLE IF NOT EXISTS api_market_products (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
    name VARCHAR(255) NOT NULL,
    description TEXT,
    version VARCHAR(64),
    pricing JSONB DEFAULT '{}',
    status VARCHAR(32) NOT NULL DEFAULT 'draft',
    owner_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS api_market_apps (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
    product_id UUID REFERENCES api_market_products(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    developer_id UUID,
    redirect_uris JSONB DEFAULT '[]',
    api_keys JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS api_market_keys (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
    app_id UUID REFERENCES api_market_apps(id),
    client_id VARCHAR(255) NOT NULL,
    key_hash VARCHAR(64) NOT NULL,
    scopes JSONB DEFAULT '[]',
    rate_limit_per_min INTEGER DEFAULT 60,
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    expires_at TIMESTAMPTZ,
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS api_market_subscriptions (
    id UUID PRIMARY KEY,
    app_id UUID REFERENCES api_market_apps(id),
    product_id UUID REFERENCES api_market_products(id),
    plan VARCHAR(64) NOT NULL DEFAULT 'free',
    quota_per_day INTEGER DEFAULT 1000,
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_market_products_tenant ON api_market_products(tenant_id);
CREATE INDEX IF NOT EXISTS idx_api_market_products_status ON api_market_products(status);
CREATE INDEX IF NOT EXISTS idx_api_market_apps_tenant ON api_market_apps(tenant_id);
CREATE INDEX IF NOT EXISTS idx_api_market_apps_product ON api_market_apps(product_id);
CREATE INDEX IF NOT EXISTS idx_api_market_apps_developer ON api_market_apps(developer_id);
CREATE INDEX IF NOT EXISTS idx_api_market_keys_tenant ON api_market_keys(tenant_id);
CREATE INDEX IF NOT EXISTS idx_api_market_keys_app ON api_market_keys(app_id);
CREATE INDEX IF NOT EXISTS idx_api_market_keys_client ON api_market_keys(client_id);
CREATE INDEX IF NOT EXISTS idx_api_market_keys_status ON api_market_keys(status);
CREATE INDEX IF NOT EXISTS idx_api_market_subscriptions_app ON api_market_subscriptions(app_id);
CREATE INDEX IF NOT EXISTS idx_api_market_subscriptions_product ON api_market_subscriptions(product_id);
CREATE INDEX IF NOT EXISTS idx_api_market_subscriptions_status ON api_market_subscriptions(status);
