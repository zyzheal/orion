-- Reverse 391_create_rca_fix_suggestions.sql.
-- Drops 1 tables created by this migration.
-- Order: child tables first (CASCADE handles FK dependencies).
--
DROP TABLE IF EXISTS rca_fix_suggestions CASCADE;
