-- Migration 125: Add tenant_id to canary_traffic and federation tables
-- Adds tenant isolation columns to tables that were missing them

-- Add tenant_id to canary_traffic_configs
ALTER TABLE canary_traffic_configs ADD COLUMN IF NOT EXISTS tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000';
CREATE INDEX idx_canary_traffic_configs_tenant ON canary_traffic_configs(tenant_id);

-- Add tenant_id to canary_traffic_history
ALTER TABLE canary_traffic_history ADD COLUMN IF NOT EXISTS tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000';
CREATE INDEX idx_canary_traffic_history_tenant ON canary_traffic_history(tenant_id);

-- Add tenant_id to federation_executors
ALTER TABLE federation_executors ADD COLUMN IF NOT EXISTS tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000';
CREATE INDEX idx_federation_executors_tenant ON federation_executors(tenant_id);

-- Add tenant_id to federation_executor_health
ALTER TABLE federation_executor_health ADD COLUMN IF NOT EXISTS tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000';
CREATE INDEX idx_federation_executor_health_tenant ON federation_executor_health(tenant_id);
