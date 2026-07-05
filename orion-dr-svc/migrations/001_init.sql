-- Migration 001: Disaster Recovery Service Core Tables
-- Creates all core tables for backup plans, records, recovery plans, verification, and DR executions
-- Version: 1.0.0

-- ==================== Backup Plans ====================
CREATE TABLE IF NOT EXISTS backup_plans (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              VARCHAR(255) NOT NULL,
  type              VARCHAR(50) NOT NULL,
  schedule          JSONB NOT NULL,
  retention         JSONB NOT NULL,
  sources           JSONB NOT NULL DEFAULT '[]',
  enabled           BOOLEAN NOT NULL DEFAULT true,
  compress          BOOLEAN NOT NULL DEFAULT true,
  encrypt           BOOLEAN NOT NULL DEFAULT false,
  description       TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_backup_plans_type ON backup_plans(type);
CREATE INDEX idx_backup_plans_enabled ON backup_plans(enabled);
CREATE INDEX idx_backup_plans_name ON backup_plans(name);

-- ==================== Backup Records ====================
CREATE TABLE IF NOT EXISTS backup_records (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id           UUID NOT NULL REFERENCES backup_plans(id),
  plan_name         VARCHAR(255),
  type              VARCHAR(50) NOT NULL,
  status            VARCHAR(20) NOT NULL DEFAULT 'pending',
  size              BIGINT NOT NULL DEFAULT 0,
  size_human        VARCHAR(50),
  started_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at      TIMESTAMPTZ,
  storage_location  VARCHAR(1000) NOT NULL,
  checksum          VARCHAR(64),
  compression_ratio DECIMAL(5, 2),
  error_message     TEXT,
  sources           JSONB NOT NULL DEFAULT '[]',
  metadata          JSONB DEFAULT '{}'
);

CREATE INDEX idx_backup_records_plan ON backup_records(plan_id);
CREATE INDEX idx_backup_records_status ON backup_records(status);
CREATE INDEX idx_backup_records_started ON backup_records(started_at);
CREATE INDEX idx_backup_records_completed ON backup_records(completed_at);

-- ==================== Recovery Plans ====================
CREATE TABLE IF NOT EXISTS recovery_plans (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(255) NOT NULL,
  rto_ms          BIGINT NOT NULL,
  rpo_ms          BIGINT NOT NULL,
  steps           JSONB NOT NULL DEFAULT '[]',
  last_tested     TIMESTAMPTZ,
  enabled         BOOLEAN NOT NULL DEFAULT true,
  description     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_recovery_plans_enabled ON recovery_plans(enabled);
CREATE INDEX idx_recovery_plans_name ON recovery_plans(name);

-- ==================== Backup Verifications ====================
CREATE TABLE IF NOT EXISTS backup_verifications (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  backup_id         UUID NOT NULL REFERENCES backup_records(id),
  status            VARCHAR(20) NOT NULL DEFAULT 'pending',
  integrity_check   BOOLEAN NOT NULL DEFAULT false,
  restore_test      BOOLEAN NOT NULL DEFAULT false,
  verified_at       TIMESTAMPTZ,
  integrity_details TEXT,
  restore_details   TEXT,
  error_message     TEXT,
  started_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_backup_verifications_backup ON backup_verifications(backup_id);
CREATE INDEX idx_backup_verifications_status ON backup_verifications(status);
CREATE INDEX idx_backup_verifications_started ON backup_verifications(started_at);

-- ==================== Recovery Executions ====================
CREATE TABLE IF NOT EXISTS recovery_executions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id           UUID NOT NULL REFERENCES recovery_plans(id),
  plan_name         VARCHAR(255),
  status            VARCHAR(20) NOT NULL DEFAULT 'initiated',
  target_time       TIMESTAMPTZ,
  backup_id         UUID REFERENCES backup_records(id),
  step_executions   JSONB NOT NULL DEFAULT '[]',
  initiated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at      TIMESTAMPTZ,
  actual_rto_ms     BIGINT,
  actual_rpo_ms     BIGINT,
  rto_target_ms     BIGINT NOT NULL,
  rpo_target_ms     BIGINT NOT NULL,
  rto_met           BOOLEAN,
  rpo_met           BOOLEAN,
  error_message     TEXT
);

CREATE INDEX idx_recovery_executions_plan ON recovery_executions(plan_id);
CREATE INDEX idx_recovery_executions_status ON recovery_executions(status);
CREATE INDEX idx_recovery_executions_initiated ON recovery_executions(initiated_at);

-- ==================== Migration Info ====================
CREATE TABLE IF NOT EXISTS dr_schema_migrations (
  version             VARCHAR(20) PRIMARY KEY,
  applied_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  description         TEXT
);

INSERT INTO dr_schema_migrations (version, description)
VALUES ('001', 'Initial DR service tables: backup_plans, backup_records, recovery_plans, backup_verifications, recovery_executions');
