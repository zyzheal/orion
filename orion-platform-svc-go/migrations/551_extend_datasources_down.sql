-- 551_extend_datasources_down.sql
DROP INDEX IF EXISTS idx_data_sources_status;
DROP INDEX IF EXISTS idx_data_sources_type;

ALTER TABLE data_sources DROP COLUMN IF EXISTS tags;
ALTER TABLE data_sources DROP COLUMN IF EXISTS error;
ALTER TABLE data_sources DROP COLUMN IF EXISTS conn_max_lifetime;
ALTER TABLE data_sources DROP COLUMN IF EXISTS max_idle_conns;
ALTER TABLE data_sources DROP COLUMN IF EXISTS max_open_conns;
ALTER TABLE data_sources DROP COLUMN IF EXISTS auth_source;
ALTER TABLE data_sources DROP COLUMN IF EXISTS ssl_mode;
ALTER TABLE data_sources DROP COLUMN IF EXISTS password_enc;
