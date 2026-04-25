-- Migration 052: Knowledge Base Spaces & Docs (M28)
-- Supports the /api/v1/knowledge API for Space + Document CRUD + RAG

-- Knowledge spaces (logical grouping of documents)
CREATE TABLE IF NOT EXISTS kb_spaces (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name          VARCHAR(200) NOT NULL,
  type          VARCHAR(20) NOT NULL DEFAULT 'public' CHECK (type IN ('public', 'internal', 'private')),
  owner_id      UUID REFERENCES users(id) ON DELETE SET NULL,
  team_id       UUID,
  description   TEXT,
  doc_count     INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_kb_spaces_tenant ON kb_spaces(tenant_id);
CREATE INDEX idx_kb_spaces_owner ON kb_spaces(owner_id);

-- Knowledge documents within spaces
CREATE TABLE IF NOT EXISTS kb_docs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  space_id      UUID NOT NULL REFERENCES kb_spaces(id) ON DELETE CASCADE,
  title         VARCHAR(500) NOT NULL,
  content       TEXT NOT NULL,
  type          VARCHAR(50) NOT NULL DEFAULT 'doc',
  tags          TEXT[] DEFAULT '{}',
  status        VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  version       INT NOT NULL DEFAULT 1,
  author_id     UUID REFERENCES users(id),
  embedding     vector(1536),  -- OpenAI ada-002 compatible
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_kb_docs_tenant ON kb_docs(tenant_id);
CREATE INDEX idx_kb_docs_space ON kb_docs(space_id);
CREATE INDEX idx_kb_docs_status ON kb_docs(status);
CREATE INDEX idx_kb_docs_tags ON kb_docs USING GIN(tags);

-- Document version history
CREATE TABLE IF NOT EXISTS kb_doc_versions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_id        UUID NOT NULL REFERENCES kb_docs(id) ON DELETE CASCADE,
  version       INT NOT NULL,
  title         VARCHAR(500) NOT NULL,
  content       TEXT NOT NULL,
  tags          TEXT[] DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(doc_id, version)
);
CREATE INDEX idx_kb_doc_versions_doc ON kb_doc_versions(doc_id);

-- Rollback:
-- DROP TABLE IF EXISTS kb_doc_versions, kb_docs, kb_spaces;
