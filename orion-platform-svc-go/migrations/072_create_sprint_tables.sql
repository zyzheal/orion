-- Sprint module tables

CREATE TABLE IF NOT EXISTS sprints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    goal TEXT,
    start_date VARCHAR(255),
    end_date VARCHAR(255),
    status VARCHAR(50) NOT NULL DEFAULT 'planning',
    capacity INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sprints_tenant_id ON sprints(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sprints_status ON sprints(status);

CREATE TABLE IF NOT EXISTS sprint_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    sprint_id VARCHAR(255) NOT NULL,
    ticket_id VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'todo',
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    UNIQUE(tenant_id, sprint_id, ticket_id)
);

CREATE INDEX IF NOT EXISTS idx_sprint_tickets_tenant_id ON sprint_tickets(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sprint_tickets_sprint_id ON sprint_tickets(sprint_id);
CREATE INDEX IF NOT EXISTS idx_sprint_tickets_ticket_id ON sprint_tickets(ticket_id);
CREATE INDEX IF NOT EXISTS idx_sprint_tickets_status ON sprint_tickets(status);
CREATE INDEX IF NOT EXISTS idx_sprint_tickets_sort_order ON sprint_tickets(sprint_id, sort_order);
