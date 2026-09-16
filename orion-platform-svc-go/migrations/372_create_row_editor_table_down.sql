-- Reverse 372_create_row_editor_table.sql.
-- Drops 1 tables created by this migration.
-- Order: child tables first (CASCADE handles FK dependencies).
--
DROP TABLE IF EXISTS row_editor CASCADE;
