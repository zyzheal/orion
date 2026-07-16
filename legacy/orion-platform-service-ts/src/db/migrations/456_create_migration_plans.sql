-- Migration 456: Create migration plans and executions tables
--
-- Provides persistent storage for MigrationService (Task 4.39)
-- Replaces in-memory Map() storage with PostgreSQL.

-- migration_plans: stores migration plan definitions
CREATE TABLE IF NOT EXISTS migration_plans (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL DEFAULT 'default',
  name VARCHAR(255) NOT NULL,
  description TEXT,
  source_service VARCHAR(255) NOT NULL,
  target_service VARCHAR(255) NOT NULL,
  strategy VARCHAR(50) NOT NULL DEFAULT 'big-bang',
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  config JSONB DEFAULT '{}',
  steps JSONB DEFAULT '[]',
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_migration_plans_tenant ON migration_plans(tenant_id);
CREATE INDEX IF NOT EXISTS idx_migration_plans_status ON migration_plans(status);
CREATE INDEX IF NOT EXISTS idx_migration_plans_source ON migration_plans(source_service);
CREATE INDEX IF NOT EXISTS idx_migration_plans_created_at ON migration_plans(created_at DESC);

-- migration_executions: stores migration execution records
CREATE TABLE IF NOT EXISTS migration_executions (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL DEFAULT 'default',
  plan_id VARCHAR(64) NOT NULL REFERENCES migration_plans(id),
  status VARCHAR(50) NOT NULL DEFAULT 'running',
  current_step_index INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMP,
  paused_at TIMESTAMP,
  completed_at TIMESTAMP,
  rolled_back_at TIMESTAMP,
  executed_by VARCHAR(255) NOT NULL,
  error TEXT,
  total_steps INTEGER NOT NULL DEFAULT 0,
  completed_steps INTEGER NOT NULL DEFAULT 0,
  failed_steps INTEGER NOT NULL DEFAULT 0,
  data_synced INTEGER NOT NULL DEFAULT 0,
  data_verified INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_migration_executions_tenant ON migration_executions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_migration_executions_plan ON migration_executions(plan_id);
CREATE INDEX IF NOT EXISTS idx_migration_executions_status ON migration_executions(status);
CREATE INDEX IF NOT EXISTS idx_migration_executions_created_at ON migration_executions(created_at DESC);
