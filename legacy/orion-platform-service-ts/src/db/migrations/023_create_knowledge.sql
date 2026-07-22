-- Migration 023: Knowledge Base
-- Knowledge base articles and categories

CREATE TABLE IF NOT EXISTS knowledge_categories (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name          VARCHAR(200) NOT NULL,
  description   TEXT,
  parent_id     UUID REFERENCES knowledge_categories(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_kb_categories_tenant ON knowledge_categories(tenant_id);

-- Knowledge articles
CREATE TABLE IF NOT EXISTS knowledge_articles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  category_id   UUID REFERENCES knowledge_categories(id) ON DELETE SET NULL,
  title         VARCHAR(500) NOT NULL,
  content       TEXT NOT NULL,
  content_type  VARCHAR(50) NOT NULL DEFAULT 'markdown',
  tags          TEXT[] DEFAULT '{}',
  status        VARCHAR(20) NOT NULL DEFAULT 'draft',
  author_id     UUID REFERENCES users(id),
  published_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_kb_articles_tenant ON knowledge_articles(tenant_id);
CREATE INDEX idx_kb_articles_status ON knowledge_articles(status);
CREATE INDEX idx_kb_articles_category ON knowledge_articles(category_id);

-- Rollback:
-- DROP TABLE IF EXISTS knowledge_articles, knowledge_categories;
