-- ============================================================================
-- Task 5.5: CMDB Relation Type Management
-- ============================================================================
-- Manages configurable relation types for CMDB CI relationships.
-- System types are pre-seeded; tenants can add custom types.
-- Tenant-isolated via RLS.

-- ---------------------------------------------------------------------------
-- cmdb_relation_type: relation type definitions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cmdb_relation_type (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  tenant_id     TEXT NOT NULL,
  name          TEXT NOT NULL,
  description   TEXT,
  category      TEXT,
  is_symmetric  BOOLEAN NOT NULL DEFAULT false,
  attributes    JSONB DEFAULT '{}'::JSONB,
  is_system     BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique constraint: one definition per (tenant, name)
CREATE UNIQUE INDEX IF NOT EXISTS uq_cmdb_relation_type_tenant_name
  ON cmdb_relation_type (tenant_id, name);

-- Trigger: auto-update updated_at
CREATE OR REPLACE FUNCTION fn_set_cmdb_relation_type_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cmdb_relation_type_updated_at ON cmdb_relation_type;
CREATE TRIGGER trg_cmdb_relation_type_updated_at
  BEFORE UPDATE ON cmdb_relation_type
  FOR EACH ROW EXECUTE FUNCTION fn_set_cmdb_relation_type_updated_at();

-- RLS
ALTER TABLE cmdb_relation_type ENABLE ROW LEVEL SECURITY;

CREATE POLICY cmdb_relation_type_tenant_isolation ON cmdb_relation_type
  USING (tenant_id = current_setting('app.current_tenant_id', TRUE));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_cmdb_relation_type_tenant
  ON cmdb_relation_type (tenant_id);

CREATE INDEX IF NOT EXISTS idx_cmdb_relation_type_tenant_category
  ON cmdb_relation_type (tenant_id, category);

-- ---------------------------------------------------------------------------
-- Pre-seed system relation types (tenant_id = '1' = SYSTEM tenant)
-- ---------------------------------------------------------------------------
INSERT INTO cmdb_relation_type (id, tenant_id, name, description, category, is_symmetric, attributes, is_system, created_at, updated_at)
VALUES
  ('rt-depends_on',   '1', 'depends_on',   'Depends on (A depends on B)',         'dependency',    false, '{}', true, NOW(), NOW()),
  ('rt-hosted_on',    '1', 'hosted_on',    'Hosted on (A is hosted on B)',        'infrastructure', false, '{}', true, NOW(), NOW()),
  ('rt-contains',     '1', 'contains',     'Contains (A contains B)',             'composition',   false, '{}', true, NOW(), NOW()),
  ('rt-connects_to',  '1', 'connects_to',  'Connects to (A connects to B)',       'network',       false, '{}', true, NOW(), NOW()),
  ('rt-runs_on',      '1', 'runs_on',      'Runs on (A runs on B)',               'infrastructure', false, '{}', true, NOW(), NOW()),
  ('rt-belongs_to',   '1', 'belongs_to',   'Belongs to (A belongs to B)',         'organizational', false, '{}', true, NOW(), NOW()),
  ('rt-manages',      '1', 'manages',      'Manages (A manages B)',               'operational',   false, '{}', true, NOW(), NOW()),
  ('rt-monitors',     '1', 'monitors',     'Monitors (A monitors B)',             'operational',   false, '{}', true, NOW(), NOW())
ON CONFLICT (tenant_id, name) DO NOTHING;

-- ============================================================================
-- Rollback:
-- DROP TRIGGER IF EXISTS trg_cmdb_relation_type_updated_at ON cmdb_relation_type;
-- DROP FUNCTION IF EXISTS fn_set_cmdb_relation_type_updated_at();
-- DROP TABLE IF EXISTS cmdb_relation_type CASCADE;
-- ============================================================================
