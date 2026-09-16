-- Reverse 052_ai_generation_logs.sql.
-- Drops 1 tables created by this migration.
-- Order: child tables first (CASCADE handles FK dependencies).
--
DROP TABLE IF EXISTS ai_generation_logs CASCADE;
