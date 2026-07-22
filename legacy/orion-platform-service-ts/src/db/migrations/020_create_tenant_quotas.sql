-- Migration 020: Tenant Quotas
-- Resource quota management per tenant

CREATE TABLE IF NOT EXISTS tenant_quotas (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE UNIQUE,
  max_users     INT,
  max_projects  INT,
  max_pipelines INT,
  max_storage_mb BIGINT,
  max_api_calls_per_hour BIGINT,
  max_concurrent_builds INT,
  usage         JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Rollback:
-- DROP TABLE IF EXISTS tenant_quotas;
