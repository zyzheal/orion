-- Migration 334: Ticket Knowledge Mapping (工单转知识)
-- 工单与知识库关联

CREATE TABLE IF NOT EXISTS ticket_knowledge_mapping (
    id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id       TEXT NOT NULL,
    ticket_id       TEXT NOT NULL,
    knowledge_id    TEXT NOT NULL,
    mapping_type    TEXT NOT NULL DEFAULT 'related',
    confidence      NUMERIC(5,4),
    created_by      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, ticket_id, knowledge_id)
);

CREATE INDEX idx_ticket_knowledge_tenant ON ticket_knowledge_mapping(tenant_id);
CREATE INDEX idx_ticket_knowledge_ticket ON ticket_knowledge_mapping(ticket_id);
CREATE INDEX idx_ticket_knowledge_knowledge ON ticket_knowledge_mapping(knowledge_id);

ALTER TABLE ticket_knowledge_mapping ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_knowledge_mapping FORCE ROW LEVEL SECURITY;
CREATE POLICY ticket_knowledge_tenant_isolation ON ticket_knowledge_mapping
    USING (tenant_id = current_setting('app.current_tenant_id', true));
