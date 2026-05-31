-- Migration 193: Migrate Map() in-memory storage to PostgreSQL
-- Services: efficiency, developer-portal, test-selector, pipeline (APK upload)
-- Replaces business-data Maps with persistent tables

-- ==================== Efficiency: Pipeline Completion Records ====================
CREATE TABLE IF NOT EXISTS efficiency_pipeline_records (
  id VARCHAR(100) PRIMARY KEY,
  tenant_id VARCHAR(100) NOT NULL DEFAULT 'default',
  run_id VARCHAR(100) NOT NULL,
  pipeline_id VARCHAR(100) NOT NULL,
  status VARCHAR(50) NOT NULL,
  trigger_type VARCHAR(50),
  git_ref VARCHAR(255),
  git_sha VARCHAR(100),
  duration_ms INTEGER NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ NOT NULL,
  synced_to_clickhouse BOOLEAN NOT NULL DEFAULT false,
  synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_eff_pipeline_records_tenant ON efficiency_pipeline_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_eff_pipeline_records_completed ON efficiency_pipeline_records(completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_eff_pipeline_records_unsynced ON efficiency_pipeline_records(synced_to_clickhouse) WHERE synced_to_clickhouse = false;

-- ==================== Efficiency: Deployment Records ====================
CREATE TABLE IF NOT EXISTS efficiency_deployment_records (
  id VARCHAR(100) PRIMARY KEY,
  tenant_id VARCHAR(100) NOT NULL DEFAULT 'default',
  deployment_id VARCHAR(100) NOT NULL,
  service VARCHAR(255),
  environment VARCHAR(100),
  status VARCHAR(50) NOT NULL,
  version VARCHAR(100),
  duration_ms INTEGER,
  deployed_at TIMESTAMPTZ NOT NULL,
  synced_to_clickhouse BOOLEAN NOT NULL DEFAULT false,
  synced_at TIMESTAMPTZ,
  recovery_time_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_eff_deploy_records_tenant ON efficiency_deployment_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_eff_deploy_records_deployed ON efficiency_deployment_records(deployed_at DESC);
CREATE INDEX IF NOT EXISTS idx_eff_deploy_records_unsynced ON efficiency_deployment_records(synced_to_clickhouse) WHERE synced_to_clickhouse = false;

-- ==================== Efficiency: DORA Metric Snapshots ====================
CREATE TABLE IF NOT EXISTS efficiency_metric_snapshots (
  id VARCHAR(100) PRIMARY KEY,
  tenant_id VARCHAR(100) NOT NULL DEFAULT 'default',
  time_window VARCHAR(50) NOT NULL,
  deployment_frequency DOUBLE PRECISION NOT NULL DEFAULT 0,
  lead_time_ms DOUBLE PRECISION NOT NULL DEFAULT 0,
  change_failure_rate DOUBLE PRECISION NOT NULL DEFAULT 0,
  mttr_ms DOUBLE PRECISION NOT NULL DEFAULT 0,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_eff_snapshots_tenant ON efficiency_metric_snapshots(tenant_id, captured_at DESC);

-- ==================== Efficiency: Team Data ====================
CREATE TABLE IF NOT EXISTS efficiency_team_data (
  id VARCHAR(100) PRIMARY KEY,
  tenant_id VARCHAR(100) NOT NULL DEFAULT 'default',
  name VARCHAR(255) NOT NULL,
  members INTEGER NOT NULL DEFAULT 0,
  pipelines JSONB NOT NULL DEFAULT '[]',
  deployments JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_eff_team_data_tenant ON efficiency_team_data(tenant_id);

-- ==================== Efficiency: Project Data ====================
CREATE TABLE IF NOT EXISTS efficiency_project_data (
  id VARCHAR(100) PRIMARY KEY,
  tenant_id VARCHAR(100) NOT NULL DEFAULT 'default',
  name VARCHAR(255) NOT NULL,
  pipelines JSONB NOT NULL DEFAULT '[]',
  deployments JSONB NOT NULL DEFAULT '[]',
  commits INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_eff_project_data_tenant ON efficiency_project_data(tenant_id);

-- ==================== Efficiency: Report History ====================
CREATE TABLE IF NOT EXISTS efficiency_reports (
  id VARCHAR(100) PRIMARY KEY,
  tenant_id VARCHAR(100) NOT NULL DEFAULT 'default',
  report_data JSONB NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_eff_reports_tenant ON efficiency_reports(tenant_id, generated_at DESC);

-- ==================== Efficiency: Global Deployments ====================
CREATE TABLE IF NOT EXISTS efficiency_global_deployments (
  id VARCHAR(100) PRIMARY KEY,
  tenant_id VARCHAR(100) NOT NULL DEFAULT 'default',
  deployment_data JSONB NOT NULL,
  deployed_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_eff_global_deploy_tenant ON efficiency_global_deployments(tenant_id, deployed_at DESC);

-- ==================== Efficiency: Global Pipeline Records ====================
CREATE TABLE IF NOT EXISTS efficiency_global_pipelines (
  id VARCHAR(100) PRIMARY KEY,
  tenant_id VARCHAR(100) NOT NULL DEFAULT 'default',
  pipeline_data JSONB NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_eff_global_pipelines_tenant ON efficiency_global_pipelines(tenant_id, completed_at DESC);

-- ==================== Developer Portal: Mock Rules ====================
CREATE TABLE IF NOT EXISTS devportal_mock_rules (
  id VARCHAR(100) PRIMARY KEY,
  tenant_id VARCHAR(100) NOT NULL DEFAULT 'default',
  name VARCHAR(255) NOT NULL,
  description TEXT DEFAULT '',
  method VARCHAR(20) NOT NULL,
  path TEXT NOT NULL,
  status_code INTEGER NOT NULL DEFAULT 200,
  headers JSONB NOT NULL DEFAULT '{"Content-Type":"application/json"}',
  body JSONB NOT NULL DEFAULT '{}',
  delay INTEGER NOT NULL DEFAULT 0,
  enabled BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 0,
  match_type VARCHAR(20) NOT NULL DEFAULT 'exact',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_devportal_mock_rules_tenant ON devportal_mock_rules(tenant_id);
CREATE INDEX IF NOT EXISTS idx_devportal_mock_rules_enabled ON devportal_mock_rules(tenant_id, enabled) WHERE enabled = true;

-- ==================== Developer Portal: Playground Requests ====================
CREATE TABLE IF NOT EXISTS devportal_playground_requests (
  id VARCHAR(100) PRIMARY KEY,
  tenant_id VARCHAR(100) NOT NULL DEFAULT 'default',
  user_id VARCHAR(100) NOT NULL,
  name VARCHAR(255) NOT NULL,
  method VARCHAR(20) NOT NULL,
  url TEXT NOT NULL,
  headers JSONB NOT NULL DEFAULT '{}',
  query_params JSONB NOT NULL DEFAULT '{}',
  body TEXT DEFAULT '',
  body_type VARCHAR(20) NOT NULL DEFAULT 'none',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_devportal_playground_req_tenant ON devportal_playground_requests(tenant_id, user_id);
CREATE INDEX IF NOT EXISTS idx_devportal_playground_req_created ON devportal_playground_requests(created_at DESC);

-- ==================== Developer Portal: Playground Responses ====================
CREATE TABLE IF NOT EXISTS devportal_playground_responses (
  id VARCHAR(100) PRIMARY KEY,
  request_id VARCHAR(100) NOT NULL,
  status_code INTEGER NOT NULL,
  status_text VARCHAR(100) NOT NULL,
  headers JSONB NOT NULL DEFAULT '{}',
  body TEXT NOT NULL,
  latency_ms INTEGER NOT NULL DEFAULT 0,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_devportal_playground_resp_req ON devportal_playground_responses(request_id, timestamp DESC);

-- ==================== Developer Portal: API Subscriptions ====================
CREATE TABLE IF NOT EXISTS devportal_api_subscriptions (
  id VARCHAR(100) PRIMARY KEY,
  tenant_id VARCHAR(100) NOT NULL DEFAULT 'default',
  user_id VARCHAR(100) NOT NULL,
  api_name VARCHAR(255) NOT NULL,
  plan_name VARCHAR(100) NOT NULL DEFAULT 'standard',
  quota_per_day INTEGER NOT NULL DEFAULT 1000,
  quota_per_month INTEGER NOT NULL DEFAULT 30000,
  used_today INTEGER NOT NULL DEFAULT 0,
  used_this_month INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  reason TEXT DEFAULT '',
  approved_by VARCHAR(100),
  approved_at TIMESTAMPTZ,
  reject_reason TEXT,
  api_key VARCHAR(255) NOT NULL,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_devportal_subs_tenant ON devportal_api_subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_devportal_subs_user ON devportal_api_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_devportal_subs_status ON devportal_api_subscriptions(status);

-- ==================== Developer Portal: Usage Records ====================
CREATE TABLE IF NOT EXISTS devportal_usage_records (
  id VARCHAR(100) PRIMARY KEY,
  subscription_id VARCHAR(100) NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  endpoint TEXT NOT NULL,
  method VARCHAR(20) NOT NULL,
  status_code INTEGER NOT NULL,
  latency_ms INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_devportal_usage_sub ON devportal_usage_records(subscription_id, timestamp DESC);

-- ==================== Developer Portal: SDK Generation Tasks ====================
CREATE TABLE IF NOT EXISTS devportal_sdk_tasks (
  id VARCHAR(100) PRIMARY KEY,
  tenant_id VARCHAR(100) NOT NULL DEFAULT 'default',
  name VARCHAR(255) NOT NULL,
  api_spec TEXT NOT NULL,
  language VARCHAR(50) NOT NULL,
  package_name VARCHAR(255) NOT NULL,
  version VARCHAR(50) NOT NULL DEFAULT '1.0.0',
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  output TEXT DEFAULT '',
  error TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_devportal_sdk_tasks_tenant ON devportal_sdk_tasks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_devportal_sdk_tasks_status ON devportal_sdk_tasks(status);

-- ==================== Test Selector: Test Suites ====================
CREATE TABLE IF NOT EXISTS test_selector_suites (
  id VARCHAR(100) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  file_path TEXT NOT NULL,
  test_count INTEGER NOT NULL DEFAULT 0,
  avg_duration DOUBLE PRECISION NOT NULL DEFAULT 0,
  pass_rate DOUBLE PRECISION NOT NULL DEFAULT 1.0,
  last_run TIMESTAMPTZ,
  source_files JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_test_suites_name ON test_selector_suites(name);

-- ==================== Test Selector: Test Cases ====================
CREATE TABLE IF NOT EXISTS test_selector_cases (
  id VARCHAR(100) PRIMARY KEY,
  suite_id VARCHAR(100) NOT NULL,
  name VARCHAR(255) NOT NULL,
  file_path TEXT NOT NULL,
  dependencies JSONB NOT NULL DEFAULT '[]',
  avg_duration DOUBLE PRECISION NOT NULL DEFAULT 0,
  flaky_score DOUBLE PRECISION NOT NULL DEFAULT 0,
  history JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_test_cases_suite ON test_selector_cases(suite_id);

-- ==================== Test Selector: Code Mappings ====================
CREATE TABLE IF NOT EXISTS test_selector_code_mappings (
  id VARCHAR(100) PRIMARY KEY,
  test_path TEXT NOT NULL,
  source_paths JSONB NOT NULL DEFAULT '[]',
  symbol_mapping JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_test_code_mappings_test ON test_selector_code_mappings(test_path);

-- ==================== Test Selector: PR Test Results ====================
CREATE TABLE IF NOT EXISTS test_selector_pr_results (
  id VARCHAR(100) PRIMARY KEY,
  pr_id VARCHAR(100) NOT NULL,
  plan_data JSONB NOT NULL,
  impact_data JSONB NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_test_pr_results_pr ON test_selector_pr_results(pr_id);

-- ==================== Test Selector: Test Execution History ====================
CREATE TABLE IF NOT EXISTS test_selector_execution_history (
  id VARCHAR(100) PRIMARY KEY,
  test_id VARCHAR(100) NOT NULL,
  execution_id VARCHAR(100) NOT NULL,
  passed BOOLEAN NOT NULL,
  duration INTEGER NOT NULL DEFAULT 0,
  failure_message TEXT,
  pr_id VARCHAR(100),
  executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_test_exec_history_test ON test_selector_execution_history(test_id, executed_at DESC);

-- ==================== Pipeline: APK Upload Records ====================
CREATE TABLE IF NOT EXISTS pipeline_apk_uploads (
  id VARCHAR(100) PRIMARY KEY,
  tenant_id VARCHAR(100) NOT NULL DEFAULT 'default',
  pipeline_run_id VARCHAR(100),
  pipeline_id VARCHAR(100),
  pipeline_name VARCHAR(255),
  market VARCHAR(100) NOT NULL,
  package_name VARCHAR(255) NOT NULL,
  version_name VARCHAR(100),
  version_code INTEGER,
  apk_path TEXT NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  upload_url TEXT,
  upload_id VARCHAR(100),
  error TEXT,
  stdout TEXT,
  stderr TEXT,
  duration_ms INTEGER,
  progress INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_apk_uploads_tenant ON pipeline_apk_uploads(tenant_id);
CREATE INDEX IF NOT EXISTS idx_apk_uploads_pipeline_run ON pipeline_apk_uploads(pipeline_run_id);
CREATE INDEX IF NOT EXISTS idx_apk_uploads_status ON pipeline_apk_uploads(status);
