-- 095: Approval Workflow
-- 多级审批、紧急通道、审批模板

CREATE TABLE IF NOT EXISTS approval_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  request_type VARCHAR(30) NOT NULL DEFAULT 'deployment',
  requester_id VARCHAR(100) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending, in_progress, approved, rejected, expired
  approval_chain JSONB NOT NULL DEFAULT '[]',
  current_step INT NOT NULL DEFAULT 1,
  total_steps INT NOT NULL DEFAULT 1,
  is_emergency BOOLEAN NOT NULL DEFAULT false,
  emergency_reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);
CREATE INDEX idx_approval_requests_tenant ON approval_requests(tenant_id);
CREATE INDEX idx_approval_requests_status ON approval_requests(status);
CREATE INDEX idx_approval_requests_requester ON approval_requests(requester_id);
CREATE INDEX idx_approval_requests_type ON approval_requests(request_type);
CREATE INDEX idx_approval_requests_created ON approval_requests(created_at DESC);

CREATE TABLE IF NOT EXISTS approval_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  approval_steps JSONB NOT NULL DEFAULT '[]',
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_by VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_approval_templates_tenant ON approval_templates(tenant_id);
CREATE INDEX idx_approval_templates_default ON approval_templates(tenant_id, is_default) WHERE is_default = true;
CREATE INDEX idx_approval_templates_created ON approval_templates(created_at DESC);

-- ============================================================
-- Row Level Security (RLS) Policies
-- ============================================================

-- approval_requests
ALTER TABLE approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_requests FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_approval_requests ON approval_requests
    USING (
        current_setting('app.current_tenant_id', true) IS NOT NULL
        AND current_setting('app.current_tenant_id', true) != ''
        AND tenant_id::text = current_setting('app.current_tenant_id')
    );

CREATE INDEX IF NOT EXISTS idx_approval_requests_tenant_rls ON approval_requests(tenant_id);

COMMENT ON POLICY tenant_isolation_approval_requests ON approval_requests IS
    'Tenant isolation RLS policy - approval requests visible only to owning tenant';

-- approval_templates
ALTER TABLE approval_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_templates FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_approval_templates ON approval_templates
    USING (
        current_setting('app.current_tenant_id', true) IS NOT NULL
        AND current_setting('app.current_tenant_id', true) != ''
        AND tenant_id::text = current_setting('app.current_tenant_id')
    );

CREATE INDEX IF NOT EXISTS idx_approval_templates_tenant_rls ON approval_templates(tenant_id);

COMMENT ON POLICY tenant_isolation_approval_templates ON approval_templates IS
    'Tenant isolation RLS policy - approval templates visible only to owning tenant';
