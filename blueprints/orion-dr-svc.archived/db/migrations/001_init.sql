-- orion-dr-svc Database Migration
-- Initial schema for disaster recovery service

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Disaster Recovery Plans Table
CREATE TABLE IF NOT EXISTS dr_plans (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id         UUID NOT NULL,
  plan_name         VARCHAR(255) NOT NULL,
  rto_target        INTEGER NOT NULL,
  rpo_target        INTEGER NOT NULL,
  status            VARCHAR(50) NOT NULL DEFAULT 'draft',
  services          JSONB NOT NULL DEFAULT '[]',
  failover_strategy VARCHAR(100) NOT NULL,
  backup_regions    JSONB NOT NULL DEFAULT '[]',
  last_tested_at    TIMESTAMPTZ,
  created_by        VARCHAR(100) NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Failover Tests Table
CREATE TABLE IF NOT EXISTS dr_failover_tests (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id         UUID NOT NULL,
  plan_id           UUID NOT NULL,
  test_name         VARCHAR(255) NOT NULL,
  test_type         VARCHAR(100) NOT NULL,
  affected_services JSONB NOT NULL DEFAULT '[]',
  status            VARCHAR(50) NOT NULL DEFAULT 'running',
  started_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at      TIMESTAMPTZ,
  actual_rto        INTEGER,
  actual_rpo        INTEGER,
  result            TEXT,
  findings          TEXT,
  created_by        VARCHAR(100) NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (plan_id) REFERENCES dr_plans(id) ON DELETE CASCADE
);

-- Backup Configs Table
CREATE TABLE IF NOT EXISTS backup_configs (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id         UUID NOT NULL,
  name              VARCHAR(255) NOT NULL,
  schedule          VARCHAR(100) NOT NULL,
  retention_days    INTEGER NOT NULL DEFAULT 30,
  target_service    VARCHAR(200) NOT NULL,
  backup_type       VARCHAR(50) NOT NULL,
  enabled           BOOLEAN NOT NULL DEFAULT true,
  config            JSONB NOT NULL DEFAULT '{}',
  created_by        VARCHAR(100) NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Backup Jobs Table
CREATE TABLE IF NOT EXISTS backup_jobs (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  config_id         UUID,
  tenant_id         UUID NOT NULL,
  status            VARCHAR(50) NOT NULL DEFAULT 'pending',
  started_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at      TIMESTAMPTZ,
  result            TEXT,
  error_message     TEXT,
  backup_size_bytes BIGINT,
  FOREIGN KEY (config_id) REFERENCES backup_configs(id) ON DELETE SET NULL
);

-- Backup Restores Table
CREATE TABLE IF NOT EXISTS backup_restores (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  backup_job_id     UUID,
  tenant_id         UUID NOT NULL,
  target_service    VARCHAR(200) NOT NULL,
  status            VARCHAR(50) NOT NULL DEFAULT 'pending',
  started_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at      TIMESTAMPTZ,
  result            TEXT,
  error_message     TEXT,
  created_by        VARCHAR(100) NOT NULL,
  FOREIGN KEY (backup_job_id) REFERENCES backup_jobs(id) ON DELETE SET NULL
);

-- Indexes
CREATE INDEX idx_dr_plans_tenant ON dr_plans(tenant_id);
CREATE INDEX idx_dr_plans_status ON dr_plans(status);

CREATE INDEX idx_dr_tests_plan ON dr_failover_tests(plan_id);
CREATE INDEX idx_dr_tests_tenant ON dr_failover_tests(tenant_id);
CREATE INDEX idx_dr_tests_status ON dr_failover_tests(status);

CREATE INDEX idx_backup_configs_tenant ON backup_configs(tenant_id);
CREATE INDEX idx_backup_configs_enabled ON backup_configs(enabled);

CREATE INDEX idx_backup_jobs_config ON backup_jobs(config_id);
CREATE INDEX idx_backup_jobs_tenant ON backup_jobs(tenant_id);
CREATE INDEX idx_backup_jobs_status ON backup_jobs(status);

CREATE INDEX idx_backup_restores_job ON backup_restores(backup_job_id);
CREATE INDEX idx_backup_restores_tenant ON backup_restores(tenant_id);
CREATE INDEX idx_backup_restores_status ON backup_restores(status);

-- Rollback:
-- DROP TABLE IF EXISTS backup_restores, backup_jobs, backup_configs, dr_failover_tests, dr_plans;
