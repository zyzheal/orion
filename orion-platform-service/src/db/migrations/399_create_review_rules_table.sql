-- Review Rules Table
-- Migration 399
-- Stores custom review rules for the ReviewRuleEngine

CREATE TABLE IF NOT EXISTS review_rules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('security', 'performance', 'style', 'best-practice')),
  severity TEXT NOT NULL CHECK (severity IN ('critical', 'warning', 'info', 'suggestion')),
  pattern TEXT NOT NULL,
  description TEXT NOT NULL,
  suggestion TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  file_extensions TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_review_rules_category ON review_rules(category);
CREATE INDEX IF NOT EXISTS idx_review_rules_severity ON review_rules(severity);
CREATE INDEX IF NOT EXISTS idx_review_rules_enabled ON review_rules(enabled);
CREATE INDEX IF NOT EXISTS idx_review_rules_created_at ON review_rules(created_at DESC);
