-- Migration 416: Create service health check tables
-- Tables: service_health_checks, service_health_results

-- Table: service_health_checks
-- Stores the configuration of monitored services and their check definitions
CREATE TABLE IF NOT EXISTS service_health_checks (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  service_name VARCHAR(255) NOT NULL,
  service_url TEXT NOT NULL,
  check_type VARCHAR(32) NOT NULL CHECK (check_type IN ('http', 'grpc', 'tcp', 'custom')),
  -- Check execution config
  interval_seconds INTEGER NOT NULL DEFAULT 30,
  timeout_seconds INTEGER NOT NULL DEFAULT 10,
  retry_count INTEGER NOT NULL DEFAULT 2,
  -- HTTP-specific: expected status code
  expected_status_code INTEGER DEFAULT 200,
  -- gRPC-specific: expected status
  expected_grpc_status VARCHAR(64) DEFAULT 'SERVING',
  -- TCP-specific: port number
  port INTEGER,
  -- Thresholds for alerting
  failure_threshold INTEGER NOT NULL DEFAULT 3,
  -- State tracking
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  last_status VARCHAR(32) DEFAULT 'unknown',
  last_checked_at TIMESTAMP,
  last_error TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT unique_service_check UNIQUE (tenant_id, service_name, service_url, check_type)
);

CREATE INDEX IF NOT EXISTS idx_service_health_checks_tenant_active
  ON service_health_checks (tenant_id, is_active, last_checked_at DESC);

-- Table: service_health_results
-- Stores individual health check results with history for trend analysis
CREATE TABLE IF NOT EXISTS service_health_results (
  id VARCHAR(64) PRIMARY KEY,
  check_id VARCHAR(64) NOT NULL REFERENCES service_health_checks(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  status VARCHAR(32) NOT NULL CHECK (status IN ('healthy', 'unhealthy', 'degraded', 'timeout', 'error')),
  latency_ms INTEGER,
  error_message TEXT,
  -- Metadata
  attempt_number INTEGER DEFAULT 1,
  response_body TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_service_health_results_check_created
  ON service_health_results (check_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_service_health_results_tenant_created
  ON service_health_results (tenant_id, created_at DESC);

-- Retention policy: keep results for 30 days (cleanup via scheduled job)
CREATE INDEX IF NOT EXISTS idx_service_health_results_old
  ON service_health_results (created_at)
  WHERE created_at < NOW() - INTERVAL '30 days';
