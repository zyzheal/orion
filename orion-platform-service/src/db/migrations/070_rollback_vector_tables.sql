-- Rollback Migration 070: Code and Knowledge Embeddings

DROP INDEX IF EXISTS idx_knowledge_embeddings_vector;
DROP INDEX IF EXISTS idx_knowledge_embeddings_metadata;
DROP INDEX IF EXISTS idx_knowledge_embeddings_doc_type;
DROP INDEX IF EXISTS idx_knowledge_embeddings_doc_id;

DROP INDEX IF EXISTS idx_code_embeddings_vector;
DROP INDEX IF EXISTS idx_code_embeddings_metadata;
DROP INDEX IF EXISTS idx_code_embeddings_chunk_type;
DROP INDEX IF EXISTS idx_code_embeddings_file_path;
DROP INDEX IF EXISTS idx_code_embeddings_project;

DROP TABLE IF EXISTS knowledge_embeddings;
DROP TABLE IF EXISTS code_embeddings;