-- 002_p0_domains.sql - Phase 1 P0 domain tables
-- Alert Silence
CREATE TABLE IF NOT EXISTS alert_silences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    alert_id UUID,
    matcher TEXT,
    duration INT NOT NULL,
    reason TEXT NOT NULL,
    created_by VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_alert_silences_tenant ON alert_silences(tenant_id);
CREATE INDEX idx_alert_silences_expires ON alert_silences(expires_at);

-- On-Call Schedules
CREATE TABLE IF NOT EXISTS oncall_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_primary BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS oncall_rotations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id UUID REFERENCES oncall_schedules(id),
    user_id VARCHAR(255) NOT NULL,
    user_name VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    start_date TIMESTAMP NOT NULL,
    end_date TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_oncall_schedules_tenant ON oncall_schedules(tenant_id);
CREATE INDEX idx_oncall_rotations_schedule ON oncall_rotations(schedule_id);

-- Self-Healing Actions
CREATE TABLE IF NOT EXISTS healing_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    action_type VARCHAR(50) NOT NULL,
    target VARCHAR(255) NOT NULL,
    command TEXT,
    is_enabled BOOLEAN DEFAULT TRUE,
    retry_count INT DEFAULT 0,
    retry_delay INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS healing_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    action_id UUID REFERENCES healing_actions(id),
    trigger_id UUID,
    status VARCHAR(50) NOT NULL,
    result TEXT,
    attempt INT DEFAULT 1,
    triggered_by VARCHAR(255) NOT NULL,
    started_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP
);

CREATE INDEX idx_healing_actions_tenant ON healing_actions(tenant_id);
CREATE INDEX idx_healing_history_action ON healing_history(action_id);
CREATE INDEX idx_healing_history_status ON healing_history(status);

-- Root Cause Analysis
CREATE TABLE IF NOT EXISTS rca_analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    incident_id VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'running',
    root_causes TEXT,
    confidence FLOAT DEFAULT 0.0,
    triggered_by VARCHAR(255) NOT NULL,
    started_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rca_root_causes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    analysis_id UUID REFERENCES rca_analyses(id),
    component VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    description TEXT,
    evidence TEXT,
    impact VARCHAR(50) NOT NULL,
    priority INT DEFAULT 1,
    fixes TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rca_timeline_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    incident_id VARCHAR(255) NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    type VARCHAR(50) NOT NULL,
    source VARCHAR(255),
    message TEXT,
    severity VARCHAR(20)
);

CREATE INDEX idx_rca_analyses_tenant ON rca_analyses(tenant_id);
CREATE INDEX idx_rca_analyses_incident ON rca_analyses(incident_id);
CREATE INDEX idx_rca_root_causes_analysis ON rca_root_causes(analysis_id);
CREATE INDEX idx_rca_timeline_events_incident ON rca_timeline_events(incident_id);
