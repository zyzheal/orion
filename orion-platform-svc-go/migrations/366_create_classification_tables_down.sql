-- Reverse 366_create_classification_tables.sql.
-- Drops 2 tables created by this migration.
-- Order: child tables first (CASCADE handles FK dependencies).
--
DROP TABLE IF EXISTS classified_resources CASCADE;
DROP TABLE IF EXISTS classification_rules CASCADE;
