-- Migration 0296: Immutable Audit Entries persistence
-- Stores audit entries in PostgreSQL with chain hash verification

CREATE TABLE IF NOT EXISTS immutable_audit_entries (
  id VARCHAR(100) PRIMARY KEY,
  tenant_id VARCHAR(100),
  sequence_number INTEGER NOT NULL,
  action VARCHAR(200) NOT NULL,
  user_id VARCHAR(100) NOT NULL,
  timestamp TIMESTAMP NOT NULL,
  prev_hash VARCHAR(128) NOT NULL,
  content_hash VARCHAR(128) NOT NULL,
  chain_hash VARCHAR(128) NOT NULL,
  details JSONB DEFAULT '{}',
  signature VARCHAR(256),
  file_source VARCHAR(500),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS immutable_audit_files (
  id VARCHAR(100) PRIMARY KEY,
  file_path VARCHAR(500) NOT NULL UNIQUE,
  entry_count INTEGER DEFAULT 0,
  last_sequence_number INTEGER DEFAULT 0,
  last_chain_hash VARCHAR(128),
  file_hash VARCHAR(128),
  is_read_only BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_immutable_audit_seq ON immutable_audit_entries(sequence_number);
CREATE INDEX IF NOT EXISTS idx_immutable_audit_tenant ON immutable_audit_entries(tenant_id);
CREATE INDEX IF NOT EXISTS idx_immutable_audit_user ON immutable_audit_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_immutable_audit_chain ON immutable_audit_entries(chain_hash);
CREATE INDEX IF NOT EXISTS idx_immutable_audit_files_path ON immutable_audit_files(file_path);
