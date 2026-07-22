-- Migration 057: Vector Store Table (G2)
-- Real vector storage using pgvector for VectorStore service

-- Vector collection table
CREATE TABLE IF NOT EXISTS vector_documents (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection    VARCHAR(200) NOT NULL DEFAULT 'default',
  content       TEXT NOT NULL,
  content_hash  VARCHAR(64),
  metadata      JSONB NOT NULL DEFAULT '{}',
  embedding     vector(1536),  -- OpenAI ada-002 compatible, adjustable
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_vector_collection ON vector_documents(collection);
CREATE INDEX idx_vector_content_hash ON vector_documents(content_hash);
CREATE INDEX idx_vector_metadata ON vector_documents USING GIN(metadata);

-- HNSW index for fast approximate similarity search (pgvector >= 0.5.0)
-- For older versions, use ivfflat: CREATE INDEX idx_vector_embedding ON vector_documents USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_vector_embedding ON vector_documents USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Rollback:
-- DROP INDEX IF EXISTS idx_vector_embedding;
-- DROP INDEX IF EXISTS idx_vector_metadata;
-- DROP INDEX IF EXISTS idx_vector_content_hash;
-- DROP INDEX IF EXISTS idx_vector_collection;
-- DROP TABLE IF EXISTS vector_documents;
