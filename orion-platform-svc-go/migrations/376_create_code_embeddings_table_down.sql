-- Reverse 376_create_code_embeddings_table.sql.
-- Drops 2 tables created by this migration.
-- Order: child tables first (CASCADE handles FK dependencies).
--
DROP TABLE IF EXISTS code_embedding_stats CASCADE;
DROP TABLE IF EXISTS code_embeddings CASCADE;
