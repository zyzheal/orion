-- Migration 072: Ticket Knowledge Mapping
-- Phase 3: Ticket-to-knowledge conversion tracking

-- Ticket Knowledge Mapping table
CREATE TABLE IF NOT EXISTS ticket_knowledge_mapping (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       VARCHAR(64) NOT NULL,
  ticket_id       VARCHAR(64) NOT NULL,
  knowledge_doc_id VARCHAR(64) NOT NULL,
  converted_by    VARCHAR(64) NOT NULL,
  converted_at    TIMESTAMPTZ DEFAULT NOW(),
  conversion_type VARCHAR(32) DEFAULT 'manual',  -- manual/auto
  include_comments BOOLEAN DEFAULT false,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tkm_ticket ON ticket_knowledge_mapping(tenant_id, ticket_id);
CREATE INDEX IF NOT EXISTS idx_tkm_knowledge ON ticket_knowledge_mapping(tenant_id, knowledge_doc_id);
CREATE INDEX IF NOT EXISTS idx_tkm_converter ON ticket_knowledge_mapping(tenant_id, converted_by);

-- RLS for ticket_knowledge_mapping
ALTER TABLE ticket_knowledge_mapping ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_knowledge_mapping FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON ticket_knowledge_mapping USING (tenant_id = current_setting('app.current_tenant_id', true));
