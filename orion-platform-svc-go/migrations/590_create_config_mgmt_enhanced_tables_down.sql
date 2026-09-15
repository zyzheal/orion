-- Reversal of 590_create_config_mgmt_enhanced_tables.sql.
DROP INDEX IF EXISTS idx_config_drift_reports_created;
DROP INDEX IF EXISTS idx_config_drift_reports_group;
DROP INDEX IF EXISTS idx_config_drift_reports_status;
DROP INDEX IF EXISTS idx_config_drift_reports_tenant;
DROP TABLE IF EXISTS config_drift_reports;
DROP INDEX IF EXISTS idx_config_change_history_created;
DROP INDEX IF EXISTS idx_config_change_history_request;
DROP INDEX IF EXISTS idx_config_change_history_tenant;
DROP TABLE IF EXISTS config_change_history;
DROP INDEX IF EXISTS idx_config_change_requests_created;
DROP INDEX IF EXISTS idx_config_change_requests_config_key;
DROP INDEX IF EXISTS idx_config_change_requests_status;
DROP INDEX IF EXISTS idx_config_change_requests_tenant;
DROP TABLE IF EXISTS config_change_requests;
DROP INDEX IF EXISTS idx_config_mgmt_created;
DROP INDEX IF EXISTS idx_config_mgmt_tenant;
DROP TABLE IF EXISTS config_mgmt;
