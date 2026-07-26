-- Migration 001: Knowledge Service Core Tables
-- Creates all core tables for knowledge spaces, documents, document versions, chunks,
-- vector stores, vector embeddings, knowledge graph nodes and edges
-- Version: 1.0.0

-- ==================== Knowledge Spaces ====================
CREATE TABLE IF NOT EXISTS knowledge_spaces (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  VARCHAR(255) NOT NULL,
  description           TEXT,
  visibility            VARCHAR(20) NOT NULL DEFAULT 'private',
  status                VARCHAR(20) NOT NULL DEFAULT 'active',
  owner_id              VARCHAR(255) NOT NULL,
  team_id               VARCHAR(255),
  tags                  JSONB NOT NULL DEFAULT '[]',
  config                JSONB NOT NULL DEFAULT '{}',
  document_count        INTEGER NOT NULL DEFAULT 0,
  vector_indexing_enabled BOOLEAN NOT NULL DEFAULT false,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_knowledge_spaces_owner ON knowledge_spaces(owner_id);
CREATE INDEX idx_knowledge_spaces_team ON knowledge_spaces(team_id);
CREATE INDEX idx_knowledge_spaces_visibility ON knowledge_spaces(visibility);
CREATE INDEX idx_knowledge_spaces_status ON knowledge_spaces(status);

-- ==================== Knowledge Documents ====================
CREATE TABLE IF NOT EXISTS knowledge_docs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id        UUID NOT NULL REFERENCES knowledge_spaces(id) ON DELETE CASCADE,
  title           VARCHAR(500) NOT NULL,
  content         TEXT,
  doc_type        VARCHAR(20) NOT NULL DEFAULT 'text',
  status          VARCHAR(20) NOT NULL DEFAULT 'draft',
  summary         TEXT,
  tags            JSONB NOT NULL DEFAULT '[]',
  metadata        JSONB NOT NULL DEFAULT '{}',
  source_url      VARCHAR(1000),
  version         INTEGER NOT NULL DEFAULT 1,
  author_id       VARCHAR(255),
  vectorized      BOOLEAN NOT NULL DEFAULT false,
  chunk_count     INTEGER,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at    TIMESTAMPTZ
);

CREATE INDEX idx_knowledge_docs_space ON knowledge_docs(space_id);
CREATE INDEX idx_knowledge_docs_status ON knowledge_docs(status);
CREATE INDEX idx_knowledge_docs_type ON knowledge_docs(doc_type);
CREATE INDEX idx_knowledge_docs_author ON knowledge_docs(author_id);
CREATE INDEX idx_knowledge_docs_vectorized ON knowledge_docs(vectorized);
CREATE INDEX idx_knowledge_docs_created ON knowledge_docs(created_at);

-- ==================== Document Versions ====================
CREATE TABLE IF NOT EXISTS doc_versions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_id          UUID NOT NULL REFERENCES knowledge_docs(id) ON DELETE CASCADE,
  version         INTEGER NOT NULL,
  content         TEXT NOT NULL,
  change_log      TEXT,
  author_id       VARCHAR(255),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_doc_versions_doc ON doc_versions(doc_id);
CREATE INDEX idx_doc_versions_version ON doc_versions(doc_id, version);

-- ==================== Document Chunks ====================
CREATE TABLE IF NOT EXISTS document_chunks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_id          UUID NOT NULL REFERENCES knowledge_docs(id) ON DELETE CASCADE,
  chunk_index     INTEGER NOT NULL,
  content         TEXT NOT NULL,
  metadata        JSONB NOT NULL DEFAULT '{}',
  embedding_id    VARCHAR(255),
  token_count     INTEGER,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_document_chunks_doc ON document_chunks(doc_id);
CREATE INDEX idx_document_chunks_index ON document_chunks(doc_id, chunk_index);

-- ==================== Vector Stores ====================
CREATE TABLE IF NOT EXISTS vector_stores (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(255) NOT NULL,
  description     TEXT,
  owner_id        VARCHAR(255) NOT NULL,
  space_id        UUID REFERENCES knowledge_spaces(id),
  status          VARCHAR(20) NOT NULL DEFAULT 'active',
  config          JSONB NOT NULL DEFAULT '{}',
  vector_count    INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_indexed_at TIMESTAMPTZ
);

CREATE INDEX idx_vector_stores_owner ON vector_stores(owner_id);
CREATE INDEX idx_vector_stores_space ON vector_stores(space_id);
CREATE INDEX idx_vector_stores_status ON vector_stores(status);

-- ==================== Vector Embeddings ====================
CREATE TABLE IF NOT EXISTS vector_embeddings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id        UUID NOT NULL REFERENCES vector_stores(id) ON DELETE CASCADE,
  ref_id          VARCHAR(255) NOT NULL,
  ref_type        VARCHAR(50) NOT NULL DEFAULT 'chunk',
  vector          vector,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_vector_embeddings_store ON vector_embeddings(store_id);
CREATE INDEX idx_vector_embeddings_ref ON vector_embeddings(ref_id, ref_type);

-- ==================== Graph Nodes ====================
CREATE TABLE IF NOT EXISTS graph_nodes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id        UUID NOT NULL REFERENCES knowledge_spaces(id) ON DELETE CASCADE,
  type            VARCHAR(100) NOT NULL,
  label           VARCHAR(500) NOT NULL,
  properties      JSONB NOT NULL DEFAULT '{}',
  source_doc_id   UUID REFERENCES knowledge_docs(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_graph_nodes_space ON graph_nodes(space_id);
CREATE INDEX idx_graph_nodes_type ON graph_nodes(type);
CREATE INDEX idx_graph_nodes_label ON graph_nodes(label);

-- ==================== Graph Edges ====================
CREATE TABLE IF NOT EXISTS graph_edges (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id        UUID NOT NULL REFERENCES knowledge_spaces(id) ON DELETE CASCADE,
  source_node_id  UUID NOT NULL REFERENCES graph_nodes(id) ON DELETE CASCADE,
  target_node_id  UUID NOT NULL REFERENCES graph_nodes(id) ON DELETE CASCADE,
  type            VARCHAR(100) NOT NULL,
  properties      JSONB NOT NULL DEFAULT '{}',
  source_doc_id   UUID REFERENCES knowledge_docs(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_graph_edges_space ON graph_edges(space_id);
CREATE INDEX idx_graph_edges_source ON graph_edges(source_node_id);
CREATE INDEX idx_graph_edges_target ON graph_edges(target_node_id);
CREATE INDEX idx_graph_edges_type ON graph_edges(type);

-- ==================== Migration Info ====================
CREATE TABLE IF NOT EXISTS knowledge_schema_migrations (
  version             VARCHAR(20) PRIMARY KEY,
  applied_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  description         TEXT
);

INSERT INTO knowledge_schema_migrations (version, description)
VALUES ('001', 'Initial knowledge service tables: spaces, docs, versions, chunks, vector_stores, embeddings, graph_nodes, graph_edges');
