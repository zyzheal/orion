CREATE TABLE IF NOT EXISTS code_owners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repo_id VARCHAR(255) NOT NULL UNIQUE,
  file_path VARCHAR(500) NOT NULL,
  rules JSONB NOT NULL DEFAULT '[]',
  raw_content TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_code_owners_repo ON code_owners(repo_id);
