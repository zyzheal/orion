-- ChatOps Subscription Failures persistence
-- Migrates EventSubscriber subscriptionFailures Map() to PostgreSQL

CREATE TABLE IF NOT EXISTS chatops_subscription_failures (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  event_type VARCHAR(128) NOT NULL,
  error_message TEXT NOT NULL,
  retry_count INTEGER NOT NULL DEFAULT 0,
  last_retry_at TIMESTAMP NOT NULL DEFAULT NOW(),
  resolved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_chatops_sub_failures_event ON chatops_subscription_failures(event_type) WHERE resolved = false;
CREATE INDEX IF NOT EXISTS idx_chatops_sub_failures_resolved ON chatops_subscription_failures(resolved);
CREATE INDEX IF NOT EXISTS idx_chatops_sub_failures_tenant_id ON chatops_subscription_failures(tenant_id);
