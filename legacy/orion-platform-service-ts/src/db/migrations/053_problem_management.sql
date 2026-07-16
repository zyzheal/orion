-- Migration 053: Problem Management (ITIL Standard)
-- Problem records and Known Error Database (KEDB)

CREATE TABLE IF NOT EXISTS problems (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'known',
  severity VARCHAR(20) NOT NULL DEFAULT 'medium',
  category VARCHAR(100),
  root_cause TEXT,
  workaround TEXT,
  resolution TEXT,
  related_incidents JSONB DEFAULT '[]',
  related_changes JSONB DEFAULT '[]',
  assigned_to VARCHAR(255),
  created_by VARCHAR(255),
  resolved_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_problems_tenant ON problems(tenant_id);
CREATE INDEX IF NOT EXISTS idx_problems_status ON problems(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_problems_severity ON problems(tenant_id, severity);

-- Known Error Database (KEDB)
CREATE TABLE IF NOT EXISTS known_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  problem_id UUID REFERENCES problems(id),
  title VARCHAR(500) NOT NULL,
  symptoms TEXT NOT NULL,
  root_cause TEXT NOT NULL,
  workaround TEXT NOT NULL,
  permanent_fix TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  affected_services JSONB DEFAULT '[]',
  keywords TEXT[],
  created_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_known_errors_tenant ON known_errors(tenant_id);
CREATE INDEX IF NOT EXISTS idx_known_errors_status ON known_errors(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_known_errors_keywords ON known_errors USING GIN(keywords);
