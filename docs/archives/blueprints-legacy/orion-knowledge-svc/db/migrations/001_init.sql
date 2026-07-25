-- orion-knowledge-svc Database Migration
-- Initial schema for knowledge service (knowledge base + vector storage + graph)

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

-- Knowledge Spaces Table
CREATE TABLE IF NOT EXISTS knowledge_spaces (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id         UUID NOT NULL,
  name              VARCHAR(255) NOT NULL,
  description       TEXT,
  visibility        VARCHAR(50) NOT NULL DEFAULT 'private',
  created_by        VARCHAR(100) NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Knowledge Documents Table
CREATE TABLE IF NOT EXISTS knowledge_docs (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id          UUID NOT NULL,
  tenant_id         UUID NOT NULL,
  title             VARCHAR(500) NOT NULL,
  content           TEXT NOT NULL,
  doc_type          VARCHAR(50) NOT NULL DEFAULT 'article',
  status            VARCHAR(50) NOT NULL DEFAULT 'draft',
  tags              JSONB DEFAULT '[]',
  metadata          JSONB DEFAULT '{}',
  created_by        VARCHAR(100) NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (space_id) REFERENCES knowledge_spaces(id) ON DELETE CASCADE
);

-- Document Chunks Table (for embedding/vector search)
CREATE TABLE IF NOT EXISTS document_chunks (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  doc_id            UUID NOT NULL,
  chunk_index       INTEGER NOT NULL,
  content           TEXT NOT NULL,
  embedding         vector(1536),
  metadata          JSONB DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (doc_id) REFERENCES knowledge_docs(id) ON DELETE CASCADE
);

-- Vector Stores Table (external vector DB connections)
CREATE TABLE IF NOT EXISTS vector_stores (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id         UUID NOT NULL,
  name              VARCHAR(255) NOT NULL,
  provider          VARCHAR(100) NOT NULL,
  connection_config JSONB NOT NULL DEFAULT '{}',
  collection_name   VARCHAR(255) NOT NULL,
  dimension         INTEGER NOT NULL,
  enabled           BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Graph Nodes Table (knowledge graph)
CREATE TABLE IF NOT EXISTS graph_nodes (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id         UUID NOT NULL,
  label             VARCHAR(255) NOT NULL,
  node_type         VARCHAR(100) NOT NULL,
  properties        JSONB DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Graph Edges Table (knowledge graph relationships)
CREATE TABLE IF NOT EXISTS graph_edges (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id         UUID NOT NULL,
  source_node_id    UUID NOT NULL,
  target_node_id    UUID NOT NULL,
  relationship      VARCHAR(100) NOT NULL,
  properties        JSONB DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (source_node_id) REFERENCES graph_nodes(id) ON DELETE CASCADE,
  FOREIGN KEY (target_node_id) REFERENCES graph_nodes(id) ON DELETE CASCADE
);

-- Vector Embeddings Table (local embedding storage)
CREATE TABLE IF NOT EXISTS vector_embeddings (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  doc_id            UUID NOT NULL,
  chunk_id          UUID,
  embedding         vector(1536),
  model_name        VARCHAR(100) NOT NULL,
  dimension         INTEGER NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (doc_id) REFERENCES knowledge_docs(id) ON DELETE CASCADE
);

-- Document Versions Table (versioning history)
CREATE TABLE IF NOT EXISTS doc_versions (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  doc_id            UUID NOT NULL,
  version_number    INTEGER NOT NULL,
  content           TEXT NOT NULL,
  change_summary    TEXT,
  created_by        VARCHAR(100) NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (doc_id) REFERENCES knowledge_docs(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX idx_knowledge_spaces_tenant ON knowledge_spaces(tenant_id);

CREATE INDEX idx_knowledge_docs_space ON knowledge_docs(space_id);
CREATE INDEX idx_knowledge_docs_tenant ON knowledge_docs(tenant_id);
CREATE INDEX idx_knowledge_docs_status ON knowledge_docs(status);
CREATE INDEX idx_knowledge_docs_tags ON knowledge_docs USING GIN(tags);

CREATE INDEX idx_document_chunks_doc ON document_chunks(doc_id);
CREATE INDEX idx_document_chunks_embedding ON document_chunks USING ivfflat(embedding vector_cosine_ops) WITH (lists = 100);

CREATE INDEX idx_vector_embeddings_doc ON vector_embeddings(doc_id);
CREATE INDEX idx_vector_embeddings_chunk ON vector_embeddings(chunk_id);
CREATE INDEX idx_vector_embeddings_embedding ON vector_embeddings USING ivfflat(embedding vector_cosine_ops) WITH (lists = 100);

CREATE INDEX idx_doc_versions_doc ON doc_versions(doc_id);
CREATE INDEX idx_doc_versions_number ON doc_versions(doc_id, version_number);

CREATE INDEX idx_vector_stores_tenant ON vector_stores(tenant_id);
CREATE INDEX idx_vector_stores_provider ON vector_stores(provider);

CREATE INDEX idx_graph_nodes_tenant ON graph_nodes(tenant_id);
CREATE INDEX idx_graph_nodes_type ON graph_nodes(node_type);
CREATE INDEX idx_graph_nodes_label ON graph_nodes(label);

CREATE INDEX idx_graph_edges_tenant ON graph_edges(tenant_id);
CREATE INDEX idx_graph_edges_source ON graph_edges(source_node_id);
CREATE INDEX idx_graph_edges_target ON graph_edges(target_node_id);
CREATE INDEX idx_graph_edges_relationship ON graph_edges(relationship);

-- Rollback:
-- DROP TABLE IF EXISTS doc_versions, vector_embeddings, graph_edges, graph_nodes, vector_stores, document_chunks, knowledge_docs, knowledge_spaces;
