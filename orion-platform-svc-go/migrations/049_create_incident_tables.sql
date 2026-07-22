-- Incident module tables

CREATE TABLE IF NOT EXISTS incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(50) NOT NULL,
    severity VARCHAR(50),
    priority VARCHAR(50),
    status VARCHAR(50) NOT NULL,
    impact VARCHAR(255),
    urgency VARCHAR(50),
    commander_id VARCHAR(255),
    assigned_team VARCHAR(255),
    affected_services JSONB,
    escalation_level INTEGER DEFAULT 0,
    environment VARCHAR(255),
    service VARCHAR(255),
    detected_by VARCHAR(255),
    error_message TEXT,
    tags JSONB,
    resolved_by VARCHAR(255),
    closed_at TIMESTAMP WITH TIME ZONE,
    closed_by VARCHAR(255),
    related_problem_id VARCHAR(255),
    linked_problem_id VARCHAR(255),
    linked_change_id VARCHAR(255),
    sla_breach BOOLEAN DEFAULT FALSE,
    sla_breach_at TIMESTAMP WITH TIME ZONE,
    postmortem_required BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_incidents_tenant_id ON incidents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);
CREATE INDEX IF NOT EXISTS idx_incidents_severity ON incidents(severity);
CREATE INDEX IF NOT EXISTS idx_incidents_created_at ON incidents(created_at DESC);

CREATE TABLE IF NOT EXISTS incident_escalations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id VARCHAR(255) NOT NULL,
    tenant_id UUID NOT NULL,
    from_level INTEGER DEFAULT 0,
    to_level INTEGER DEFAULT 0,
    reason VARCHAR(255) NOT NULL,
    escalated_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_incident_escalations_incident_id ON incident_escalations(incident_id);
CREATE INDEX IF NOT EXISTS idx_incident_escalations_tenant_id ON incident_escalations(tenant_id);

CREATE TABLE IF NOT EXISTS incident_timeline_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id VARCHAR(255) NOT NULL,
    tenant_id UUID NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    actor_id VARCHAR(255),
    content TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_incident_timeline_events_incident_id ON incident_timeline_events(incident_id);
CREATE INDEX IF NOT EXISTS idx_incident_timeline_events_tenant_id ON incident_timeline_events(tenant_id);

CREATE TABLE IF NOT EXISTS incident_postmortems (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id VARCHAR(255) NOT NULL,
    tenant_id UUID NOT NULL,
    title VARCHAR(255),
    summary TEXT NOT NULL,
    root_cause TEXT,
    contributing_factors TEXT,
    impact_description TEXT,
    timeline_summary TEXT,
    actions TEXT,
    lessons_learned TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'draft',
    created_by VARCHAR(255),
    reviewed_by VARCHAR(255),
    published_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_incident_postmortems_incident_id ON incident_postmortems(incident_id);
CREATE INDEX IF NOT EXISTS idx_incident_postmortems_tenant_id ON incident_postmortems(tenant_id);
CREATE INDEX IF NOT EXISTS idx_incident_postmortems_status ON incident_postmortems(status);
