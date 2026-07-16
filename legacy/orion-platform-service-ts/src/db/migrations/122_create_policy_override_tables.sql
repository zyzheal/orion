-- Migration 122: Policy Override Service (gate bypass audit trail)
-- Creates table for policy overrides with tenant isolation and lifecycle management

CREATE TABLE IF NOT EXISTS policy_overrides_v2 (
  id              VARCHAR(255) PRIMARY KEY,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  policy_id       VARCHAR(255) NOT NULL,
  pipeline_id     VARCHAR(255),
  run_id          VARCHAR(255),
  reason          TEXT NOT NULL,
  approved_by     VARCHAR(255) NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'active',   -- active | revoked | expired
  expires_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at      TIMESTAMPTZ,
  revoked_by      VARCHAR(255)
);
CREATE INDEX idx_policy_overrides_v2_tenant ON policy_overrides_v2(tenant_id);
CREATE INDEX idx_policy_overrides_v2_policy ON policy_overrides_v2(policy_id);
CREATE INDEX idx_policy_overrides_v2_status ON policy_overrides_v2(status);
