-- SLA module tables

CREATE TABLE IF NOT EXISTS sla_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(100),
    target_value DOUBLE PRECISION NOT NULL,
    target_unit VARCHAR(50),
    business_hours_only BOOLEAN,
    priority VARCHAR(50),
    category VARCHAR(100),
    escalation_rules TEXT,
    metadata TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    created_by VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sla_definitions_tenant_id ON sla_definitions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sla_definitions_type ON sla_definitions(type);
CREATE INDEX IF NOT EXISTS idx_sla_definitions_status ON sla_definitions(status);
CREATE INDEX IF NOT EXISTS idx_sla_definitions_category ON sla_definitions(category);

CREATE TABLE IF NOT EXISTS sla_trackings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    sla_definition_id VARCHAR(255) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'tracking',
    target_time TIMESTAMP WITH TIME ZONE,
    actual_time TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    pause_reason TEXT,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sla_trackings_tenant_id ON sla_trackings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sla_trackings_sla_definition_id ON sla_trackings(sla_definition_id);
CREATE INDEX IF NOT EXISTS idx_sla_trackings_entity ON sla_trackings(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_sla_trackings_status ON sla_trackings(status);

CREATE TABLE IF NOT EXISTS sla_breach_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    tracking_id VARCHAR(255) NOT NULL,
    breach_time TIMESTAMP WITH TIME ZONE NOT NULL,
    breach_details TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sla_breach_events_tenant_id ON sla_breach_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sla_breach_events_tracking_id ON sla_breach_events(tracking_id);
CREATE INDEX IF NOT EXISTS idx_sla_breach_events_breach_time ON sla_breach_events(breach_time DESC);
