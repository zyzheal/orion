-- Rollback for 001_create_alert_adapter_tables.sql

DROP INDEX IF EXISTS idx_alert_events_created_at;
DROP INDEX IF NOT EXISTS idx_alert_events_status;
DROP INDEX IF NOT EXISTS idx_alert_events_severity;
DROP INDEX IF NOT EXISTS idx_alert_events_adapter_id;
DROP INDEX IF NOT EXISTS idx_alert_events_tenant_id;

DROP TABLE IF EXISTS alert_events;

DROP INDEX IF NOT EXISTS idx_alert_adapters_status;
DROP INDEX IF NOT EXISTS idx_alert_adapters_enabled;
DROP INDEX IF NOT EXISTS idx_alert_adapters_category;
DROP INDEX IF NOT EXISTS idx_alert_adapters_type;
DROP INDEX IF NOT EXISTS idx_alert_adapters_tenant_name;
DROP INDEX IF NOT EXISTS idx_alert_adapters_tenant_id;

DROP TABLE IF EXISTS alert_adapters;
