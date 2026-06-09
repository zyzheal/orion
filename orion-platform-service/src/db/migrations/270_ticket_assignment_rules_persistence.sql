-- Ticket assignment rules for auto-assignment
CREATE TABLE IF NOT EXISTS ticket_assignment_rules (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  name VARCHAR(255) NOT NULL,
  categories JSONB NOT NULL DEFAULT '[]',
  assignee VARCHAR(64) NOT NULL,
  priorities JSONB,
  enabled BOOLEAN NOT NULL DEFAULT true,
  rule_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ticket_assignment_rules_tenant_id ON ticket_assignment_rules(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ticket_assignment_rules_enabled ON ticket_assignment_rules(enabled);
CREATE INDEX IF NOT EXISTS idx_ticket_assignment_rules_order ON ticket_assignment_rules(rule_order);
