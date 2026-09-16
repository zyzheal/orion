-- Reverse 362_create_masking_rules.sql.
-- Drops 1 tables created by this migration.
-- Order: child tables first (CASCADE handles FK dependencies).
--
DROP TABLE IF EXISTS masking_rules CASCADE;
