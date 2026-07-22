-- 088: Developer Portal
-- 新增开发者门户文档表

-- portal_documents 表（开发者门户文档）
CREATE TABLE IF NOT EXISTS portal_documents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title           VARCHAR(500) NOT NULL,
  slug            VARCHAR(200) NOT NULL,
  content         TEXT NOT NULL,
  content_format  VARCHAR(20) NOT NULL DEFAULT 'markdown',  -- markdown, html, plain
  document_type   VARCHAR(30) NOT NULL DEFAULT 'guide',  -- guide, api-doc, tutorial, faq, changelog, policy
  category        VARCHAR(100),
  tags            TEXT[] NOT NULL DEFAULT '{}',
  version         VARCHAR(20) NOT NULL DEFAULT '1.0.0',
  is_published    BOOLEAN NOT NULL DEFAULT false,
  published_at    TIMESTAMPTZ,
  author_id       VARCHAR(100) NOT NULL,
  editor_id       VARCHAR(100),
  view_count      INT NOT NULL DEFAULT 0,
  helpful_count   INT NOT NULL DEFAULT 0,
  not_helpful_count INT NOT NULL DEFAULT 0,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_portal_documents_tenant ON portal_documents(tenant_id);
CREATE INDEX idx_portal_documents_slug ON portal_documents(tenant_id, slug);
CREATE INDEX idx_portal_documents_type ON portal_documents(document_type);
CREATE INDEX idx_portal_documents_category ON portal_documents(category);
CREATE INDEX idx_portal_documents_published ON portal_documents(is_published) WHERE is_published = true;
CREATE INDEX idx_portal_documents_tags ON portal_documents USING gin(tags);
CREATE INDEX idx_portal_documents_created ON portal_documents(created_at DESC);

-- ============================================================
-- Row Level Security (RLS) Policies
-- ============================================================

-- portal_documents
ALTER TABLE portal_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal_documents FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_portal_documents ON portal_documents
    USING (
        current_setting('app.current_tenant_id', true) IS NOT NULL
        AND current_setting('app.current_tenant_id', true) != ''
        AND tenant_id::text = current_setting('app.current_tenant_id')
    );

CREATE INDEX IF NOT EXISTS idx_portal_documents_tenant_rls ON portal_documents(tenant_id);

COMMENT ON POLICY tenant_isolation_portal_documents ON portal_documents IS
    'Tenant isolation RLS policy - portal documents visible only to owning tenant';
