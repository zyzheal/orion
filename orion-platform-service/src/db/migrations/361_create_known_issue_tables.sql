-- Migration 361: Known Issue Tables Persistence
-- Migrates KnownIssueService from in-memory Map storage to PostgreSQL persistence.

CREATE TABLE IF NOT EXISTS known_issues (
  id          UUID PRIMARY KEY,
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title       VARCHAR(500) NOT NULL,
  description TEXT,
  fingerprint VARCHAR(500) NOT NULL,
  label_selectors JSONB,
  ticket_id   VARCHAR(255),
  resolved    BOOLEAN NOT NULL DEFAULT false,
  resolved_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE known_issues IS 'Known issues tracked by the platform (bugs, limitations, workaround items)';
COMMENT ON COLUMN known_issues.id IS 'Unique issue identifier (UUID)';
COMMENT ON COLUMN known_issues.fingerprint IS 'Hash/signature used for deduplication and matching';
COMMENT ON COLUMN known_issues.label_selectors IS 'Key-value pairs for grouping issues (JSONB)';
COMMENT ON COLUMN known_issues.ticket_id IS 'Related ticket identifier';
COMMENT ON COLUMN known_issues.resolved IS 'Whether the known issue has been resolved';
COMMENT ON COLUMN known_issues.resolved_at IS 'Timestamp when the issue was marked resolved';

CREATE INDEX idx_known_issues_tenant ON known_issues(tenant_id);
CREATE INDEX idx_known_issues_fingerprint ON known_issues(fingerprint);
CREATE INDEX idx_known_issues_resolved ON known_issues(resolved);
CREATE INDEX idx_known_issues_created_at ON known_issues(created_at DESC);

-- RLS (Row Level Security)
ALTER TABLE known_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE known_issues FORCE ROW LEVEL SECURITY;

CREATE POLICY known_issues_tenant_isolation ON known_issues
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- Rollback:
-- DROP TABLE IF EXISTS known_issues;
