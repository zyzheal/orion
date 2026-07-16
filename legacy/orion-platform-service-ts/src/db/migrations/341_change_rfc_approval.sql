-- Migration 341: Change Request RFC Approval Chain
-- ITSM-style RFC (Request for Change) with multi-level approval workflow

CREATE TABLE IF NOT EXISTS change_request (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id VARCHAR(64) NOT NULL,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  change_type VARCHAR(50) NOT NULL, -- standard/normal/emergency
  risk_level VARCHAR(20) DEFAULT 'low', -- low/medium/high/critical
  impact_scope VARCHAR(50), -- minor/major/significant
  rollback_plan TEXT,
  scheduled_start TIMESTAMPTZ,
  scheduled_end TIMESTAMPTZ,
  status VARCHAR(30) DEFAULT 'draft', -- draft/pending_approval/approved/rejected/implementing/completed/cancelled
  created_by VARCHAR(128),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE change_request ENABLE ROW LEVEL SECURITY;
ALTER TABLE change_request FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON change_request USING (tenant_id = current_setting('app.current_tenant_id', true));

CREATE INDEX idx_change_request_tenant ON change_request(tenant_id);
CREATE INDEX idx_change_request_status ON change_request(status);
CREATE INDEX idx_change_request_type ON change_request(change_type);

-- change_approval - multi-level approval chain
CREATE TABLE IF NOT EXISTS change_approval (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id VARCHAR(64) NOT NULL,
  change_request_id TEXT NOT NULL REFERENCES change_request(id) ON DELETE CASCADE,
  approver_role VARCHAR(50) NOT NULL, -- supervisor/manager/cto
  approver_id VARCHAR(128),
  approval_order INTEGER NOT NULL,
  status VARCHAR(20) DEFAULT 'pending', -- pending/approved/rejected
  comment TEXT,
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE change_approval ENABLE ROW LEVEL SECURITY;
ALTER TABLE change_approval FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON change_approval USING (tenant_id = current_setting('app.current_tenant_id', true));

CREATE INDEX idx_change_approval_request ON change_approval(change_request_id);
CREATE INDEX idx_change_approval_order ON change_approval(change_request_id, approval_order);

-- change_execution - execution steps
CREATE TABLE IF NOT EXISTS change_execution (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id VARCHAR(64) NOT NULL,
  change_request_id TEXT NOT NULL REFERENCES change_request(id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL,
  step_name VARCHAR(255) NOT NULL,
  step_type VARCHAR(30) DEFAULT 'manual', -- manual/script/automated
  status VARCHAR(20) DEFAULT 'pending', -- pending/running/completed/failed/skipped
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  output TEXT,
  error TEXT,
  executed_by VARCHAR(128),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE change_execution ENABLE ROW LEVEL SECURITY;
ALTER TABLE change_execution FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON change_execution USING (tenant_id = current_setting('app.current_tenant_id', true));

CREATE INDEX idx_change_execution_request ON change_execution(change_request_id);
CREATE INDEX idx_change_execution_status ON change_execution(status);
