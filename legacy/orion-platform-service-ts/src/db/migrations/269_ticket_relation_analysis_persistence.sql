-- Ticket relation analysis records
CREATE TABLE IF NOT EXISTS ticket_relation_analysis (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  ticket_id VARCHAR(64) NOT NULL,
  related_ticket_id VARCHAR(64) NOT NULL,
  relation_type VARCHAR(32) NOT NULL DEFAULT 'related',
  confidence NUMERIC(5,4),
  created_by VARCHAR(64),
  description TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ticket_relation_analysis_tenant_id ON ticket_relation_analysis(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ticket_relation_analysis_ticket_id ON ticket_relation_analysis(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_relation_analysis_related_ticket_id ON ticket_relation_analysis(related_ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_relation_analysis_relation_type ON ticket_relation_analysis(relation_type);
