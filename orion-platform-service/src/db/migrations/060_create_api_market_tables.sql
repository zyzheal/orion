-- Migration 060: API Marketplace Tables
-- Creates tables for API Products, Definitions, Developer Apps, Credentials, and Subscriptions

-- ==================== API Products ====================
CREATE TABLE IF NOT EXISTS api_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  owner_id UUID REFERENCES users(id),
  status VARCHAR(20) DEFAULT 'draft',
  version VARCHAR(20) DEFAULT '1.0.0',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ==================== API Definitions ====================
CREATE TABLE IF NOT EXISTS api_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES api_products(id) ON DELETE CASCADE,
  version VARCHAR(20) NOT NULL,
  openapi_spec JSONB NOT NULL,
  changelog TEXT,
  published_at TIMESTAMPTZ,
  is_current BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(product_id, version)
);

-- ==================== Developer Apps ====================
CREATE TABLE IF NOT EXISTS developer_apps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  developer_id UUID REFERENCES users(id),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  redirect_uris TEXT[],
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ==================== API Credentials ====================
CREATE TABLE IF NOT EXISTS api_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id UUID REFERENCES developer_apps(id) ON DELETE CASCADE,
  client_id VARCHAR(64) UNIQUE NOT NULL,
  client_secret_hash VARCHAR(256) NOT NULL,
  scopes TEXT[] DEFAULT ARRAY['read'],
  rate_limit_per_min INTEGER DEFAULT 100,
  expires_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ==================== API Subscriptions ====================
CREATE TABLE IF NOT EXISTS api_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id UUID REFERENCES developer_apps(id) ON DELETE CASCADE,
  product_id UUID REFERENCES api_products(id) ON DELETE CASCADE,
  plan VARCHAR(20),
  status VARCHAR(20) DEFAULT 'active',
  quota_per_day INTEGER DEFAULT 1000,
  used_today INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(app_id, product_id)
);

-- ==================== Indexes ====================
CREATE INDEX idx_api_products_slug ON api_products(slug);
CREATE INDEX idx_api_products_status ON api_products(status);
CREATE INDEX idx_api_products_owner ON api_products(owner_id);

CREATE INDEX idx_api_definitions_product ON api_definitions(product_id);

CREATE INDEX idx_developer_apps_dev ON developer_apps(developer_id);

CREATE INDEX idx_api_credentials_app ON api_credentials(app_id);
CREATE INDEX idx_api_credentials_client ON api_credentials(client_id);

CREATE INDEX idx_api_subscriptions_app ON api_subscriptions(app_id);
CREATE INDEX idx_api_subscriptions_product ON api_subscriptions(product_id);