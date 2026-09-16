-- Generic module registry tables: missing DDL for 16 hyphen-named modules
-- Migration 688
--
-- Sixteen modules addressed their table by a hyphenated, unquoted identifier
-- (message-queue, unified-config, ...). Postgres rejects a hyphen in an
-- unquoted identifier as a syntax error before any name resolution, so every
-- route in those modules failed at parse time: nothing reached the driver.
-- The repositories now write the underscore form (message_queue, ...), which is
-- what this migration creates.
--
-- gateway_route_configs is deliberately not gateway_routes: gateway-dynamic
-- owns gateway_routes (043_create_gateway_dynamic_tables.sql) with a different
-- schema (path / methods / upstream_url / priority / metadata). Sharing the
-- name would have made the two features read and overwrite each other's rows.
--
-- 659 / 668 / 669 create the hyphenated names double-quoted
-- ("message-queue", "notification-management", "plugin-hotreload",
-- "vectorize-rules", "test-reports"). Those tables are reachable by no
-- statement: unquoted and quoted identifiers are different objects and the
-- repositories never quote. They are left in place; this migration supersedes
-- them.
--
-- Column shapes are read from each repository's INSERT column list and the
-- module's db tags, not chosen: all seven columns are bound explicitly, so
-- NOT NULL is not load-bearing and DEFAULT NOW() is only a fallback.

CREATE TABLE IF NOT EXISTS message_queue (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    value TEXT,
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_message_queue_tenant ON message_queue(tenant_id);
CREATE INDEX IF NOT EXISTS idx_message_queue_enabled ON message_queue(tenant_id, enabled);

CREATE TABLE IF NOT EXISTS multi_modal_trigger (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    value TEXT,
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_multi_modal_trigger_tenant ON multi_modal_trigger(tenant_id);
CREATE INDEX IF NOT EXISTS idx_multi_modal_trigger_enabled ON multi_modal_trigger(tenant_id, enabled);

CREATE TABLE IF NOT EXISTS notification_management (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    value TEXT,
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_management_tenant ON notification_management(tenant_id);
CREATE INDEX IF NOT EXISTS idx_notification_management_enabled ON notification_management(tenant_id, enabled);

CREATE TABLE IF NOT EXISTS oci_registry (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    value TEXT,
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_oci_registry_tenant ON oci_registry(tenant_id);
CREATE INDEX IF NOT EXISTS idx_oci_registry_enabled ON oci_registry(tenant_id, enabled);

CREATE TABLE IF NOT EXISTS plugin_hotreload (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    value TEXT,
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plugin_hotreload_tenant ON plugin_hotreload(tenant_id);
CREATE INDEX IF NOT EXISTS idx_plugin_hotreload_enabled ON plugin_hotreload(tenant_id, enabled);

CREATE TABLE IF NOT EXISTS script_library (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    value TEXT,
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_script_library_tenant ON script_library(tenant_id);
CREATE INDEX IF NOT EXISTS idx_script_library_enabled ON script_library(tenant_id, enabled);

CREATE TABLE IF NOT EXISTS script_version (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    value TEXT,
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_script_version_tenant ON script_version(tenant_id);
CREATE INDEX IF NOT EXISTS idx_script_version_enabled ON script_version(tenant_id, enabled);

CREATE TABLE IF NOT EXISTS self_service (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    value TEXT,
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_self_service_tenant ON self_service(tenant_id);
CREATE INDEX IF NOT EXISTS idx_self_service_enabled ON self_service(tenant_id, enabled);

CREATE TABLE IF NOT EXISTS ticket_knowledge (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    value TEXT,
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ticket_knowledge_tenant ON ticket_knowledge(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ticket_knowledge_enabled ON ticket_knowledge(tenant_id, enabled);

CREATE TABLE IF NOT EXISTS unified_config (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    value TEXT,
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_unified_config_tenant ON unified_config(tenant_id);
CREATE INDEX IF NOT EXISTS idx_unified_config_enabled ON unified_config(tenant_id, enabled);

CREATE TABLE IF NOT EXISTS vector_store (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    value TEXT,
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vector_store_tenant ON vector_store(tenant_id);
CREATE INDEX IF NOT EXISTS idx_vector_store_enabled ON vector_store(tenant_id, enabled);

CREATE TABLE IF NOT EXISTS vectorize_rules (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    value TEXT,
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vectorize_rules_tenant ON vectorize_rules(tenant_id);
CREATE INDEX IF NOT EXISTS idx_vectorize_rules_enabled ON vectorize_rules(tenant_id, enabled);

CREATE TABLE IF NOT EXISTS version_archive (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    value TEXT,
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_version_archive_tenant ON version_archive(tenant_id);
CREATE INDEX IF NOT EXISTS idx_version_archive_enabled ON version_archive(tenant_id, enabled);

CREATE TABLE IF NOT EXISTS rate_limiting (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rate_limiting_tenant ON rate_limiting(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rate_limiting_enabled ON rate_limiting(tenant_id, enabled);

CREATE TABLE IF NOT EXISTS test_reports (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_test_reports_tenant ON test_reports(tenant_id);
CREATE INDEX IF NOT EXISTS idx_test_reports_enabled ON test_reports(tenant_id, enabled);

CREATE TABLE IF NOT EXISTS gateway_route_configs (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gateway_route_configs_tenant ON gateway_route_configs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_gateway_route_configs_enabled ON gateway_route_configs(tenant_id, enabled);

-- service_catalog_requests / service_catalog_timeline
-- Addressed by internal/service-catalog/repository/requests.go, previously as
-- service-catalog-requests and service-catalog-timeline.
--
-- The column set is the union of the ServiceRequest db tags and the columns
-- GetSLABreaches selects (request_id, service, sla_target_ms, actual_ms).
-- created_at / updated_at are BIGINT because ServiceRequest declares both as
-- int64 and UpdateRequestStatus binds now.Unix() into updated_at. GetSLABreaches
-- compares created_at against a time.Time argument, which no single column type
-- satisfies; that mismatch is a separate defect and is left for the writer to
-- exist first. Nothing currently INSERTs into this table.
CREATE TABLE IF NOT EXISTS service_catalog_requests (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    service_id VARCHAR(36),
    service VARCHAR(255),
    request_id VARCHAR(36),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(64) NOT NULL DEFAULT 'pending',
    priority VARCHAR(32),
    assigned_to VARCHAR(36),
    sla_target_ms BIGINT,
    actual_ms BIGINT,
    created_at BIGINT,
    updated_at BIGINT
);
CREATE INDEX IF NOT EXISTS idx_service_catalog_requests_tenant ON service_catalog_requests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_service_catalog_requests_status ON service_catalog_requests(tenant_id, status);

-- Column list from the INSERT in UpdateRequestStatus. action / by / comment are
-- non-reserved in postgres, so unquoted names match the unquoted references the
-- repository writes.
CREATE TABLE IF NOT EXISTS service_catalog_timeline (
    id VARCHAR(36) PRIMARY KEY,
    request_id VARCHAR(36) NOT NULL,
    tenant_id VARCHAR(36) NOT NULL,
    action VARCHAR(255) NOT NULL,
    by VARCHAR(36),
    comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_service_catalog_timeline_request ON service_catalog_timeline(request_id);
CREATE INDEX IF NOT EXISTS idx_service_catalog_timeline_tenant ON service_catalog_timeline(tenant_id);
