-- Reverse 051_ai_model_versions.sql.
-- Drops 1 tables created by this migration.
-- Order: child tables first (CASCADE handles FK dependencies).
--
DROP TABLE IF EXISTS ai_model_versions CASCADE;
