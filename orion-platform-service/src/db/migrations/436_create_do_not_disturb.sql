-- ============================================================
-- Migration 436: Do Not Disturb Settings
-- ============================================================

CREATE TABLE IF NOT EXISTS do_not_disturb (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  start_time    TIMESTAMPTZ NOT NULL,
  end_time      TIMESTAMPTZ NOT NULL,
  reason        TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_do_not_disturb_user_tenant
  ON do_not_disturb (user_id, tenant_id);

CREATE INDEX IF NOT EXISTS idx_do_not_disturb_tenant
  ON do_not_disturb (tenant_id);

ALTER TABLE do_not_disturb ENABLE ROW LEVEL SECURITY;
ALTER TABLE do_not_disturb FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_do_not_disturb ON do_not_disturb;
CREATE POLICY tenant_isolation_do_not_disturb ON do_not_disturb
  USING (
    current_setting('app.current_tenant_id', true) IS NOT NULL
    AND current_setting('app.current_tenant_id', true) != ''
    AND tenant_id::text = current_setting('app.current_tenant_id')
  );
