-- Reverse 055_ai_llm_traces.sql.
-- Drops 1 tables created by this migration.
-- Order: child tables first (CASCADE handles FK dependencies).
--
DROP TABLE IF EXISTS ai_llm_traces CASCADE;
