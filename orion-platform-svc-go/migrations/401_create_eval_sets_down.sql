-- Reverse 401_create_eval_sets.sql.
-- Drops 2 tables created by this migration.
-- Order: child tables first (CASCADE handles FK dependencies).
--
DROP TABLE IF EXISTS eval_set_cases CASCADE;
DROP TABLE IF EXISTS eval_sets CASCADE;
