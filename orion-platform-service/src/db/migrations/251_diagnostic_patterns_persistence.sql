-- Migration 251: Diagnostic Patterns Persistence
-- Stores diagnostic patterns in PostgreSQL instead of in-memory Map()
-- in DiagnosticKnowledgeBase.patterns

CREATE TABLE IF NOT EXISTS diagnostic_patterns (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL DEFAULT 'default',
  name VARCHAR(255) NOT NULL,
  symptoms JSONB NOT NULL DEFAULT '[]',
  root_cause TEXT NOT NULL DEFAULT '',
  solution TEXT NOT NULL DEFAULT '',
  frequency INTEGER NOT NULL DEFAULT 0,
  last_matched TIMESTAMP,
  category VARCHAR(64) NOT NULL DEFAULT 'infrastructure',
  average_confidence INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_diagnostic_patterns_tenant_id ON diagnostic_patterns(tenant_id);
CREATE INDEX IF NOT EXISTS idx_diagnostic_patterns_category ON diagnostic_patterns(category);
CREATE INDEX IF NOT EXISTS idx_diagnostic_patterns_frequency ON diagnostic_patterns(frequency DESC);
