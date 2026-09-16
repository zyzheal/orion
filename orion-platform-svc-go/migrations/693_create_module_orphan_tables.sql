-- 693_create_module_orphan_tables.sql
--
-- Missing DDL for 22 orphan tables across 9 modules that internal/*
-- repositories reference but no earlier migration creates. Group 2 of the
-- orphan inventory: docs/orphan-tables-inventory-2026-09-16.md.
-- Modules: visor, ticket, config, eventbus, alert-adapter, auto-recovery,
-- cmdb-drift, cmdb-relationship.
--
-- Column shapes read from each repository's INSERT/SELECT column lists and the
-- module's db tags. Notes:
--   * event_logs.sequence_num is fed by nextval('event_bus_seq') in the
--     repository's INSERT, and event_logs is read back via StructScan with
--     RETURNING, so the sequence must be created here (idempotently).
--   * metric_data_points is inserted WITHOUT id and selected WITH id, so the
--     id column is a BIGSERIAL / identity, not application-generated UUID.
--   * assignment_rules writes a column literally named "order" (quoted in the
--     repository SQL because ORDER is a reserved word), so the DDL schema has
--     a quoted "order" column; the categories / priorities columns hold JSON.
--   * alert_adapters.config, cmdb_relationships.attributes, ticket
--     automation_rules.condition/actions are bound as ::jsonb.
--
-- Idempotent by construction (IF NOT EXISTS).

-- ==================== visor ====================

CREATE TABLE IF NOT EXISTS monitor_hosts (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    host VARCHAR(255),
    port INT DEFAULT 0,
    status VARCHAR(32) DEFAULT 'unknown',
    os_type VARCHAR(64),
    tags JSONB DEFAULT '[]'::jsonb,
    agent_id VARCHAR(64),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_monitor_hosts_tenant ON monitor_hosts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_monitor_hosts_status ON monitor_hosts(status);

CREATE TABLE IF NOT EXISTS alert_instances (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    rule_id VARCHAR(36),
    rule_name VARCHAR(255),
    metric VARCHAR(128),
    value DOUBLE PRECISION DEFAULT 0,
    threshold DOUBLE PRECISION DEFAULT 0,
    severity VARCHAR(16) DEFAULT 'warning',
    status VARCHAR(32) DEFAULT 'firing',
    message TEXT,
    tags JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_alert_instances_tenant ON alert_instances(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alert_instances_status ON alert_instances(status);

CREATE TABLE IF NOT EXISTS metric_data_points (
    id BIGSERIAL PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    metric_name VARCHAR(255) NOT NULL,
    value DOUBLE PRECISION DEFAULT 0,
    tags JSONB DEFAULT '{}'::jsonb,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_metric_data_points_key ON metric_data_points(tenant_id, metric_name, timestamp DESC);

CREATE TABLE IF NOT EXISTS notification_history (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    alert_id VARCHAR(36),
    channel_id VARCHAR(36),
    channel_type VARCHAR(32),
    status VARCHAR(32) DEFAULT 'pending',
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_history_tenant ON notification_history(tenant_id, created_at DESC);

-- ==================== ticket ====================

CREATE TABLE IF NOT EXISTS assignment_rules (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    categories JSONB DEFAULT '[]'::jsonb,
    assignee VARCHAR(64),
    priorities JSONB DEFAULT '[]'::jsonb,
    enabled BOOLEAN DEFAULT TRUE,
    "order" INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS automation_rules (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    condition JSONB DEFAULT '{}'::jsonb,
    actions JSONB DEFAULT '[]'::jsonb,
    enabled BOOLEAN DEFAULT TRUE,
    execution_count INT DEFAULT 0,
    created_by VARCHAR(64),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_automation_rules_tenant ON automation_rules(tenant_id);

CREATE TABLE IF NOT EXISTS automation_rule_executions (
    id VARCHAR(36) PRIMARY KEY,
    rule_id VARCHAR(36) NOT NULL,
    ticket_id VARCHAR(36) NOT NULL,
    tenant_id VARCHAR(36) NOT NULL,
    triggered_by VARCHAR(64),
    conditions_met JSONB DEFAULT '{}'::jsonb,
    actions_taken JSONB DEFAULT '[]'::jsonb,
    status VARCHAR(32) DEFAULT 'pending',
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_automation_rule_execs_tenant ON automation_rule_executions(tenant_id, rule_id, created_at DESC);

CREATE TABLE IF NOT EXISTS sla_policies (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    priority VARCHAR(32) DEFAULT 'P2',
    target_response_time_ms BIGINT DEFAULT 0,
    target_resolution_time_ms BIGINT DEFAULT 0,
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sla_policies_tenant ON sla_policies(tenant_id);

-- ==================== config ====================

CREATE TABLE IF NOT EXISTS config_approvals (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    config_key VARCHAR(255) NOT NULL,
    environment VARCHAR(64),
    current_value TEXT,
    proposed_value TEXT,
    status VARCHAR(32) DEFAULT 'pending',
    requested_by VARCHAR(64),
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    reviewed_by VARCHAR(64),
    reviewed_at TIMESTAMPTZ,
    review_comment TEXT
);

CREATE INDEX IF NOT EXISTS idx_config_approvals_tenant ON config_approvals(tenant_id, status);

CREATE TABLE IF NOT EXISTS config_canaries (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    config_id VARCHAR(36) NOT NULL,
    canary_value TEXT,
    baseline_value TEXT,
    status VARCHAR(32) DEFAULT 'active',
    created_by VARCHAR(64),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_config_canaries_tenant ON config_canaries(tenant_id);

CREATE TABLE IF NOT EXISTS config_drifts (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    config_id VARCHAR(36),
    config_key VARCHAR(255),
    environment VARCHAR(64),
    expected_value TEXT,
    actual_value TEXT,
    drift_type VARCHAR(32),
    detected_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_config_drifts_tenant ON config_drifts(tenant_id, config_key, detected_at DESC);

CREATE TABLE IF NOT EXISTS git_sync_configs (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    repo_url VARCHAR(1024) NOT NULL,
    branch VARCHAR(128),
    path VARCHAR(1024),
    environment VARCHAR(64),
    auto_sync BOOLEAN DEFAULT FALSE,
    sync_interval_sec INT DEFAULT 300,
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_git_sync_configs_tenant ON git_sync_configs(tenant_id);

-- ==================== eventbus ====================

CREATE SEQUENCE IF NOT EXISTS event_bus_seq;

CREATE TABLE IF NOT EXISTS event_subscriptions (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    event_type VARCHAR(128) NOT NULL,
    handler VARCHAR(255) NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_subscriptions_tenant ON event_subscriptions(tenant_id, event_type);

CREATE TABLE IF NOT EXISTS event_logs (
    id BIGSERIAL PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    event_type VARCHAR(128) NOT NULL,
    subject VARCHAR(255),
    source VARCHAR(255),
    payload JSONB DEFAULT '{}'::jsonb,
    sequence_num BIGINT,
    status VARCHAR(32) DEFAULT 'pending',
    published_by VARCHAR(64),
    published_at TIMESTAMPTZ DEFAULT NOW(),
    processed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_logs_tenant ON event_logs(tenant_id, sequence_num DESC);
CREATE INDEX IF NOT EXISTS idx_event_logs_status ON event_logs(status);

CREATE TABLE IF NOT EXISTS event_bus_config (
    id BIGSERIAL PRIMARY KEY,
    config_key VARCHAR(255) NOT NULL,
    config_value TEXT,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_event_bus_config_key UNIQUE (config_key)
);

-- ==================== alert-adapter ====================

CREATE TABLE IF NOT EXISTS alert_adapters (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(64) NOT NULL,
    category VARCHAR(64),
    config JSONB DEFAULT '{}'::jsonb,
    status VARCHAR(32) DEFAULT 'active',
    enabled BOOLEAN DEFAULT TRUE,
    error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alert_adapters_tenant ON alert_adapters(tenant_id);

CREATE TABLE IF NOT EXISTS alert_events (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    adapter_id VARCHAR(36),
    source VARCHAR(128),
    title VARCHAR(255),
    message TEXT,
    severity VARCHAR(16) DEFAULT 'info',
    labels JSONB DEFAULT '{}'::jsonb,
    payload JSONB DEFAULT '{}'::jsonb,
    status VARCHAR(32) DEFAULT 'received',
    processed_at TIMESTAMPTZ,
    error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alert_events_tenant ON alert_events(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alert_events_status ON alert_events(status);

-- ==================== auto-recovery ====================

CREATE TABLE IF NOT EXISTS auto_recovery_rules (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    trigger VARCHAR(128),
    condition TEXT,
    action VARCHAR(255),
    target VARCHAR(255),
    is_enabled BOOLEAN DEFAULT TRUE,
    max_retries INT DEFAULT 3,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auto_recovery_rules_tenant ON auto_recovery_rules(tenant_id);

CREATE TABLE IF NOT EXISTS recovery_actions (
    id VARCHAR(36) PRIMARY KEY,
    rule_id VARCHAR(36) NOT NULL,
    tenant_id VARCHAR(36) NOT NULL,
    action VARCHAR(255),
    target VARCHAR(255),
    status VARCHAR(32) DEFAULT 'pending',
    result TEXT,
    retry_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_recovery_actions_tenant ON recovery_actions(tenant_id, rule_id, created_at DESC);

-- ==================== cmdb-drift ====================

CREATE TABLE IF NOT EXISTS cmdb_drift_records (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    ci_id VARCHAR(36) NOT NULL,
    ci_name VARCHAR(255),
    ci_type VARCHAR(64),
    property VARCHAR(128),
    environment VARCHAR(64),
    expected_value TEXT,
    actual_value TEXT,
    drift_type VARCHAR(32),
    severity VARCHAR(16) DEFAULT 'warning',
    detected_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    resolved_by VARCHAR(64),
    resolution TEXT,
    remediated BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cmdb_drift_records_tenant ON cmdb_drift_records(tenant_id, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_cmdb_drift_records_status ON cmdb_drift_records(remediated);

-- ==================== cmdb-relationship ====================

CREATE TABLE IF NOT EXISTS cmdb_relationship_types (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    source_type VARCHAR(64) NOT NULL,
    target_type VARCHAR(64) NOT NULL,
    cardinality VARCHAR(16) DEFAULT 'many_to_many',
    bidirectional BOOLEAN DEFAULT FALSE,
    inverse_name VARCHAR(255),
    icon VARCHAR(64),
    color VARCHAR(16),
    attributes JSONB DEFAULT '{}'::jsonb,
    enabled BOOLEAN DEFAULT TRUE,
    status VARCHAR(32) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cmdb_rel_types_tenant ON cmdb_relationship_types(tenant_id);

CREATE TABLE IF NOT EXISTS cmdb_relationships (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    source_id VARCHAR(36) NOT NULL,
    target_id VARCHAR(36) NOT NULL,
    type_id VARCHAR(36) NOT NULL,
    attributes JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cmdb_relationships_source ON cmdb_relationships(tenant_id, source_id);
CREATE INDEX IF NOT EXISTS idx_cmdb_relationships_target ON cmdb_relationships(tenant_id, target_id);