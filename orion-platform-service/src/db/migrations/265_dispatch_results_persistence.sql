-- Dispatch results for analytics tracking
CREATE TABLE IF NOT EXISTS dispatch_results (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  ticket_id VARCHAR(64) NOT NULL,
  assignee VARCHAR(64) NOT NULL,
  reason TEXT,
  score NUMERIC(5,2) NOT NULL DEFAULT 0,
  dispatched_at TIMESTAMP NOT NULL,
  dispatch_type VARCHAR(32) NOT NULL DEFAULT 'auto',
  score_breakdown JSONB,
  accepted BOOLEAN NOT NULL DEFAULT false,
  time_to_acceptance_ms INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dispatch_results_tenant_id ON dispatch_results(tenant_id);
CREATE INDEX IF NOT EXISTS idx_dispatch_results_ticket_id ON dispatch_results(ticket_id);
CREATE INDEX IF NOT EXISTS idx_dispatch_results_assignee ON dispatch_results(assignee);
CREATE INDEX IF NOT EXISTS idx_dispatch_results_dispatched_at ON dispatch_results(dispatched_at);
