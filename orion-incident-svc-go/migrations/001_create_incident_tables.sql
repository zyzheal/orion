-- Incident service migrations
-- 001: Create incident, timeline, postmortem, escalation, SLA, diagnostic, self-healing tables

-- Incidents
CREATE TABLE IF NOT EXISTS incidents (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    deployment_id VARCHAR(256),
    pipeline_run_id VARCHAR(256),
    commit_sha VARCHAR(256),
    title VARCHAR(512),
    description TEXT,
    type VARCHAR(64) NOT NULL,
    severity VARCHAR(32) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'new',
    priority VARCHAR(32),
    impact VARCHAR(32),
    urgency VARCHAR(32),
    service VARCHAR(128),
    environment VARCHAR(64),
    error_message TEXT,
    detected_by VARCHAR(64),
    affected_services JSONB,
    tags JSONB,
    assigned_team VARCHAR(128),
    commander_id VARCHAR(64),
    related_problem_id VARCHAR(64),
    linked_problem_id VARCHAR(64),
    linked_change_id VARCHAR(64),
    postmortem_url VARCHAR(512),
    postmortem_summary TEXT,
    postmortem_required BOOLEAN DEFAULT FALSE,
    escalation_level INT DEFAULT 0,
    sla_breach BOOLEAN DEFAULT FALSE,
    sla_breach_at TIMESTAMP,
    resolved_by VARCHAR(64),
    closed_at TIMESTAMP,
    closed_by VARCHAR(64),
    detected_at TIMESTAMP NOT NULL DEFAULT NOW(),
    acknowledged_at TIMESTAMP,
    resolved_at TIMESTAMP,
    recovery_time_ms BIGINT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_incidents_tenant ON incidents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);
CREATE INDEX IF NOT EXISTS idx_incidents_severity ON incidents(severity);
CREATE INDEX IF NOT EXISTS idx_incidents_service ON incidents(service);
CREATE INDEX IF NOT EXISTS idx_incidents_environment ON incidents(environment);

-- Timeline events
CREATE TABLE IF NOT EXISTS timeline_events (
    id VARCHAR(64) PRIMARY KEY,
    incident_id VARCHAR(64) NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
    tenant_id VARCHAR(64) NOT NULL,
    event_type VARCHAR(64) NOT NULL,
    actor_id VARCHAR(64),
    content TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_timeline_events_incident ON timeline_events(incident_id);
CREATE INDEX IF NOT EXISTS idx_timeline_events_tenant ON timeline_events(tenant_id);

-- Postmortems
CREATE TABLE IF NOT EXISTS postmortems (
    id VARCHAR(64) PRIMARY KEY,
    incident_id VARCHAR(64) NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
    tenant_id VARCHAR(64) NOT NULL,
    title VARCHAR(512),
    summary TEXT NOT NULL,
    root_cause TEXT NOT NULL,
    contributing_factors JSONB,
    impact_description TEXT,
    timeline JSONB,
    timeline_summary TEXT,
    action_items JSONB,
    lessons_learned TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'draft',
    created_by VARCHAR(64),
    published_at TIMESTAMP,
    reviewed_by VARCHAR(64),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_postmortems_incident ON postmortems(incident_id);
CREATE INDEX IF NOT EXISTS idx_postmortems_tenant ON postmortems(tenant_id);

-- Escalation records
CREATE TABLE IF NOT EXISTS escalation_records (
    id VARCHAR(64) PRIMARY KEY,
    incident_id VARCHAR(64) NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
    tenant_id VARCHAR(64) NOT NULL,
    from_level INT NOT NULL,
    to_level INT NOT NULL,
    reason TEXT,
    escalated_by VARCHAR(64) NOT NULL,
    escalated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_escalation_records_incident ON escalation_records(incident_id);

-- SLA configs
CREATE TABLE IF NOT EXISTS sla_configs (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    severity VARCHAR(32) NOT NULL,
    response_minutes INT NOT NULL,
    resolution_minutes INT NOT NULL,
    escalation_minutes INT,
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sla_configs_tenant ON sla_configs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sla_configs_severity ON sla_configs(severity);

-- Diagnostic rules
CREATE TABLE IF NOT EXISTS diagnostic_rules (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    name VARCHAR(256) NOT NULL,
    description TEXT,
    trigger_type VARCHAR(64) NOT NULL,
    category VARCHAR(64),
    conditions JSONB,
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_diagnostic_rules_tenant ON diagnostic_rules(tenant_id);

-- Diagnostic results
CREATE TABLE IF NOT EXISTS diagnostic_results (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    rule_id VARCHAR(64),
    trigger_id VARCHAR(256),
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    symptoms JSONB,
    findings JSONB,
    root_cause JSONB,
    recommendations JSONB,
    executed_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_diagnostic_results_tenant ON diagnostic_results(tenant_id);
CREATE INDEX IF NOT EXISTS idx_diagnostic_results_rule ON diagnostic_results(rule_id);

-- Self-heal rules
CREATE TABLE IF NOT EXISTS self_heal_rules (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    name VARCHAR(256) NOT NULL,
    trigger_type VARCHAR(64) NOT NULL,
    action VARCHAR(64) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    config JSONB,
    enabled BOOLEAN DEFAULT TRUE,
    execution_count INT DEFAULT 0,
    last_triggered TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_self_heal_rules_tenant ON self_heal_rules(tenant_id);

-- Self-heal executions
CREATE TABLE IF NOT EXISTS self_heal_executions (
    id VARCHAR(64) PRIMARY KEY,
    rule_id VARCHAR(64) NOT NULL REFERENCES self_heal_rules(id) ON DELETE CASCADE,
    tenant_id VARCHAR(64) NOT NULL,
    trigger_event JSONB,
    status VARCHAR(32) NOT NULL DEFAULT 'running',
    result JSONB,
    error_message TEXT,
    started_at TIMESTAMP NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_self_heal_executions_rule ON self_heal_executions(rule_id);
CREATE INDEX IF NOT EXISTS idx_self_heal_executions_tenant ON self_heal_executions(tenant_id);
