-- Migration 192: Create tables for SPI, Backup, Ticketing, and Plugin services
-- Migrates in-memory Map() storage to PostgreSQL Repository pattern

-- ============================================================
-- 1. Plugin SPI tables
-- ============================================================

-- Plugin registry (mirrors PluginRegistry.plugins Map)
CREATE TABLE IF NOT EXISTS plugin_registry (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(255) NOT NULL UNIQUE,
  version         VARCHAR(100) NOT NULL,
  description     TEXT,
  author          VARCHAR(255),
  status          VARCHAR(50) NOT NULL DEFAULT 'installed',
  install_date    TIMESTAMPTZ NOT NULL DEFAULT now(),
  enabled_date    TIMESTAMPTZ,
  error_message   TEXT,
  config          JSONB DEFAULT '{}',
  manifest        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_plugin_registry_name ON plugin_registry(name);
CREATE INDEX IF NOT EXISTS idx_plugin_registry_status ON plugin_registry(status);

-- Plugin version snapshots (mirrors PluginHotReloadService.versionSnapshots Map)
CREATE TABLE IF NOT EXISTS plugin_version_snapshots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plugin_id       VARCHAR(255) NOT NULL,
  version         VARCHAR(100) NOT NULL,
  manifest        JSONB NOT NULL DEFAULT '{}',
  config          JSONB DEFAULT '{}',
  status          VARCHAR(50) NOT NULL,
  checksum        VARCHAR(255),
  snapshot_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_plugin_snapshots_plugin_id ON plugin_version_snapshots(plugin_id);

-- ============================================================
-- 2. Backup tables
-- ============================================================

-- Backup plans (mirrors BackupScheduler.plans Map)
CREATE TABLE IF NOT EXISTS backup_plans (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(200) NOT NULL,
  description     TEXT,
  source_type     VARCHAR(50) NOT NULL,
  backup_type     VARCHAR(50) NOT NULL DEFAULT 'full',
  enabled         BOOLEAN NOT NULL DEFAULT true,
  schedule        JSONB NOT NULL DEFAULT '{}',
  retention       JSONB NOT NULL DEFAULT '{}',
  storage_config  JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Backup verifications (mirrors BackupVerifier.verifications Map)
CREATE TABLE IF NOT EXISTS backup_verifications (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  backup_id           VARCHAR(255) NOT NULL,
  status              VARCHAR(50) NOT NULL DEFAULT 'in_progress',
  integrity_check     BOOLEAN DEFAULT false,
  restore_test        BOOLEAN DEFAULT false,
  integrity_details   TEXT,
  restore_details     TEXT,
  error_message       TEXT,
  started_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  verified_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_backup_verifications_backup_id ON backup_verifications(backup_id);

-- Recovery plans (mirrors RecoveryService.recoveryPlans Map)
CREATE TABLE IF NOT EXISTS recovery_plans (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(200) NOT NULL,
  description     TEXT,
  enabled         BOOLEAN NOT NULL DEFAULT true,
  rto_ms          BIGINT NOT NULL DEFAULT 0,
  rpo_ms          BIGINT NOT NULL DEFAULT 0,
  steps           JSONB NOT NULL DEFAULT '[]',
  last_tested     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Recovery executions (mirrors RecoveryService.executions Map)
CREATE TABLE IF NOT EXISTS recovery_executions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id             UUID NOT NULL REFERENCES recovery_plans(id) ON DELETE CASCADE,
  plan_name           VARCHAR(200),
  status              VARCHAR(50) NOT NULL DEFAULT 'initiated',
  target_time         TIMESTAMPTZ,
  backup_id           VARCHAR(255),
  step_executions     JSONB NOT NULL DEFAULT '[]',
  initiated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at        TIMESTAMPTZ,
  rto_target_ms       BIGINT NOT NULL DEFAULT 0,
  rpo_target_ms       BIGINT NOT NULL DEFAULT 0,
  actual_rto_ms       BIGINT,
  actual_rpo_ms       BIGINT,
  rto_met             BOOLEAN,
  rpo_met             BOOLEAN,
  error_message       TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_recovery_executions_plan_id ON recovery_executions(plan_id);

-- ============================================================
-- 3. Ticketing tables
-- ============================================================

-- Dispatch events (mirrors DispatchAnalytics.dispatchEvents Map)
CREATE TABLE IF NOT EXISTS dispatch_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id       VARCHAR(255) NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL,
  assigned_at     TIMESTAMPTZ,
  accepted_at     TIMESTAMPTZ,
  resolved_at     TIMESTAMPTZ,
  dispatch_result JSONB,
  priority        VARCHAR(50) NOT NULL DEFAULT 'medium',
  category        VARCHAR(100) NOT NULL DEFAULT 'other',
  inserted_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dispatch_events_ticket_id ON dispatch_events(ticket_id);

-- Ticket load records (mirrors LoadBalancer.ticketLoads Map)
CREATE TABLE IF NOT EXISTS ticket_load_records (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id             VARCHAR(255) NOT NULL UNIQUE,
  engineer_id           VARCHAR(255) NOT NULL,
  category              VARCHAR(100) NOT NULL DEFAULT 'other',
  assigned_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  estimated_effort_hours REAL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ticket_load_records_engineer ON ticket_load_records(engineer_id);
CREATE INDEX IF NOT EXISTS idx_ticket_load_records_ticket ON ticket_load_records(ticket_id);

-- Dispatch queue entries (mirrors DispatchQueueManager.queue Map)
CREATE TABLE IF NOT EXISTS dispatch_queue_entries (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id               VARCHAR(255) NOT NULL UNIQUE,
  ticket_data             JSONB NOT NULL DEFAULT '{}',
  dispatch_priority       REAL NOT NULL DEFAULT 0,
  enqueued_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  sla_deadline            TIMESTAMPTZ,
  reprioritize_count      INT NOT NULL DEFAULT 0,
  dispatch_attempt_count  INT NOT NULL DEFAULT 0,
  last_dispatch_attempt   TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dispatch_queue_ticket ON dispatch_queue_entries(ticket_id);
CREATE INDEX IF NOT EXISTS idx_dispatch_queue_priority ON dispatch_queue_entries(dispatch_priority DESC);

-- SLA targets (mirrors DispatchQueueManager.slaTargets Map)
CREATE TABLE IF NOT EXISTS dispatch_sla_targets (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                      VARCHAR(200) NOT NULL,
  priority                  VARCHAR(50) NOT NULL,
  target_response_time_ms   BIGINT NOT NULL DEFAULT 0,
  target_resolution_time_ms BIGINT NOT NULL DEFAULT 0,
  enabled                   BOOLEAN NOT NULL DEFAULT true,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- SLA alerts (mirrors DispatchQueueManager.alerts Map)
CREATE TABLE IF NOT EXISTS dispatch_sla_alerts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_entry_id    VARCHAR(255) NOT NULL,
  ticket_id         VARCHAR(255) NOT NULL,
  alert_type        VARCHAR(50) NOT NULL,
  time_remaining_ms BIGINT,
  message           TEXT,
  generated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sla_alerts_ticket ON dispatch_sla_alerts(ticket_id);
CREATE INDEX IF NOT EXISTS idx_sla_alerts_type ON dispatch_sla_alerts(alert_type);

-- ============================================================
-- 4. Plugin service tables
-- ============================================================

-- Plugin resource quotas (mirrors PluginResourceManager.pluginQuotas + tenantQuotas Maps)
CREATE TABLE IF NOT EXISTS plugin_resource_quotas (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope           VARCHAR(50) NOT NULL DEFAULT 'plugin',  -- 'plugin' or 'tenant'
  scope_id        VARCHAR(255) NOT NULL,  -- pluginId or tenantId
  cpu_cores       INT NOT NULL DEFAULT 2,
  memory_bytes    BIGINT NOT NULL DEFAULT 4294967296,
  timeout_ms      INT NOT NULL DEFAULT 120000,
  max_concurrent  INT NOT NULL DEFAULT 10,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(scope, scope_id)
);
CREATE INDEX IF NOT EXISTS idx_plugin_quotas_scope ON plugin_resource_quotas(scope, scope_id);

-- Plugin security events (mirrors PluginAuditLogger.securityEvents Map)
CREATE TABLE IF NOT EXISTS plugin_security_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type      VARCHAR(100) NOT NULL,
  severity        VARCHAR(50) NOT NULL DEFAULT 'LOW',
  task_id         VARCHAR(255),
  plugin_id       VARCHAR(255),
  message         TEXT,
  details         JSONB DEFAULT '{}',
  event_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_plugin_security_events_plugin ON plugin_security_events(plugin_id);
CREATE INDEX IF NOT EXISTS idx_plugin_security_events_type ON plugin_security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_plugin_security_events_severity ON plugin_security_events(severity);

-- Rollback:
-- DROP TABLE IF EXISTS plugin_security_events, plugin_resource_quotas, dispatch_sla_alerts,
--   dispatch_sla_targets, dispatch_queue_entries, ticket_load_records, dispatch_events,
--   recovery_executions, recovery_plans, backup_verifications, backup_plans,
--   plugin_version_snapshots, plugin_registry;
