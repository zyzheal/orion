-- Migration 235: Knowledge Base Pattern Persistence
-- Stores incident patterns in PostgreSQL instead of in-memory Map()

CREATE TABLE IF NOT EXISTS knowledge_base_patterns (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(64) NOT NULL,
  symptoms JSONB NOT NULL DEFAULT '[]',
  root_causes JSONB NOT NULL DEFAULT '[]',
  indicators JSONB NOT NULL DEFAULT '[]',
  remediation_steps JSONB NOT NULL DEFAULT '[]',
  success_rate NUMERIC(5,4) NOT NULL DEFAULT 0.5,
  avg_recovery_time NUMERIC(10,2) NOT NULL DEFAULT 300,
  risk_level VARCHAR(32) NOT NULL DEFAULT 'medium',
  affected_components JSONB NOT NULL DEFAULT '[]',
  related_patterns JSONB,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kb_patterns_category ON knowledge_base_patterns(category);
CREATE INDEX IF NOT EXISTS idx_kb_patterns_risk_level ON knowledge_base_patterns(risk_level);
CREATE INDEX IF NOT EXISTS idx_kb_patterns_tenant_id ON knowledge_base_patterns(tenant_id);
