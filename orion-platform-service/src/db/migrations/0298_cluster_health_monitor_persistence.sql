-- Migration 0298: Cluster Health Monitor persistence
-- Stores cluster registrations, health checks, metrics, and anomaly detections

CREATE TABLE IF NOT EXISTS cluster_records (
  id VARCHAR(100) PRIMARY KEY,
  tenant_id VARCHAR(100) NOT NULL,
  name VARCHAR(200) NOT NULL,
  endpoint VARCHAR(500) NOT NULL,
  region VARCHAR(100) NOT NULL,
  status VARCHAR(20) DEFAULT 'online',
  node_count INTEGER DEFAULT 3,
  last_health_check TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cluster_health_checks (
  id VARCHAR(100) PRIMARY KEY,
  cluster_id VARCHAR(100) NOT NULL,
  cluster_name VARCHAR(200),
  status VARCHAR(20) NOT NULL,
  api_server_reachable BOOLEAN DEFAULT false,
  api_server_latency_ms INTEGER DEFAULT 0,
  node_count INTEGER DEFAULT 0,
  node_ready_count INTEGER DEFAULT 0,
  pod_count INTEGER DEFAULT 0,
  cpu_usage_pct NUMERIC(5,2) DEFAULT 0,
  memory_usage_pct NUMERIC(5,2) DEFAULT 0,
  disk_usage_pct NUMERIC(5,2) DEFAULT 0,
  anomalies JSONB DEFAULT '[]',
  checked_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cluster_metrics (
  id VARCHAR(100) PRIMARY KEY,
  cluster_id VARCHAR(100) NOT NULL,
  cluster_name VARCHAR(200),
  time_window VARCHAR(20) NOT NULL,
  cpu_usage_avg NUMERIC(5,2) DEFAULT 0,
  cpu_usage_max NUMERIC(5,2) DEFAULT 0,
  memory_usage_avg NUMERIC(5,2) DEFAULT 0,
  memory_usage_max NUMERIC(5,2) DEFAULT 0,
  network_in_bytes BIGINT DEFAULT 0,
  network_out_bytes BIGINT DEFAULT 0,
  pod_count_avg INTEGER DEFAULT 0,
  pod_restart_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  latency_p50_ms NUMERIC(10,2) DEFAULT 0,
  latency_p99_ms NUMERIC(10,2) DEFAULT 0,
  collected_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cluster_anomalies (
  id VARCHAR(100) PRIMARY KEY,
  cluster_id VARCHAR(100) NOT NULL,
  cluster_name VARCHAR(200),
  anomaly_type VARCHAR(100) NOT NULL,
  severity VARCHAR(20) NOT NULL,
  description TEXT,
  detected_at TIMESTAMP NOT NULL,
  metrics_snapshot JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cluster_records_tenant ON cluster_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cluster_records_status ON cluster_records(status);
CREATE INDEX IF NOT EXISTS idx_cluster_health_cluster ON cluster_health_checks(cluster_id);
CREATE INDEX IF NOT EXISTS idx_cluster_health_checked ON cluster_health_checks(checked_at);
CREATE INDEX IF NOT EXISTS idx_cluster_metrics_cluster ON cluster_metrics(cluster_id);
CREATE INDEX IF NOT EXISTS idx_cluster_metrics_window ON cluster_metrics(time_window);
CREATE INDEX IF NOT EXISTS idx_cluster_anomalies_cluster ON cluster_anomalies(cluster_id);
CREATE INDEX IF NOT EXISTS idx_cluster_anomalies_type ON cluster_anomalies(anomaly_type);
CREATE INDEX IF NOT EXISTS idx_cluster_anomalies_detected ON cluster_anomalies(detected_at);
