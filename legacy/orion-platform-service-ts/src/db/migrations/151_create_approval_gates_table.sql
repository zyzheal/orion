-- Migration: 151_create_approval_gates_table.sql
-- Creates approval_gates table for Pipeline approval gate persistence

CREATE TABLE IF NOT EXISTS approval_gates (
  id VARCHAR(255) PRIMARY KEY,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  run_id VARCHAR(255) NOT NULL,
  stage_id VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  requested_by VARCHAR(255) NOT NULL,
  requested_at TIMESTAMP NOT NULL DEFAULT NOW(),
  reviewed_by VARCHAR(255),
  reviewed_at TIMESTAMP,
  comment TEXT,
  approver_ids JSONB NOT NULL DEFAULT '[]',
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_approval_gates_run_id ON approval_gates(run_id);
CREATE INDEX IF NOT EXISTS idx_approval_gates_stage_id ON approval_gates(stage_id);
CREATE INDEX IF NOT EXISTS idx_approval_gates_tenant_id ON approval_gates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_approval_gates_status ON approval_gates(status);
CREATE INDEX IF NOT EXISTS idx_approval_gates_run_stage ON approval_gates(run_id, stage_id);

-- Composite index for getPendingByApprover
CREATE INDEX IF NOT EXISTS idx_approval_gates_tenant_status_approver
  ON approval_gates(tenant_id, status)
  WHERE status = 'pending';