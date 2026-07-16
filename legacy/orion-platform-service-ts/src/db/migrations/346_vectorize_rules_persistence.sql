-- Migration 346: Vectorize Rules and Vector Collections persistence
-- Migrates in-memory vectorize rules and vector collections to PostgreSQL

-- Vectorize rules table for auto-vectorization configuration
CREATE TABLE IF NOT EXISTS vectorize_rules (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         VARCHAR(100) NOT NULL DEFAULT 'default',
  name              VARCHAR(200) NOT NULL,
  source_type       VARCHAR(50) NOT NULL DEFAULT 'upload',
  file_types        JSONB NOT NULL DEFAULT '[]',
  chunk_size        INTEGER NOT NULL DEFAULT 512,
  chunk_overlap     INTEGER NOT NULL DEFAULT 50,
  embedding_model   VARCHAR(100) NOT NULL DEFAULT 'text-embedding-3-small',
  target_collection VARCHAR(200) NOT NULL,
  enabled           BOOLEAN NOT NULL DEFAULT true,
  last_run          TIMESTAMPTZ,
  processed_count   INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Vector collections table for index management
CREATE TABLE IF NOT EXISTS vector_collections (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         VARCHAR(100) NOT NULL DEFAULT 'default',
  name              VARCHAR(200) NOT NULL,
  display_name      VARCHAR(200),
  description       TEXT,
  dimensions        INTEGER NOT NULL DEFAULT 1536,
  index_type        VARCHAR(50) NOT NULL DEFAULT 'hnsw',
  distance_metric   VARCHAR(50) NOT NULL DEFAULT 'cosine',
  status            VARCHAR(50) NOT NULL DEFAULT 'active',
  document_count    INTEGER NOT NULL DEFAULT 0,
  parameters        JSONB NOT NULL DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, name)
);

-- Indexes for vectorize_rules
CREATE INDEX idx_vectorize_rules_tenant ON vectorize_rules(tenant_id);
CREATE INDEX idx_vectorize_rules_enabled ON vectorize_rules(enabled);
CREATE INDEX idx_vectorize_rules_source_type ON vectorize_rules(source_type);

-- Indexes for vector_collections
CREATE INDEX idx_vector_collections_tenant ON vector_collections(tenant_id);
CREATE INDEX idx_vector_collections_status ON vector_collections(status);
CREATE INDEX idx_vector_collections_name ON vector_collections(tenant_id, name);

COMMENT ON TABLE vectorize_rules IS 'Auto-vectorization rules for document processing';
COMMENT ON TABLE vector_collections IS 'Vector collections for index management';
