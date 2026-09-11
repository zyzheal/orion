-- Ticketing schema fixes: add missing columns and tables for SLA tracking,
-- dispatch weights, service state, and tenant isolation on transfers/breaches.
-- Mirrors additional tables from TypeScript TicketWorkflowRepository.

-- Add SLA policy foreign key to tickets
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS sla_policy_id UUID;
CREATE INDEX IF NOT EXISTS idx_tickets_sla_policy_id ON tickets(sla_policy_id);

-- Add tenant_id to ticket_transfers (currently missing)
ALTER TABLE ticket_transfers ADD COLUMN IF NOT EXISTS tenant_id UUID;
CREATE INDEX IF NOT EXISTS idx_ticket_transfers_tenant_id ON ticket_transfers(tenant_id);

-- Add tenant_id to ticket_sla_breaches (currently missing)
ALTER TABLE ticket_sla_breaches ADD COLUMN IF NOT EXISTS tenant_id UUID;
CREATE INDEX IF NOT EXISTS idx_ticket_sla_breaches_tenant_id ON ticket_sla_breaches(tenant_id);

-- Ticket SLA tracking (per-ticket SLA status)
CREATE TABLE IF NOT EXISTS ticket_sla_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id VARCHAR(255) NOT NULL,
    priority VARCHAR(50) NOT NULL,
    target_resolution_time_ms BIGINT NOT NULL,
    actual_resolution_time_ms BIGINT,
    breached BOOLEAN DEFAULT FALSE,
    breached_at TIMESTAMP WITH TIME ZONE,
    resolved_at TIMESTAMP WITH TIME ZONE,
    first_response_at TIMESTAMP WITH TIME ZONE,
    response_breached BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ticket_sla_tracking_ticket_id ON ticket_sla_tracking(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_sla_tracking_breached ON ticket_sla_tracking(breached);

-- Ticket assignments (separate from workflow history)
CREATE TABLE IF NOT EXISTS ticket_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    ticket_id VARCHAR(255) NOT NULL,
    assignee VARCHAR(255) NOT NULL,
    assigned_by VARCHAR(255) NOT NULL,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ticket_assignments_tenant_id ON ticket_assignments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ticket_assignments_ticket_id ON ticket_assignments(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_assignments_assignee ON ticket_assignments(assignee);

-- Dispatch weights (engineer-to-weight mapping)
CREATE TABLE IF NOT EXISTS ticketing_dispatch_weights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    engineer_id VARCHAR(255) NOT NULL,
    weight INTEGER DEFAULT 1,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    UNIQUE(tenant_id, engineer_id)
);

CREATE INDEX IF NOT EXISTS idx_ticketing_dispatch_weights_tenant_id ON ticketing_dispatch_weights(tenant_id);

-- Service state (per-tenant service active flag)
CREATE TABLE IF NOT EXISTS ticketing_service_state (
    tenant_id UUID PRIMARY KEY,
    active BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Update SLA breach inserts to use tenant_id (migration backfill not needed)
-- Note: existing rows will have NULL tenant_id; application handles this.
