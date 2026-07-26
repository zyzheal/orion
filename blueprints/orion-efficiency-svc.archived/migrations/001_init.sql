-- Migration 001: Efficiency Service Initial Schema
-- Developer efficiency and DORA metrics tracking for orion-efficiency-svc

-- Core deployments table
CREATE TABLE IF NOT EXISTS deployments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL,
  environment     VARCHAR(50) NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'pending',
  service         VARCHAR(255),
  version         VARCHAR(100),
  commit_sha      VARCHAR(40),
  commit_committed_at TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  duration_ms     BIGINT,
  metadata        JSONB DEFAULT '{}'
);

CREATE INDEX idx_deployments_tenant ON deployments(tenant_id);
CREATE INDEX idx_deployments_status ON deployments(status);
CREATE INDEX idx_deployments_created ON deployments(created_at);
CREATE INDEX idx_deployments_completed ON deployments(completed_at);

-- Pipeline runs table
CREATE TABLE IF NOT EXISTS pipeline_runs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL,
  pipeline_id     UUID NOT NULL,
  trigger_type    VARCHAR(50),
  status          VARCHAR(20) NOT NULL DEFAULT 'pending',
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ,
  duration_ms     BIGINT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata        JSONB DEFAULT '{}'
);

CREATE INDEX idx_pipeline_runs_tenant ON pipeline_runs(tenant_id);
CREATE INDEX idx_pipeline_runs_pipeline ON pipeline_runs(pipeline_id);
CREATE INDEX idx_pipeline_runs_status ON pipeline_runs(status);
CREATE INDEX idx_pipeline_runs_completed ON pipeline_runs(completed_at);

-- DORA metrics snapshots table
CREATE TABLE IF NOT EXISTS dora_snapshots (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL,
  deployment_frequency  DECIMAL(10,2),
  lead_time_minutes     BIGINT,
  mttr_minutes          BIGINT,
  change_failure_rate   DECIMAL(5,4),
  period_start          TIMESTAMPTZ NOT NULL,
  period_end            TIMESTAMPTZ NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_dora_snapshots_tenant ON dora_snapshots(tenant_id);
CREATE INDEX idx_dora_snapshots_period ON dora_snapshots(period_start, period_end);

-- Efficiency metrics table
CREATE TABLE IF NOT EXISTS efficiency_metrics (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL,
  metric_type   VARCHAR(50) NOT NULL,
  team_id       UUID,
  value         JSONB NOT NULL,
  period_start  TIMESTAMPTZ NOT NULL,
  period_end    TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_efficiency_metrics_tenant ON efficiency_metrics(tenant_id);
CREATE INDEX idx_efficiency_metrics_type ON efficiency_metrics(metric_type);
CREATE INDEX idx_efficiency_metrics_team ON efficiency_metrics(team_id);
CREATE INDEX idx_efficiency_metrics_period ON efficiency_metrics(period_start, period_end);

-- Weekly reports table
CREATE TABLE IF NOT EXISTS weekly_reports (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL,
  team_id         UUID,
  week_start      DATE NOT NULL,
  week_end        DATE NOT NULL,
  report_data     JSONB NOT NULL,
  dora_scores     JSONB DEFAULT '{}',
  generated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_weekly_reports_tenant ON weekly_reports(tenant_id);
CREATE INDEX idx_weekly_reports_team ON weekly_reports(team_id);
CREATE INDEX idx_weekly_reports_week ON weekly_reports(week_start, week_end);

-- ClickHouse sync status table
CREATE TABLE IF NOT EXISTS clickhouse_sync_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name      VARCHAR(100) NOT NULL,
  record_id       UUID NOT NULL,
  sync_status     VARCHAR(20) NOT NULL DEFAULT 'pending',
  synced_at       TIMESTAMPTZ,
  error_message   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_clickhouse_sync_status ON clickhouse_sync_log(sync_status);
CREATE INDEX idx_clickhouse_sync_synced ON clickhouse_sync_log(synced_at);

-- Rollback:
-- DROP TABLE IF EXISTS clickhouse_sync_log, weekly_reports, efficiency_metrics, dora_snapshots, pipeline_runs, deployments;