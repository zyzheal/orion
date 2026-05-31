-- Migration 0295: Audit Chain Entries persistence
-- Stores chained audit log entries with hash verification for tamper detection

CREATE TABLE IF NOT EXISTS audit_chain_entries (
  id VARCHAR(100) PRIMARY KEY,
  tenant_id VARCHAR(100),
  sequence_number INTEGER NOT NULL UNIQUE,
  action VARCHAR(200) NOT NULL,
  user_id VARCHAR(100) NOT NULL,
  timestamp TIMESTAMP NOT NULL,
  prev_hash VARCHAR(128) NOT NULL,
  content_hash VARCHAR(128) NOT NULL,
  chain_hash VARCHAR(128) NOT NULL,
  details JSONB DEFAULT '{}',
  signature VARCHAR(256),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_chain_seq ON audit_chain_entries(sequence_number);
CREATE INDEX IF NOT EXISTS idx_audit_chain_tenant ON audit_chain_entries(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_chain_user ON audit_chain_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_chain_action ON audit_chain_entries(action);
CREATE INDEX IF NOT EXISTS idx_audit_chain_timestamp ON audit_chain_entries(timestamp);
