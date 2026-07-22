-- Branch Policies Persistence Migration
-- Sub-project F: Data Persistence - Task 1
-- Date: 2026-04-30

CREATE TABLE IF NOT EXISTS branch_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repo_id VARCHAR(255) NOT NULL,
  branch_pattern VARCHAR(255) NOT NULL,
  prevent_force_push BOOLEAN DEFAULT false,
  prevent_deletion BOOLEAN DEFAULT true,
  merge_strategy VARCHAR(50) DEFAULT 'merge',
  require_code_owners BOOLEAN DEFAULT false,
  required_checks JSONB DEFAULT '[]',
  linear_history BOOLEAN DEFAULT false,
  allow_admin_override BOOLEAN DEFAULT false,
  approval_rules JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_branch_policies_repo ON branch_policies(repo_id);
CREATE INDEX IF NOT EXISTS idx_branch_policies_pattern ON branch_policies(branch_pattern);
