-- Migration 313: Change Management (ITSM Phase C)
-- Tables: change_requests, cab_meetings, change_timeline, rfcs

-- Change Requests
CREATE TABLE IF NOT EXISTS change_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(64) NOT NULL,  -- 应用层通过 getCurrentTenantId() 设置
  title VARCHAR(500) NOT NULL,
  description TEXT,
  type VARCHAR(30) NOT NULL DEFAULT 'standard', -- standard, normal, emergency
  category VARCHAR(100),
  priority VARCHAR(20) NOT NULL DEFAULT 'medium', -- critical, high, medium, low
  risk_level VARCHAR(20) NOT NULL DEFAULT 'medium', -- high, medium, low
  status VARCHAR(30) NOT NULL DEFAULT 'draft', -- draft, submitted, approved, rejected, in_progress, completed, cancelled, closed
  impact_description TEXT,
  rollback_plan TEXT,
  implementation_plan TEXT,
  scheduled_start TIMESTAMP,
  scheduled_end TIMESTAMP,
  actual_start TIMESTAMP,
  actual_end TIMESTAMP,
  requester_id VARCHAR(128),
  assigned_to VARCHAR(128),
  approved_by VARCHAR(128),
  approved_at TIMESTAMP,
  rejected_by VARCHAR(128),
  rejected_at TIMESTAMP,
  rejection_reason TEXT,
  related_incidents UUID[],
  related_problems UUID[],
  affected_services TEXT[],
  metadata JSONB,
  created_by VARCHAR(128),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- CAB (Change Advisory Board) Meetings
CREATE TABLE IF NOT EXISTS cab_meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(64) NOT NULL,  -- 应用层通过 getCurrentTenantId() 设置
  title VARCHAR(500) NOT NULL,
  description TEXT,
  scheduled_at TIMESTAMP NOT NULL,
  location VARCHAR(255),
  attendees TEXT[],
  status VARCHAR(20) NOT NULL DEFAULT 'scheduled', -- scheduled, in_progress, completed, cancelled
  minutes TEXT,
  decisions JSONB, -- array of {changeRequestId, decision, notes}
  created_by VARCHAR(128),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Change Request Timeline Events
CREATE TABLE IF NOT EXISTS change_timeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(64) NOT NULL,  -- 应用层通过 getCurrentTenantId() 设置
  change_request_id UUID NOT NULL REFERENCES change_requests(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL, -- status_change, comment, approval, rejection, assignment
  description TEXT NOT NULL,
  created_by VARCHAR(128),
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- RFC (Request for Change) -- linked to change_requests
CREATE TABLE IF NOT EXISTS rfcs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(64) NOT NULL,  -- 应用层通过 getCurrentTenantId() 设置
  change_request_id UUID NOT NULL REFERENCES change_requests(id) ON DELETE CASCADE,
  rfc_number VARCHAR(50) NOT NULL,
  justification TEXT,
  risk_assessment TEXT,
  test_plan TEXT,
  communication_plan TEXT,
  backout_plan TEXT,
  cab_meeting_id UUID REFERENCES cab_meetings(id),
  status VARCHAR(30) NOT NULL DEFAULT 'draft', -- draft, pending_review, approved, rejected
  reviewed_by VARCHAR(128),
  reviewed_at TIMESTAMP,
  created_by VARCHAR(128),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_change_requests_tenant ON change_requests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_change_requests_status ON change_requests(status);
CREATE INDEX IF NOT EXISTS idx_change_requests_type ON change_requests(type);
CREATE INDEX IF NOT EXISTS idx_change_requests_priority ON change_requests(priority);
CREATE INDEX IF NOT EXISTS idx_cab_meetings_tenant ON cab_meetings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_change_timeline_change ON change_timeline(change_request_id);
CREATE INDEX IF NOT EXISTS idx_rfcs_change ON rfcs(change_request_id);
CREATE INDEX IF NOT EXISTS idx_rfcs_tenant ON rfcs(tenant_id);

-- RLS 多租户隔离
ALTER TABLE change_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE change_requests FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON change_requests USING (tenant_id = current_setting('app.current_tenant_id', true));

ALTER TABLE cab_meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE cab_meetings FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON cab_meetings USING (tenant_id = current_setting('app.current_tenant_id', true));

ALTER TABLE change_timeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE change_timeline FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON change_timeline USING (tenant_id = current_setting('app.current_tenant_id', true));

ALTER TABLE rfcs ENABLE ROW LEVEL SECURITY;
ALTER TABLE rfcs FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON rfcs USING (tenant_id = current_setting('app.current_tenant_id', true));
