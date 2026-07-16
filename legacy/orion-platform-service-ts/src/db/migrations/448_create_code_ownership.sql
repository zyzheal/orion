-- ============================================================================
-- Task 4.21: Code Ownership PostgreSQL persistence
-- ============================================================================
--
-- Migrate CodeOwnershipService from in-memory Map to PostgreSQL.
-- Stores per-repo CODEOWNERS metadata: owner_user_id, owner_team_id,
-- file_path, review_required flag. Tenant-isolated via RLS.

CREATE TABLE IF NOT EXISTS code_ownership (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  tenant_id       TEXT NOT NULL,
  repo_path       TEXT NOT NULL,
  file_path       TEXT NOT NULL DEFAULT '.github/CODEOWNERS',
  owner_user_id   TEXT,
  owner_team_id   TEXT,
  review_required BOOLEAN NOT NULL DEFAULT false,
  last_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique constraint: one ownership record per (tenant, repo_path)
CREATE UNIQUE INDEX IF NOT EXISTS uq_code_ownership_tenant_repo
  ON code_ownership (tenant_id, repo_path);

-- RLS: tenant isolation
ALTER TABLE code_ownership ENABLE ROW LEVEL SECURITY;

CREATE POLICY code_ownership_tenant_isolation ON code_ownership
  USING (tenant_id = current_setting('app.current_tenant_id', TRUE));

-- Performance: lookups by repo_path
CREATE INDEX IF NOT EXISTS idx_code_ownership_repo_path
  ON code_ownership (repo_path);

-- Performance: lookups by file_path
CREATE INDEX IF NOT EXISTS idx_code_ownership_file_path
  ON code_ownership (file_path);

-- Performance: lookups by owner
CREATE INDEX IF NOT EXISTS idx_code_ownership_owner_user
  ON code_ownership (owner_user_id) WHERE owner_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_code_ownership_owner_team
  ON code_ownership (owner_team_id) WHERE owner_team_id IS NOT NULL;

-- Performance: tenant + time range queries
CREATE INDEX IF NOT EXISTS idx_code_ownership_tenant_updated
  ON code_ownership (tenant_id, last_updated_at DESC);

-- Rollback:
-- DROP TABLE IF EXISTS code_ownership CASCADE;
