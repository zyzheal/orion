-- Migration 002: Add full-text search GIN index for CMDB
-- Enables to_tsvector / to_tsquery based text search across CMDB CI fields.

-- GIN index on combined name, ci_id, ci_type and description for fast FTS.
CREATE INDEX IF NOT EXISTS idx_cmdb_cis_fts ON cmdb_cis
    USING GIN (to_tsvector('english',
        coalesce(name, '') || ' ' ||
        coalesce(ci_id, '') || ' ' ||
        coalesce(ci_type, '') || ' ' ||
        coalesce(description, '')
    ));

COMMENT ON INDEX idx_cmdb_cis_fts IS 'Full-text search index for CMDB CI fields.';
