-- Reverse 402_create_eval_runs.sql.
-- Drops 1 tables created by this migration.
-- Order: child tables first (CASCADE handles FK dependencies).
--
DROP TABLE IF EXISTS eval_runs CASCADE;
