-- Ticketing module tables

CREATE TABLE IF NOT EXISTS tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'open',
    priority VARCHAR(50) NOT NULL DEFAULT 'medium',
    category VARCHAR(100),
    assignee_id VARCHAR(255),
    reporter_id VARCHAR(255) NOT NULL,
    source VARCHAR(100),
    source_id VARCHAR(255),
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    resolved_at TIMESTAMP WITH TIME ZONE,
    closed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_tickets_tenant_id ON tickets(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_priority ON tickets(priority);
CREATE INDEX IF NOT EXISTS idx_tickets_category ON tickets(category);
CREATE INDEX IF NOT EXISTS idx_tickets_assignee_id ON tickets(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tickets_reporter_id ON tickets(reporter_id);
CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON tickets(created_at DESC);

CREATE TABLE IF NOT EXISTS ticket_workflow_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id VARCHAR(255) NOT NULL,
    action VARCHAR(50) NOT NULL,
    from_state VARCHAR(50),
    to_state VARCHAR(50),
    user_id VARCHAR(255),
    comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ticket_workflow_history_ticket_id ON ticket_workflow_history(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_workflow_history_created_at ON ticket_workflow_history(created_at DESC);

CREATE TABLE IF NOT EXISTS ticket_relations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    ticket_id VARCHAR(255) NOT NULL,
    related_id VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    UNIQUE(tenant_id, ticket_id, related_id, type)
);

CREATE INDEX IF NOT EXISTS idx_ticket_relations_tenant_id ON ticket_relations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ticket_relations_ticket_id ON ticket_relations(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_relations_related_id ON ticket_relations(related_id);
CREATE INDEX IF NOT EXISTS idx_ticket_relations_type ON ticket_relations(type);

CREATE TABLE IF NOT EXISTS ticket_assignment_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    conditions TEXT,
    action VARCHAR(100) NOT NULL,
    target_id VARCHAR(255) NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ticket_assignment_rules_tenant_id ON ticket_assignment_rules(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ticket_assignment_rules_enabled ON ticket_assignment_rules(enabled);

CREATE TABLE IF NOT EXISTS ticket_sla_targets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    priority VARCHAR(50) NOT NULL,
    response_hours INTEGER NOT NULL,
    resolve_hours INTEGER NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ticket_sla_targets_tenant_id ON ticket_sla_targets(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ticket_sla_targets_priority ON ticket_sla_targets(priority);

CREATE TABLE IF NOT EXISTS ticket_dispatch_engineers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    skills TEXT,
    max_tickets INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    current_load INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ticket_dispatch_engineers_tenant_id ON ticket_dispatch_engineers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ticket_dispatch_engineers_user_id ON ticket_dispatch_engineers(user_id);
CREATE INDEX IF NOT EXISTS idx_ticket_dispatch_engineers_is_active ON ticket_dispatch_engineers(is_active);

CREATE TABLE IF NOT EXISTS ticket_dispatch_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    conditions TEXT,
    strategy VARCHAR(50) NOT NULL DEFAULT 'round_robin',
    weight INTEGER DEFAULT 1,
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ticket_dispatch_rules_tenant_id ON ticket_dispatch_rules(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ticket_dispatch_rules_enabled ON ticket_dispatch_rules(enabled);

CREATE TABLE IF NOT EXISTS ticket_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id VARCHAR(255) NOT NULL,
    from_user_id VARCHAR(255) NOT NULL,
    to_user_id VARCHAR(255) NOT NULL,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ticket_transfers_ticket_id ON ticket_transfers(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_transfers_created_at ON ticket_transfers(created_at DESC);

CREATE TABLE IF NOT EXISTS ticket_suspends (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    engineer_id VARCHAR(255) NOT NULL,
    reason TEXT,
    type VARCHAR(50) NOT NULL DEFAULT 'scheduled',
    start_at TIMESTAMP WITH TIME ZONE NOT NULL,
    end_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ticket_suspends_tenant_id ON ticket_suspends(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ticket_suspends_engineer_id ON ticket_suspends(engineer_id);
CREATE INDEX IF NOT EXISTS idx_ticket_suspends_status ON ticket_suspends(status);

CREATE TABLE IF NOT EXISTS ticket_sla_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    priority VARCHAR(50) NOT NULL,
    response_hours INTEGER NOT NULL,
    resolve_hours INTEGER NOT NULL,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ticket_sla_policies_tenant_id ON ticket_sla_policies(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ticket_sla_policies_active ON ticket_sla_policies(active);

CREATE TABLE IF NOT EXISTS ticket_sla_breaches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id VARCHAR(255) NOT NULL,
    policy_id INTEGER NOT NULL,
    type VARCHAR(50) NOT NULL,
    breached_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ticket_sla_breaches_ticket_id ON ticket_sla_breaches(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_sla_breaches_type ON ticket_sla_breaches(type);

CREATE TABLE IF NOT EXISTS ticket_automation_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    trigger VARCHAR(100) NOT NULL,
    condition TEXT,
    action VARCHAR(100) NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ticket_automation_rules_tenant_id ON ticket_automation_rules(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ticket_automation_rules_enabled ON ticket_automation_rules(enabled);
CREATE INDEX IF NOT EXISTS idx_ticket_automation_rules_trigger ON ticket_automation_rules(trigger);
