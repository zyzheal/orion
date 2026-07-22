-- Migration #251: Add database_name to data_catalog_entries
-- Tracks which source database a discovered catalog entry originated from.

ALTER TABLE data_catalog_entries
    ADD COLUMN IF NOT EXISTS database_name VARCHAR(255) DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_data_catalog_entries_database
    ON data_catalog_entries(tenant_id, database_name);
