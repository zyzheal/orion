-- Migration 252: Diagnostic Outcomes Persistence
-- Stores diagnostic outcomes in PostgreSQL instead of in-memory Map()
-- in DiagnosticKnowledgeBase.outcomes

CREATE TABLE IF NOT EXISTS diagnostic_outcomes (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL DEFAULT 'default',
  session_id VARCHAR(64) NOT NULL,
  pattern_id VARCHAR(64) NOT NULL,
  confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  actual_root_cause TEXT,
  fix_time_ms INTEGER,
  recorded_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_diagnostic_outcomes_session_id ON diagnostic_outcomes(session_id);
CREATE INDEX IF NOT EXISTS idx_diagnostic_outcomes_pattern_id ON diagnostic_outcomes(pattern_id);
CREATE INDEX IF NOT EXISTS idx_diagnostic_outcomes_tenant_id ON diagnostic_outcomes(tenant_id);
