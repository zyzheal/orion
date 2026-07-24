-- Migration 118: Create model version management tables
-- Covers: model versions, A/B tests, A/B test metrics

-- Model Versions
CREATE TABLE IF NOT EXISTS model_versions (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  version VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'registered',
  framework VARCHAR(50) NOT NULL,
  description TEXT,
  metadata JSONB,
  training_date TIMESTAMP,
  training_data_size BIGINT,
  hyperparameters JSONB,
  metrics JSONB NOT NULL DEFAULT '{}',
  registered_at TIMESTAMP NOT NULL DEFAULT NOW(),
  registered_by VARCHAR(100),
  activated_at TIMESTAMP,
  deprecated_at TIMESTAMP,
  tags TEXT[],
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_model_versions_name_version ON model_versions (name, version);
CREATE INDEX idx_model_versions_name_status ON model_versions (name, status);
CREATE INDEX idx_model_versions_status ON model_versions (status);
CREATE INDEX idx_model_versions_framework ON model_versions (framework);

-- A/B Tests
CREATE TABLE IF NOT EXISTS ab_tests (
  id VARCHAR(64) PRIMARY KEY,
  model_name VARCHAR(255) NOT NULL,
  variants JSONB NOT NULL DEFAULT '[]',
  traffic_split JSONB NOT NULL DEFAULT '{}',
  start_date TIMESTAMP NOT NULL DEFAULT NOW(),
  end_date TIMESTAMP,
  target_metrics TEXT[] NOT NULL DEFAULT '{}',
  status VARCHAR(20) NOT NULL DEFAULT 'running',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ab_tests_model_name ON ab_tests (model_name);
CREATE INDEX idx_ab_tests_status ON ab_tests (status);

-- A/B Test Metrics
CREATE TABLE IF NOT EXISTS ab_test_metrics (
  id VARCHAR(128) PRIMARY KEY,
  ab_test_id VARCHAR(64) NOT NULL REFERENCES ab_tests(id) ON DELETE CASCADE,
  model_id VARCHAR(128) NOT NULL,
  metrics JSONB NOT NULL DEFAULT '{}',
  request_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ab_test_metrics_ab_test ON ab_test_metrics (ab_test_id);
CREATE INDEX idx_ab_test_metrics_model ON ab_test_metrics (model_id);
