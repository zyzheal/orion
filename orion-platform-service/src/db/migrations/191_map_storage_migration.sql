-- Migration: Map in-memory storage → PostgreSQL
-- Migrates 5 P0 services from Map() to persistent storage

CREATE TABLE IF NOT EXISTS tenant_quotas (
  id VARCHAR(100) PRIMARY KEY,
  tenant_id VARCHAR(100) NOT NULL UNIQUE,
  max_pipelines INTEGER DEFAULT 10,
  max_pipeline_runs_per_day INTEGER DEFAULT 100,
  max_concurrent_builds INTEGER DEFAULT 5,
  max_tasks_per_pipeline INTEGER DEFAULT 50,
  max_runners INTEGER DEFAULT 10,
  max_cpu_cores INTEGER DEFAULT 8,
  max_memory_gb INTEGER DEFAULT 16,
  max_storage_mb INTEGER DEFAULT 10240,
  max_projects INTEGER DEFAULT 5,
  max_users INTEGER DEFAULT 100,
  api_rate_limit INTEGER DEFAULT 1000,
  api_rate_limit_window_seconds INTEGER DEFAULT 60,
  usage JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pipeline_triggers (
  id VARCHAR(100) PRIMARY KEY,
  pipeline_id VARCHAR(100) NOT NULL,
  trigger_type VARCHAR(50) NOT NULL,
  config JSONB NOT NULL DEFAULT '{}',
  enabled BOOLEAN DEFAULT true,
  tenant_id INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pipeline_dependencies (
  id SERIAL PRIMARY KEY,
  pipeline_id VARCHAR(100) NOT NULL,
  depends_on VARCHAR(100) NOT NULL,
  dependency_type VARCHAR(50) NOT NULL DEFAULT 'sequential',
  tenant_id INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(pipeline_id, depends_on)
);

CREATE TABLE IF NOT EXISTS trigger_execution_history (
  id SERIAL PRIMARY KEY,
  trigger_id VARCHAR(100) NOT NULL REFERENCES pipeline_triggers(id),
  pipeline_id VARCHAR(100) NOT NULL,
  status VARCHAR(50) NOT NULL,
  error_message TEXT,
  executed_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rbac_rules (
  id SERIAL PRIMARY KEY,
  role VARCHAR(100) NOT NULL,
  resource VARCHAR(100) NOT NULL,
  action VARCHAR(50) NOT NULL,
  effect VARCHAR(10) NOT NULL DEFAULT 'allow',
  conditions JSONB DEFAULT '{}',
  tenant_id INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(role, resource, action)
);

CREATE INDEX IF NOT EXISTS idx_tenant_quotas_tenant ON tenant_quotas(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_triggers_pipeline ON pipeline_triggers(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_triggers_tenant ON pipeline_triggers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_dependencies_pipeline ON pipeline_dependencies(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_trigger_execution_trigger ON trigger_execution_history(trigger_id);
CREATE INDEX IF NOT EXISTS idx_rbac_rules_role ON rbac_rules(role);
