-- Migration 215: DatabaseFailoverHandler Map() to PostgreSQL
-- Migrates lastAlertTime, degradationHistory, recoveryHistory, alertHistory from in-memory storage

CREATE TABLE IF NOT EXISTS db_failover_alert_times (
  id VARCHAR(100) PRIMARY KEY,
  degradation_level INTEGER NOT NULL,
  last_alert_time TIMESTAMP NOT NULL,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_db_failover_alert_times_level ON db_failover_alert_times(degradation_level);
CREATE INDEX IF NOT EXISTS idx_db_failover_alert_times_tenant ON db_failover_alert_times(tenant_id);

CREATE TABLE IF NOT EXISTS db_degradation_events (
  id VARCHAR(100) PRIMARY KEY,
  event_time TIMESTAMP NOT NULL,
  previous_level INTEGER NOT NULL,
  new_level INTEGER NOT NULL,
  trigger_type VARCHAR(50) NOT NULL,
  max_lag NUMERIC(10,2) NOT NULL DEFAULT 0,
  average_lag NUMERIC(10,2) NOT NULL DEFAULT 0,
  affected_replicas JSONB DEFAULT '[]',
  message TEXT,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_db_degradation_events_time ON db_degradation_events(event_time);
CREATE INDEX IF NOT EXISTS idx_db_degradation_events_tenant ON db_degradation_events(tenant_id);

CREATE TABLE IF NOT EXISTS db_recovery_events (
  id VARCHAR(100) PRIMARY KEY,
  event_time TIMESTAMP NOT NULL,
  previous_level INTEGER NOT NULL,
  new_level INTEGER NOT NULL,
  recovery_time_ms INTEGER NOT NULL DEFAULT 0,
  max_lag NUMERIC(10,2) NOT NULL DEFAULT 0,
  checks_passed INTEGER NOT NULL DEFAULT 0,
  message TEXT,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_db_recovery_events_time ON db_recovery_events(event_time);
CREATE INDEX IF NOT EXISTS idx_db_recovery_events_tenant ON db_recovery_events(tenant_id);

CREATE TABLE IF NOT EXISTS db_failover_alerts (
  id VARCHAR(100) PRIMARY KEY,
  alert_time TIMESTAMP NOT NULL,
  severity VARCHAR(50) NOT NULL,
  degradation_level INTEGER NOT NULL,
  message TEXT,
  max_lag NUMERIC(10,2) NOT NULL DEFAULT 0,
  replicas JSONB DEFAULT '[]',
  trend JSONB DEFAULT '{}',
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_db_failover_alerts_time ON db_failover_alerts(alert_time);
CREATE INDEX IF NOT EXISTS idx_db_failover_alerts_tenant ON db_failover_alerts(tenant_id);
