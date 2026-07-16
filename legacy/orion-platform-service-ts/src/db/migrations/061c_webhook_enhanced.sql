-- Webhook Platform Enhancement: Subscription Model + Dispatcher
-- Adds: webhook_endpoints, webhook_subscriptions, webhook_deliveries tables

-- Webhook Endpoints (enhanced webhook management)
CREATE TABLE IF NOT EXISTS webhook_endpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  url VARCHAR(500) NOT NULL,
  secret VARCHAR(256),
  auth_type VARCHAR(20) DEFAULT 'none' CHECK (auth_type IN ('none', 'bearer', 'basic', 'api_key')),
  auth_config JSONB,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'disabled')),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Webhook Subscriptions (event-to-endpoint mapping with filters)
CREATE TABLE IF NOT EXISTS webhook_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint_id UUID REFERENCES webhook_endpoints(id) ON DELETE CASCADE,
  event_type VARCHAR(100) NOT NULL,
  filters JSONB,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(endpoint_id, event_type)
);

-- Webhook Deliveries (delivery attempt tracking with retry support)
CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID REFERENCES webhook_subscriptions(id) ON DELETE CASCADE,
  event_id UUID NOT NULL,
  payload JSONB NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'delivered', 'failed', 'retrying')),
  attempt INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 5,
  next_retry_at TIMESTAMPTZ,
  response_status INTEGER,
  response_body TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  delivered_at TIMESTAMPTZ
);

-- Indexes for performance
CREATE INDEX idx_webhook_endpoints_status ON webhook_endpoints(status);
CREATE INDEX idx_webhook_subscriptions_event ON webhook_subscriptions(event_type, active) WHERE active = true;
CREATE INDEX idx_webhook_subscriptions_endpoint ON webhook_subscriptions(endpoint_id);
CREATE INDEX idx_webhook_deliveries_status ON webhook_deliveries(status, next_retry_at) WHERE status IN ('pending', 'retrying');
CREATE INDEX idx_webhook_deliveries_subscription ON webhook_deliveries(subscription_id);
CREATE INDEX idx_webhook_deliveries_event ON webhook_deliveries(event_id);