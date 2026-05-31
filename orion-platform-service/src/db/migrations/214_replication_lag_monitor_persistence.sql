-- Migration 214: ReplicationLagMonitor Map() to PostgreSQL
-- Migrates lagHistory and currentReplicas from in-memory Map to persistent storage

CREATE TABLE IF NOT EXISTS db_lag_history (
  id VARCHAR(100) PRIMARY KEY,
  replica_host VARCHAR(200) NOT NULL,
  lag_seconds NUMERIC(10,2) NOT NULL DEFAULT 0,
  lag_level VARCHAR(50) NOT NULL,
  recorded_at TIMESTAMP DEFAULT NOW(),
  tenant_id VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_db_lag_history_replica ON db_lag_history(replica_host);
CREATE INDEX IF NOT EXISTS idx_db_lag_history_recorded ON db_lag_history(recorded_at);
CREATE INDEX IF NOT EXISTS idx_db_lag_history_tenant ON db_lag_history(tenant_id);

CREATE TABLE IF NOT EXISTS db_replica_statuses (
  id VARCHAR(100) PRIMARY KEY,
  host VARCHAR(200) NOT NULL,
  port INTEGER NOT NULL DEFAULT 3306,
  io_running BOOLEAN DEFAULT false,
  sql_running BOOLEAN DEFAULT false,
  seconds_behind_master INTEGER DEFAULT 0,
  last_error TEXT,
  last_io_error TEXT,
  last_sql_error TEXT,
  relay_master_log_file VARCHAR(200),
  exec_master_log_pos INTEGER DEFAULT 0,
  read_master_log_pos INTEGER DEFAULT 0,
  retrieved_gtid_set TEXT,
  executed_gtid_set TEXT,
  tenant_id VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_db_replica_statuses_host ON db_replica_statuses(host, port);
CREATE INDEX IF NOT EXISTS idx_db_replica_statuses_tenant ON db_replica_statuses(tenant_id);
