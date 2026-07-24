-- Migration 192: Create tables for alert/monitoring Map() to PostgreSQL migration
-- Replaces in-memory Map storage with persistent tables

-- 1. Active alerts (AlertSuppressionService.activeAlerts)
CREATE TABLE IF NOT EXISTS alert_active_alerts (
  id TEXT PRIMARY KEY,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  fingerprint TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL,
  severity TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'firing',
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL DEFAULT '',
  source_name TEXT NOT NULL DEFAULT '',
  labels JSONB NOT NULL DEFAULT '{}',
  annotations JSONB NOT NULL DEFAULT '{}',
  value DOUBLE PRECISION NOT NULL DEFAULT 0,
  threshold DOUBLE PRECISION NOT NULL DEFAULT 0,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ends_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  suppressed_at TIMESTAMPTZ,
  suppressed_reason TEXT,
  root_cause_alert_id TEXT,
  related_alert_ids TEXT[] DEFAULT '{}',
  maintenance_window_id TEXT,
  known_issue_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alert_active_alerts_tenant ON alert_active_alerts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_alert_active_alerts_status ON alert_active_alerts(status);
CREATE INDEX IF NOT EXISTS idx_alert_active_alerts_severity ON alert_active_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_alert_active_alerts_source ON alert_active_alerts(source_type, source_id);

-- 2. Suppression log (AlertSuppressionService.suppressionLog)
CREATE TABLE IF NOT EXISTS alert_suppression_log (
  id TEXT PRIMARY KEY,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  alert_id TEXT NOT NULL,
  rule_type TEXT NOT NULL,
  reason TEXT NOT NULL,
  logged_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alert_suppression_log_tenant ON alert_suppression_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_alert_suppression_log_alert ON alert_suppression_log(alert_id);
CREATE INDEX IF NOT EXISTS idx_alert_suppression_log_time ON alert_suppression_log(logged_at DESC);

-- 3. Correlation groups (AlertCorrelationService.groups)
CREATE TABLE IF NOT EXISTS alert_correlation_groups (
  id TEXT PRIMARY KEY,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  root_alert JSONB NOT NULL,
  correlated_alerts JSONB NOT NULL DEFAULT '[]',
  common_labels JSONB NOT NULL DEFAULT '{}',
  category TEXT NOT NULL DEFAULT 'other',
  severity TEXT NOT NULL DEFAULT 'info',
  first_fired_at TIMESTAMPTZ NOT NULL,
  last_fired_at TIMESTAMPTZ NOT NULL,
  total_count INTEGER NOT NULL DEFAULT 1,
  unique_services TEXT[] DEFAULT '{}',
  recommended_action TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alert_correlation_groups_tenant ON alert_correlation_groups(tenant_id);
CREATE INDEX IF NOT EXISTS idx_alert_correlation_groups_severity ON alert_correlation_groups(severity);
CREATE INDEX IF NOT EXISTS idx_alert_correlation_groups_fired ON alert_correlation_groups(last_fired_at DESC);

-- 4. Topology nodes (AlertCorrelationService.topologyNodes)
CREATE TABLE IF NOT EXISTS alert_topology_nodes (
  id TEXT PRIMARY KEY,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  node_type TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'healthy',
  parent_id TEXT,
  children_ids TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alert_topology_nodes_tenant ON alert_topology_nodes(tenant_id);

-- 5. RCA results (RootCauseAnalysisService.analysisResults)
CREATE TABLE IF NOT EXISTS rca_results (
  id TEXT PRIMARY KEY,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  status TEXT NOT NULL DEFAULT 'completed',
  affected_services JSONB NOT NULL DEFAULT '[]',
  correlated_alerts JSONB NOT NULL DEFAULT '[]',
  root_cause JSONB,
  top_root_causes JSONB NOT NULL DEFAULT '[]',
  topology_path TEXT[] DEFAULT '{}',
  time_window_start TIMESTAMPTZ NOT NULL,
  time_window_end TIMESTAMPTZ NOT NULL,
  alert_count INTEGER NOT NULL DEFAULT 0,
  group_count INTEGER NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rca_results_tenant ON rca_results(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rca_results_completed ON rca_results(completed_at DESC);

-- 6. Service dependency graph (RootCauseAnalysisService.dependencyGraph)
CREATE TABLE IF NOT EXISTS service_dependencies (
  id TEXT PRIMARY KEY,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  depends_on TEXT[] NOT NULL DEFAULT '{}',
  dependency_type TEXT NOT NULL DEFAULT 'sync',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_service_dependencies_tenant ON service_dependencies(tenant_id);

-- 7. Timeline events (RootCauseAnalysisService.timelineEvents)
CREATE TABLE IF NOT EXISTS rca_timeline_events (
  id TEXT PRIMARY KEY,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  deployment_id TEXT NOT NULL,
  event_timestamp TIMESTAMPTZ NOT NULL,
  service TEXT NOT NULL,
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info',
  description TEXT NOT NULL DEFAULT '',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rca_timeline_events_deployment ON rca_timeline_events(deployment_id);
CREATE INDEX IF NOT EXISTS idx_rca_timeline_events_tenant ON rca_timeline_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rca_timeline_events_time ON rca_timeline_events(event_timestamp);

-- 8. Deduplication groups (AlertDeduplication.alertGroups)
CREATE TABLE IF NOT EXISTS alert_deduplication_groups (
  id TEXT PRIMARY KEY,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  alerts JSONB NOT NULL DEFAULT '[]',
  count INTEGER NOT NULL DEFAULT 0,
  first_occurrence TIMESTAMPTZ NOT NULL,
  last_occurrence TIMESTAMPTZ NOT NULL,
  suppressed BOOLEAN NOT NULL DEFAULT false,
  suppression_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alert_dedup_groups_tenant ON alert_deduplication_groups(tenant_id);
CREATE INDEX IF NOT EXISTS idx_alert_dedup_groups_fingerprint ON alert_deduplication_groups(id);
CREATE INDEX IF NOT EXISTS idx_alert_dedup_groups_last ON alert_deduplication_groups(last_occurrence DESC);

-- 9. Monitoring dashboard widget configs (MonitoringDashboard.widgetConfigs)
CREATE TABLE IF NOT EXISTS monitoring_widget_configs (
  id TEXT PRIMARY KEY,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  title TEXT NOT NULL,
  metrics TEXT[] NOT NULL DEFAULT '{}',
  time_window TEXT NOT NULL DEFAULT '1h',
  tags JSONB DEFAULT '{}',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_monitoring_widget_configs_tenant ON monitoring_widget_configs(tenant_id);
