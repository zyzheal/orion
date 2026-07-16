-- Migration 117: Create performance management tables
-- Covers: performance baselines, evaluations, test results, and profiles

-- Performance Baselines
CREATE TABLE IF NOT EXISTS performance_baselines (
  id VARCHAR(36) PRIMARY KEY,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  service VARCHAR(255) NOT NULL,
  environment VARCHAR(100),
  metrics JSONB NOT NULL DEFAULT '{}',
  thresholds JSONB NOT NULL DEFAULT '{}',
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_perf_baselines_tenant_service ON performance_baselines (tenant_id, service);
CREATE INDEX idx_perf_baselines_tenant ON performance_baselines (tenant_id);

-- Performance Evaluations
CREATE TABLE IF NOT EXISTS performance_evaluations (
  id VARCHAR(64) PRIMARY KEY,
  baseline_id VARCHAR(36) NOT NULL REFERENCES performance_baselines(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  service VARCHAR(255) NOT NULL,
  overall VARCHAR(20) NOT NULL DEFAULT 'healthy',
  details JSONB NOT NULL DEFAULT '[]',
  evaluated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_perf_evaluations_baseline ON performance_evaluations (baseline_id);
CREATE INDEX idx_perf_evaluations_tenant ON performance_evaluations (tenant_id);

-- Performance Test Results
CREATE TABLE IF NOT EXISTS performance_test_results (
  id VARCHAR(36) PRIMARY KEY,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  service VARCHAR(255) NOT NULL,
  baseline_id VARCHAR(36) REFERENCES performance_baselines(id) ON DELETE SET NULL,
  test_name VARCHAR(255) NOT NULL,
  metrics JSONB NOT NULL DEFAULT '{}',
  status VARCHAR(10) NOT NULL DEFAULT 'pass',
  failures JSONB,
  duration INTEGER NOT NULL DEFAULT 0,
  timestamp TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_perf_test_results_service ON performance_test_results (service);
CREATE INDEX idx_perf_test_results_tenant ON performance_test_results (tenant_id);

-- Performance Profiles
CREATE TABLE IF NOT EXISTS performance_profiles (
  id VARCHAR(36) PRIMARY KEY,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  service_name VARCHAR(255) NOT NULL,
  config JSONB NOT NULL DEFAULT '{}',
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  results JSONB,
  error_message TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_perf_profiles_service ON performance_profiles (service_name);
CREATE INDEX idx_perf_profiles_status ON performance_profiles (status);
