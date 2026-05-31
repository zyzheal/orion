-- Assignment history for load balancer tracking
CREATE TABLE IF NOT EXISTS assignment_history (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64),
  ticket_id VARCHAR(64) NOT NULL,
  assignee VARCHAR(64) NOT NULL,
  assigned_by VARCHAR(64) NOT NULL,
  assigned_at TIMESTAMP NOT NULL,
  reason TEXT,
  match_score NUMERIC(5,4),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assignment_history_tenant_id ON assignment_history(tenant_id);
CREATE INDEX IF NOT EXISTS idx_assignment_history_assignee ON assignment_history(assignee);
CREATE INDEX IF NOT EXISTS idx_assignment_history_ticket_id ON assignment_history(ticket_id);
CREATE INDEX IF NOT EXISTS idx_assignment_history_assigned_at ON assignment_history(assigned_at);
