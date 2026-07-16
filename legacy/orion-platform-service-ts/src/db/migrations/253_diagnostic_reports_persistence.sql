-- Migration 253: Diagnostic Reports Persistence
-- Stores diagnostic reports in PostgreSQL instead of in-memory Map()
-- in DiagnosticAgentService.reports

CREATE TABLE IF NOT EXISTS diagnostic_reports (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  session_id VARCHAR(64) NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  findings JSONB NOT NULL DEFAULT '[]',
  root_cause JSONB,
  recommendations JSONB NOT NULL DEFAULT '[]',
  timeline JSONB NOT NULL DEFAULT '[]',
  estimated_fix_time_ms INTEGER,
  generated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_diagnostic_reports_session_id ON diagnostic_reports(session_id);
CREATE INDEX IF NOT EXISTS idx_diagnostic_reports_tenant_id ON diagnostic_reports(tenant_id);
CREATE INDEX IF NOT EXISTS idx_diagnostic_reports_generated_at ON diagnostic_reports(generated_at DESC);
