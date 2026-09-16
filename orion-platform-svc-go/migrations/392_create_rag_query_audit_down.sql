-- Reverse 392_create_rag_query_audit.sql.
-- Drops 1 tables created by this migration.
-- Order: child tables first (CASCADE handles FK dependencies).
--
DROP TABLE IF EXISTS rag_query_audit CASCADE;
