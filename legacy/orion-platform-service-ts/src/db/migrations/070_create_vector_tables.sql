-- Migration 070: Code and Knowledge Embeddings (pgvector enhancement)
-- Specialized tables for code semantic search and knowledge base search

-- Enable pgvector extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS vector;

-- Code embeddings table for semantic code search
CREATE TABLE IF NOT EXISTS code_embeddings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    UUID NOT NULL,
  file_path     VARCHAR(500) NOT NULL,
  chunk_type    VARCHAR(50) NOT NULL,  -- 'function', 'class', 'file', 'snippet'
  chunk_name    VARCHAR(200),
  content       TEXT NOT NULL,
  embedding     vector(1536),  -- OpenAI embedding dimension (ada-002)
  metadata      JSONB NOT NULL DEFAULT '{}',
  -- metadata contains: language, lineStart, lineEnd, dependencies, etc.
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Knowledge embeddings table for documentation search
CREATE TABLE IF NOT EXISTS knowledge_embeddings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_id        UUID NOT NULL,
  doc_type      VARCHAR(50) NOT NULL,  -- 'wiki', 'api_doc', 'design_doc', 'runbook'
  title         VARCHAR(500) NOT NULL,
  content       TEXT NOT NULL,
  embedding     vector(1536),
  metadata      JSONB NOT NULL DEFAULT '{}',
  -- metadata contains: author, version, tags, project, etc.
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for code embeddings
CREATE INDEX idx_code_embeddings_project ON code_embeddings(project_id);
CREATE INDEX idx_code_embeddings_file_path ON code_embeddings(file_path);
CREATE INDEX idx_code_embeddings_chunk_type ON code_embeddings(chunk_type);
CREATE INDEX idx_code_embeddings_metadata ON code_embeddings USING GIN(metadata);

-- IVFFlat index for fast approximate similarity search on code embeddings
CREATE INDEX idx_code_embeddings_vector ON code_embeddings
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Indexes for knowledge embeddings
CREATE INDEX idx_knowledge_embeddings_doc_id ON knowledge_embeddings(doc_id);
CREATE INDEX idx_knowledge_embeddings_doc_type ON knowledge_embeddings(doc_type);
CREATE INDEX idx_knowledge_embeddings_metadata ON knowledge_embeddings USING GIN(metadata);

-- IVFFlat index for knowledge embeddings
CREATE INDEX idx_knowledge_embeddings_vector ON knowledge_embeddings
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Comments for documentation
COMMENT ON TABLE code_embeddings IS 'Code chunks with embeddings for semantic code search';
COMMENT ON TABLE knowledge_embeddings IS 'Knowledge base documents with embeddings for semantic search';

COMMENT ON COLUMN code_embeddings.chunk_type IS 'Type of code chunk: function, class, file, or snippet';
COMMENT ON COLUMN code_embeddings.metadata IS 'JSON metadata: language, lineStart, lineEnd, dependencies, etc.';
COMMENT ON COLUMN knowledge_embeddings.doc_type IS 'Document type: wiki, api_doc, design_doc, runbook';