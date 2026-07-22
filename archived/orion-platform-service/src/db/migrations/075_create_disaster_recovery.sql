-- Disaster Recovery Schema Migration
-- Version: 075
-- Description: Create disaster recovery configuration and monitoring tables

-- Enable UUID extension if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- 1. Disaster Recovery Configuration Table
-- =============================================================================
CREATE TABLE IF NOT EXISTS disaster_recovery_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    primary_cluster_id VARCHAR(255) NOT NULL,
    primary_cluster_endpoint VARCHAR(500) NOT NULL,
    standby_cluster_id VARCHAR(255) NOT NULL,
    standby_cluster_endpoint VARCHAR(500) NOT NULL,
    sync_mode VARCHAR(50) NOT NULL DEFAULT 'async',
    auto_failover BOOLEAN NOT NULL DEFAULT false,
    failover_threshold_seconds INTEGER NOT NULL DEFAULT 300,
    health_check_interval_seconds INTEGER NOT NULL DEFAULT 10,
    sync_interval_seconds INTEGER NOT NULL DEFAULT 60,
    rpo_target_seconds INTEGER NOT NULL DEFAULT 300,
    rto_target_seconds INTEGER NOT NULL DEFAULT 600,
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_sync_mode CHECK (sync_mode IN ('sync', 'async', 'semi-sync')),
    CONSTRAINT valid_status CHECK (status IN ('active', 'inactive', 'failing_over', 'failed_over', 'failed_back'))
);

CREATE INDEX idx_dr_config_primary_cluster ON disaster_recovery_config(primary_cluster_id);
CREATE INDEX idx_dr_config_standby_cluster ON disaster_recovery_config(standby_cluster_id);
CREATE INDEX idx_dr_config_status ON disaster_recovery_config(status);

-- =============================================================================
-- 2. Failover History Table
-- =============================================================================
CREATE TABLE IF NOT EXISTS failover_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    config_id UUID NOT NULL REFERENCES disaster_recovery_config(id),
    failover_type VARCHAR(50) NOT NULL,
    triggered_by VARCHAR(50) NOT NULL,
    trigger_reason TEXT,
    source_cluster_id VARCHAR(255) NOT NULL,
    target_cluster_id VARCHAR(255) NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    rpo_achieved_seconds INTEGER,
    rto_achieved_seconds INTEGER,
    error_message TEXT,
    metadata JSONB DEFAULT '{}',
    CONSTRAINT valid_failover_type CHECK (failover_type IN ('failover', 'failback')),
    CONSTRAINT valid_triggered_by CHECK (triggered_by IN ('manual', 'automatic', 'scheduled')),
    CONSTRAINT valid_failover_status CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'rolled_back'))
);

CREATE INDEX idx_failover_history_config ON failover_history(config_id);
CREATE INDEX idx_failover_history_status ON failover_history(status);
CREATE INDEX idx_failover_history_started ON failover_history(started_at DESC);

-- =============================================================================
-- 3. Replication Lag Monitoring Table
-- =============================================================================
CREATE TABLE IF NOT EXISTS replication_lag_monitoring (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    config_id UUID NOT NULL REFERENCES disaster_recovery_config(id),
    cluster_id VARCHAR(255) NOT NULL,
    lag_seconds INTEGER NOT NULL,
    lag_bytes BIGINT,
    last_sync_timestamp TIMESTAMP WITH TIME ZONE,
    replication_status VARCHAR(50) NOT NULL DEFAULT 'unknown',
    recorded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_replication_status CHECK (replication_status IN ('normal', 'delayed', 'stopped', 'error', 'unknown'))
);

CREATE INDEX idx_replication_lag_config ON replication_lag_monitoring(config_id);
CREATE INDEX idx_replication_lag_recorded ON replication_lag_monitoring(recorded_at DESC);

-- =============================================================================
-- 4. Health Check History Table
-- =============================================================================
CREATE TABLE IF NOT EXISTS health_check_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    config_id UUID NOT NULL REFERENCES disaster_recovery_config(id),
    cluster_id VARCHAR(255) NOT NULL,
    health_status VARCHAR(50) NOT NULL,
    response_time_ms INTEGER,
    error_message TEXT,
    checked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_health_status CHECK (health_status IN ('healthy', 'degraded', 'unhealthy', 'unknown'))
);

CREATE INDEX idx_health_check_config ON health_check_history(config_id);
CREATE INDEX idx_health_check_checked ON health_check_history(checked_at DESC);

-- =============================================================================
-- 5. Cluster Status Table
-- =============================================================================
CREATE TABLE IF NOT EXISTS cluster_status (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    config_id UUID NOT NULL REFERENCES disaster_recovery_config(id),
    cluster_id VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'unknown',
    last_heartbeat TIMESTAMP WITH TIME ZONE,
    data_center VARCHAR(255),
    region VARCHAR(255),
    availability_zone VARCHAR(255),
    connection_string VARCHAR(500),
    is_primary BOOLEAN NOT NULL DEFAULT false,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_role CHECK (role IN ('primary', 'standby', 'witness')),
    CONSTRAINT valid_cluster_status CHECK (status IN ('online', 'offline', 'syncing', 'unknown'))
);

CREATE INDEX idx_cluster_status_config ON cluster_status(config_id);
CREATE INDEX idx_cluster_status_cluster ON cluster_status(cluster_id);
CREATE UNIQUE INDEX idx_cluster_status_unique ON cluster_status(config_id, cluster_id);

-- =============================================================================
-- 6. Failover Lock Table (for distributed coordination)
-- =============================================================================
CREATE TABLE IF NOT EXISTS failover_lock (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    config_id UUID NOT NULL REFERENCES disaster_recovery_config(id),
    locked_by VARCHAR(255) NOT NULL,
    locked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_failover_lock_config ON failover_lock(config_id);
CREATE INDEX idx_failover_lock_active ON failover_lock(is_active) WHERE is_active = true;

-- =============================================================================
-- 7. Audit Log Table
-- =============================================================================
CREATE TABLE IF NOT EXISTS disaster_recovery_audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    config_id UUID REFERENCES disaster_recovery_config(id),
    action VARCHAR(255) NOT NULL,
    actor VARCHAR(255),
    actor_ip VARCHAR(45),
    details JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_dr_audit_config ON disaster_recovery_audit_log(config_id);
CREATE INDEX idx_dr_audit_created ON disaster_recovery_audit_log(created_at DESC);

-- =============================================================================
-- 8. Functions
-- =============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_dr_config_updated_at ON disaster_recovery_config;
CREATE TRIGGER update_dr_config_updated_at
    BEFORE UPDATE ON disaster_recovery_config
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_cluster_status_updated_at ON cluster_status;
CREATE TRIGGER update_cluster_status_updated_at
    BEFORE UPDATE ON cluster_status
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to check RPO compliance
CREATE OR REPLACE FUNCTION check_rpo_compliance(p_config_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_rpo_target INTEGER;
    v_current_lag INTEGER;
BEGIN
    SELECT rpo_target_seconds INTO v_rpo_target
    FROM disaster_recovery_config WHERE id = p_config_id;
    
    SELECT COALESCE(MAX(lag_seconds), 0) INTO v_current_lag
    FROM replication_lag_monitoring 
    WHERE config_id = p_config_id 
    AND recorded_at > NOW() - INTERVAL '5 minutes';
    
    RETURN v_current_lag <= v_rpo_target;
END;
$$ LANGUAGE plpgsql;

-- Function to check RTO compliance
CREATE OR REPLACE FUNCTION check_rto_compliance(p_failover_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_config_id UUID;
    v_rto_target INTEGER;
    v_rto_achieved INTEGER;
BEGIN
    SELECT config_id, rto_achieved_seconds INTO v_config_id, v_rto_achieved
    FROM failover_history WHERE id = p_failover_id;
    
    SELECT rto_target_seconds INTO v_rto_target
    FROM disaster_recovery_config WHERE id = v_config_id;
    
    RETURN v_rto_achieved <= v_rto_target;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 9. Views for Monitoring
-- =============================================================================

-- View for current DR status
CREATE OR REPLACE VIEW v_disaster_recovery_status AS
SELECT 
    dc.id AS config_id,
    dc.name,
    dc.primary_cluster_id,
    dc.primary_cluster_endpoint,
    dc.standby_cluster_id,
    dc.standby_cluster_endpoint,
    dc.sync_mode,
    dc.auto_failover,
    dc.rpo_target_seconds,
    dc.rto_target_seconds,
    dc.status AS config_status,
    cs_primary.status AS primary_status,
    cs_standby.status AS standby_status,
    rlm.lag_seconds AS current_lag_seconds,
    CASE 
        WHEN rlm.lag_seconds <= dc.rpo_target_seconds THEN 'compliant'
        ELSE 'non-compliant'
    END AS rpo_status,
    dc.updated_at AS last_updated
FROM disaster_recovery_config dc
LEFT JOIN cluster_status cs_primary ON dc.id = cs_primary.config_id AND cs_primary.is_primary = true
LEFT JOIN cluster_status cs_standby ON dc.id = cs_standby.config_id AND cs_standby.is_primary = false
LEFT JOIN LATERAL (
    SELECT lag_seconds 
    FROM replication_lag_monitoring rlm 
    WHERE rlm.config_id = dc.id 
    ORDER BY recorded_at DESC 
    LIMIT 1
) rlm ON true;

-- View for failover metrics
CREATE OR REPLACE VIEW v_failover_metrics AS
SELECT 
    dc.id AS config_id,
    dc.name,
    COUNT(fh.id) AS total_failovers,
    COUNT(CASE WHEN fh.status = 'completed' THEN 1 END) AS successful_failovers,
    COUNT(CASE WHEN fh.status = 'failed' THEN 1 END) AS failed_failovers,
    AVG(fh.rto_achieved_seconds) AS avg_rto_seconds,
    MAX(fh.rto_achieved_seconds) AS max_rto_seconds,
    MIN(fh.rto_achieved_seconds) AS min_rto_seconds,
    dc.rto_target_seconds,
    MAX(fh.completed_at) AS last_failover_time
FROM disaster_recovery_config dc
LEFT JOIN failover_history fh ON dc.id = fh.config_id
GROUP BY dc.id, dc.name, dc.rto_target_seconds;

-- =============================================================================
-- 10. Initial Data / Default Configuration
-- =============================================================================

-- Insert a default DR configuration template (can be customized)
INSERT INTO disaster_recovery_config (
    name,
    primary_cluster_id,
    primary_cluster_endpoint,
    standby_cluster_id,
    standby_cluster_endpoint,
    sync_mode,
    auto_failover,
    rpo_target_seconds,
    rto_target_seconds
) VALUES (
    'Default DR Configuration',
    'primary-cluster-001',
    'primary.orion-platform.local:5432',
    'standby-cluster-001',
    'standby.orion-platform.local:5432',
    'async',
    false,
    300,  -- RPO < 5 minutes
    600   -- RTO < 10 minutes
) ON CONFLICT DO NOTHING;

-- =============================================================================
-- 11. Comments for Documentation
-- =============================================================================
COMMENT ON TABLE disaster_recovery_config IS 'Stores disaster recovery configuration including primary/standby cluster settings, sync modes, and RPO/RTO targets';
COMMENT ON TABLE failover_history IS 'Records all failover and failback operations with timing and status';
COMMENT ON TABLE replication_lag_monitoring IS 'Monitors replication lag between primary and standby clusters';
COMMENT ON TABLE health_check_history IS 'Records health check results for all clusters';
COMMENT ON TABLE cluster_status IS 'Tracks current status of primary and standby clusters';
COMMENT ON TABLE failover_lock IS 'Distributed lock for coordinating failover operations';
COMMENT ON TABLE disaster_recovery_audit_log IS 'Audit log for all disaster recovery operations';

COMMENT ON COLUMN disaster_recovery_config.sync_mode IS 'Replication sync mode: sync, async, or semi-sync';
COMMENT ON COLUMN disaster_recovery_config.auto_failover IS 'Whether automatic failover is enabled';
COMMENT ON COLUMN disaster_recovery_config.rpo_target_seconds IS 'Recovery Point Objective target in seconds (max acceptable data loss)';
COMMENT ON COLUMN disaster_recovery_config.rto_target_seconds IS 'Recovery Time Objective target in seconds (max acceptable downtime)';