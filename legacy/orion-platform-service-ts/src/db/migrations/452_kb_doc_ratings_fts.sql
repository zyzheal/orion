-- Migration 452: Knowledge Document Ratings + FTS
-- Adds document rating system and full-text search support

-- Document ratings table
CREATE TABLE IF NOT EXISTS kb_doc_ratings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_id        UUID NOT NULL REFERENCES kb_docs(id) ON DELETE CASCADE,
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating        INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment       TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(doc_id, user_id)
);
CREATE INDEX idx_kb_doc_ratings_doc ON kb_doc_ratings(doc_id);
CREATE INDEX idx_kb_doc_ratings_tenant ON kb_doc_ratings(tenant_id);
CREATE INDEX idx_kb_doc_ratings_user ON kb_doc_ratings(user_id);

-- Full-text search trigger function for kb_docs
-- Uses PostgreSQL tsvector on title, content, and tags
CREATE OR REPLACE FUNCTION kb_docs_fts_trigger() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.content, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(array_to_string(NEW.tags, ' '), '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add search_vector column to kb_docs
ALTER TABLE kb_docs ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Create GIN index for FTS
CREATE INDEX IF NOT EXISTS idx_kb_docs_search_vector ON kb_docs USING GIN(search_vector);

-- Create trigger to auto-update search_vector on INSERT/UPDATE
DROP TRIGGER IF EXISTS tsvectorupdate_kb_docs ON kb_docs;
CREATE TRIGGER tsvectorupdate_kb_docs
  BEFORE INSERT OR UPDATE OF title, content, tags
  ON kb_docs
  FOR EACH ROW EXECUTE FUNCTION kb_docs_fts_trigger();

-- Backfill existing rows
UPDATE kb_docs
SET search_vector =
  setweight(to_tsvector('english', COALESCE(title, '')), 'A') ||
  setweight(to_tsvector('english', COALESCE(content, '')), 'B') ||
  setweight(to_tsvector('english', COALESCE(array_to_string(tags, ' '), '')), 'C')
WHERE search_vector IS NULL;

-- Rollback:
-- DROP TRIGGER IF EXISTS tsvectorupdate_kb_docs ON kb_docs;
-- DROP FUNCTION IF EXISTS kb_docs_fts_trigger();
-- DROP INDEX IF EXISTS idx_kb_docs_search_vector;
-- ALTER TABLE kb_docs DROP COLUMN IF EXISTS search_vector;
-- DROP TABLE IF EXISTS kb_doc_ratings;
