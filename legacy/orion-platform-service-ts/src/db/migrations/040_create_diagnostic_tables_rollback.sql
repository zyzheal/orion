-- Rollback Migration 040_create_diagnostic_tables
-- Auto-generated rollback script
-- Review carefully before executing in production

-- Dropping table: diagnostic_sessions
DROP TABLE IF EXISTS diagnostic_sessions CASCADE;

-- Dropping table: diagnostic_agents
DROP TABLE IF EXISTS diagnostic_agents CASCADE;

-- Dropping table: metric_data
DROP TABLE IF EXISTS metric_data CASCADE;

DROP INDEX IF EXISTS CREATE INDEX idx_diagno;
DROP INDEX IF EXISTS CREATE INDEX idx_diagno;
DROP INDEX IF EXISTS CREATE INDEX idx_diagno;
DROP INDEX IF EXISTS CREATE INDEX idx_metric_data_tenant ON metric_data(tenant_id);;
DROP INDEX IF EXISTS CREATE INDEX idx_metric_data_name ON metric_data(metric_name);;
DROP INDEX IF EXISTS CREATE INDEX idx_metric_data_time;
