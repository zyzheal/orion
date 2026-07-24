-- Migration 010: Approvals
-- Approval workflow definitions and instances

CREATE TABLE IF NOT EXISTS approval_definitions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name          VARCHAR(200) NOT NULL,
  description   TEXT,
  trigger_event VARCHAR(100) NOT NULL,
  approvers     JSONB NOT NULL DEFAULT '[]',
  approval_type VARCHAR(50) NOT NULL DEFAULT 'sequential',
  timeout_hours INT,
  auto_approve_after INT,
  status        VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_approval_defs_tenant ON approval_definitions(tenant_id);

-- Approval instances
CREATE TABLE IF NOT EXISTS approvals (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  definition_id UUID REFERENCES approval_definitions(id) ON DELETE SET NULL,
  resource_type VARCHAR(100) NOT NULL,
  resource_id   UUID NOT NULL,
  status        VARCHAR(20) NOT NULL DEFAULT 'pending',
  requested_by  UUID REFERENCES users(id),
  current_step  INT NOT NULL DEFAULT 0,
  total_steps   INT NOT NULL DEFAULT 1,
  result        JSONB,
  completed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_approvals_tenant ON approvals(tenant_id);
CREATE INDEX idx_approvals_status ON approvals(status);
CREATE INDEX idx_approvals_resource ON approvals(resource_type, resource_id);

-- Approval steps (individual approval actions)
CREATE TABLE IF NOT EXISTS approval_steps (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_id   UUID NOT NULL REFERENCES approvals(id) ON DELETE CASCADE,
  step_index    INT NOT NULL,
  approver_id   UUID REFERENCES users(id),
  status        VARCHAR(20) NOT NULL DEFAULT 'pending',
  comment       TEXT,
  acted_at      TIMESTAMPTZ
);
CREATE INDEX idx_approval_steps_approval ON approval_steps(approval_id);

-- Rollback:
-- DROP TABLE IF EXISTS approval_steps, approvals, approval_definitions;
