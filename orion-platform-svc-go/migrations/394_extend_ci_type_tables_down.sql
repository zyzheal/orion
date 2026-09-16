-- Reverse 394_extend_ci_type_tables.sql.
--
-- PARTIALLY REVERSIBLE: dropping the added columns is safe, but the UPDATE
-- backfill (attr_key = name, tenant_id copied from ci_types) and the
-- `SET NOT NULL` on attr_key are NOT reversible in isolation. After the
-- backfill, rows with attr_key = name become indistinguishable from rows
-- that originally had an attr_key value, so re-inserting the original NULLs
-- is impossible.
--
-- This down file only reverts the schema additions; data-level rollback
-- requires a pre-394 backup of ci_type_attributes.

DROP INDEX IF EXISTS idx_ci_type_attributes_attr_key;

ALTER TABLE ci_types          DROP COLUMN IF EXISTS icon;
ALTER TABLE ci_types          DROP COLUMN IF EXISTS category;
ALTER TABLE ci_types          DROP COLUMN IF EXISTS enabled;
ALTER TABLE ci_types          DROP COLUMN IF EXISTS version;

ALTER TABLE ci_type_attributes DROP COLUMN IF EXISTS attr_key;
ALTER TABLE ci_type_attributes DROP COLUMN IF EXISTS display_name;
ALTER TABLE ci_type_attributes DROP COLUMN IF EXISTS options;
ALTER TABLE ci_type_attributes DROP COLUMN IF EXISTS validation_rule;
ALTER TABLE ci_type_attributes DROP COLUMN IF EXISTS sort_order;
ALTER TABLE ci_type_attributes DROP COLUMN IF EXISTS tenant_id;

ALTER TABLE ci_type_versions   DROP COLUMN IF EXISTS tenant_id;
