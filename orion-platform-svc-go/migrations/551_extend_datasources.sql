-- 551_extend_datasources.sql
-- Extend the migration-030 data_sources table so internal/datasource can persist
-- the credential and pool settings its service actually manages. Before this
-- migration the table only held name/type/host/port/database/username/status, so
-- password_enc / ssl_mode / auth_source / pool tuning / last error / tags had
-- nowhere to live and the whole module could not be wired to storage.
-- All statements are idempotent.

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
        WHERE table_name = 'data_sources' AND column_name = 'password_enc') THEN
        ALTER TABLE data_sources ADD COLUMN password_enc TEXT;
        COMMENT ON COLUMN data_sources.password_enc IS 'AES-256-GCM encrypted password; never returned by the API';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
        WHERE table_name = 'data_sources' AND column_name = 'ssl_mode') THEN
        ALTER TABLE data_sources ADD COLUMN ssl_mode VARCHAR(20);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
        WHERE table_name = 'data_sources' AND column_name = 'auth_source') THEN
        ALTER TABLE data_sources ADD COLUMN auth_source VARCHAR(50);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
        WHERE table_name = 'data_sources' AND column_name = 'max_open_conns') THEN
        ALTER TABLE data_sources ADD COLUMN max_open_conns BIGINT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
        WHERE table_name = 'data_sources' AND column_name = 'max_idle_conns') THEN
        ALTER TABLE data_sources ADD COLUMN max_idle_conns BIGINT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
        WHERE table_name = 'data_sources' AND column_name = 'conn_max_lifetime') THEN
        ALTER TABLE data_sources ADD COLUMN conn_max_lifetime BIGINT;
        COMMENT ON COLUMN data_sources.conn_max_lifetime IS 'Connection pool max lifetime in nanoseconds';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
        WHERE table_name = 'data_sources' AND column_name = 'error') THEN
        ALTER TABLE data_sources ADD COLUMN error TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
        WHERE table_name = 'data_sources' AND column_name = 'tags') THEN
        ALTER TABLE data_sources ADD COLUMN tags TEXT;
        COMMENT ON COLUMN data_sources.tags IS 'JSON object of user-supplied tags';
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_data_sources_type ON data_sources(source_type);
CREATE INDEX IF NOT EXISTS idx_data_sources_status ON data_sources(status);
