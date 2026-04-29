-- Migration 060: Namespace Pool Allocations
-- Persist namespace allocation records for the namespace pool service

CREATE TABLE IF NOT EXISTS namespace_allocations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  namespace_name  VARCHAR(100) NOT NULL UNIQUE,
  cluster_id      VARCHAR(100) NOT NULL DEFAULT 'default',
  tenant_id       INTEGER,
  status          VARCHAR(20) NOT NULL DEFAULT 'available',
  purpose         VARCHAR(200),
  labels          JSONB NOT NULL DEFAULT '{}',
  allocated_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_namespace_allocations_tenant ON namespace_allocations(tenant_id);
CREATE INDEX idx_namespace_allocations_status ON namespace_allocations(status);

-- Seed with 100 initial namespace entries
INSERT INTO namespace_allocations (namespace_name, cluster_id, status, labels)
SELECT
  'orion-ns-' || LPAD(i::text, 3, '0'),
  'default',
  'available',
  '{"orion.io/pool": "true", "orion.io/index": "' || i::text || '"}'::jsonb
FROM generate_series(1, 100) AS i
ON CONFLICT (namespace_name) DO NOTHING;

-- Rollback:
-- DROP TABLE IF EXISTS namespace_allocations;
