-- Migration 213: ReadTrafficManager Map() to PostgreSQL
-- Migrates healthCheckCounts and lastRoutingTime from in-memory Map to persistent storage

CREATE TABLE IF NOT EXISTS db_health_check_counts (
  id VARCHAR(100) PRIMARY KEY,
  node_id VARCHAR(100) NOT NULL,
  check_count INTEGER NOT NULL DEFAULT 0,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_db_health_check_counts_node ON db_health_check_counts(node_id);
CREATE INDEX IF NOT EXISTS idx_db_health_check_counts_tenant ON db_health_check_counts(tenant_id);

CREATE TABLE IF NOT EXISTS db_routing_times (
  id VARCHAR(100) PRIMARY KEY,
  node_id VARCHAR(100) NOT NULL,
  last_routing_time TIMESTAMP NOT NULL,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_db_routing_times_node ON db_routing_times(node_id);
CREATE INDEX IF NOT EXISTS idx_db_routing_times_tenant ON db_routing_times(tenant_id);
