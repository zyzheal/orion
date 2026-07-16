-- Migration 075: Disaster Recovery Configuration Tables
-- Tracks disaster recovery configuration and failover events for Orion platform

-- Disaster recovery configuration table
CREATE TABLE IF NOT EXISTS disaster_recovery_config (
    id SERIAL PRIMARY KEY,
    component_type VARCHAR(32) NOT NULL,
    primary_cluster VARCHAR(128) NOT NULL,
    standby_cluster VARCHAR(128) NOT NULL,
    replication_mode VARCHAR(32) NOT NULL DEFAULT 'async',
    rto_target_seconds INTEGER NOT NULL DEFAULT 600,
    rpo_target_seconds INTEGER NOT NULL DEFAULT 300,
    health_check_interval_seconds INTEGER DEFAULT 30,
    last_health_check_at TIMESTAMPTZ,
    last_successful_health_check_at TIMESTAMPTZ,
    primary_status VARCHAR(16) DEFAULT 'healthy',
    standby_status VARCHAR(16) DEFAULT 'ready',
    failover_threshold INTEGER DEFAULT 3,
    consecutive_failures INTEGER DEFAULT 0,
    status VARCHAR(16) DEFAULT 'configured',
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_dr_config_component ON disaster_recovery_config(component_type);
CREATE INDEX idx_dr_config_status ON disaster_recovery_config(status);
CREATE INDEX idx_dr_config_enabled ON disaster_recovery_config(enabled);
CREATE INDEX idx_dr_config_primary_status ON disaster_recovery_config(primary_status);

-- Disaster recovery events table
CREATE TABLE IF NOT EXISTS disaster_recovery_events (
    id SERIAL PRIMARY KEY,
    event_type VARCHAR(32) NOT NULL,
    component_type VARCHAR(32) NOT NULL,
    config_id INTEGER NOT NULL REFERENCES disaster_recovery_config(id),
    triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    success BOOLEAN DEFAULT false,
    trigger_reason VARCHAR(64),
    rto_actual_seconds INTEGER,
    rpo_actual_seconds INTEGER,
    data_loss_detected BOOLEAN DEFAULT false,
    rollback_performed BOOLEAN DEFAULT false,
    affected_services JSONB DEFAULT '[]',
    error_message TEXT,
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_dr_events_type ON disaster_recovery_events(event_type);
CREATE INDEX idx_dr_events_component ON disaster_recovery_events(component_type);
CREATE INDEX idx_dr_events_triggered ON disaster_recovery_events(triggered_at);
CREATE INDEX idx_dr_events_success ON disaster_recovery_events(success);
CREATE INDEX idx_dr_events_config ON disaster_recovery_events(config_id);

-- Health check history table
CREATE TABLE IF NOT EXISTS disaster_recovery_health_checks (
    id SERIAL PRIMARY KEY,
    config_id INTEGER NOT NULL REFERENCES disaster_recovery_config(id),
    check_type VARCHAR(32) NOT NULL,
    target_cluster VARCHAR(128) NOT NULL,
    checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_healthy BOOLEAN NOT NULL,
    response_time_ms INTEGER,
    details JSONB DEFAULT '{}'
);

CREATE INDEX idx_dr_health_checks_config ON disaster_recovery_health_checks(config_id);
CREATE INDEX idx_dr_health_checks_time ON disaster_recovery_health_checks(checked_at);
CREATE INDEX idx_dr_health_checks_healthy ON disaster_recovery_health_checks(is_healthy);

COMMENT ON TABLE disaster_recovery_config IS 'Disaster recovery configuration for primary-standby cluster pairs';
COMMENT ON COLUMN disaster_recovery_config.component_type IS 'Component type: database, api_gateway, platform_service, frontend, ai_service';
COMMENT ON COLUMN disaster_recovery_config.primary_cluster IS 'Primary cluster endpoint/identifier';
COMMENT ON COLUMN disaster_recovery_config.standby_cluster IS 'Standby cluster endpoint/identifier';
COMMENT ON COLUMN disaster_recovery_config.replication_mode IS 'Replication mode: async, semi_sync, sync';
COMMENT ON COLUMN disaster_recovery_config.rto_target_seconds IS 'Target Recovery Time Objective in seconds (default 600 = 10 min)';
COMMENT ON COLUMN disaster_recovery_config.rpo_target_seconds IS 'Target Recovery Point Objective in seconds (default 300 = 5 min)';
COMMENT ON COLUMN disaster_recovery_config.health_check_interval_seconds IS 'Interval between health checks in seconds';
COMMENT ON COLUMN disaster_recovery_config.failover_threshold IS 'Number of consecutive failures before triggering failover';
COMMENT ON COLUMN disaster_recovery_config.status IS 'Configuration status: configured, active, failover_in_progress, failed';

COMMENT ON TABLE disaster_recovery_events IS 'Disaster recovery failover event history';
COMMENT ON COLUMN disaster_recovery_events.event_type IS 'Event type: health_check, failover_start, failover_complete, rollback, test_drill';
COMMENT ON COLUMN disaster_recovery_events.trigger_reason IS 'Reason for triggering: health_failure, manual, scheduled_drill, data_corruption';
COMMENT ON COLUMN disaster_recovery_events.rto_actual_seconds IS 'Actual RTO achieved during failover';
COMMENT ON COLUMN disaster_recovery_events.rpo_actual_seconds IS 'Actual RPO achieved during failover';
COMMENT ON COLUMN disaster_recovery_events.data_loss_detected IS 'Whether data loss was detected during failover';

COMMENT ON TABLE disaster_recovery_health_checks IS 'Health check history for disaster recovery monitoring';

-- Rollback:
-- DROP TABLE IF EXISTS disaster_recovery_health_checks;
-- DROP TABLE IF EXISTS disaster_recovery_events;
-- DROP TABLE IF EXISTS disaster_recovery_config;