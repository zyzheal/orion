-- Migration 001: Risk Assessment Service Initial Tables
-- Creates tables for Risk Assessment, Risk Scores, and Risk Events

-- ==================== Risk Assessments Table ====================

CREATE TABLE IF NOT EXISTS risk_assessments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(255) NOT NULL,
  description     TEXT,
  entity_type     VARCHAR(100) NOT NULL,
  entity_id       VARCHAR(255) NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'draft',
  assessor_id     VARCHAR(255) NOT NULL,
  tenant_id       VARCHAR(255) NOT NULL,
  metadata        JSONB NOT NULL DEFAULT '{}',
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_assessments_entity ON risk_assessments(entity_type, entity_id);
CREATE INDEX idx_assessments_status ON risk_assessments(status);
CREATE INDEX idx_assessments_tenant ON risk_assessments(tenant_id);
CREATE INDEX idx_assessments_assessor ON risk_assessments(assessor_id);

-- ==================== Risk Scores Table ====================

CREATE TABLE IF NOT EXISTS risk_scores (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type     VARCHAR(100) NOT NULL,
  entity_id       VARCHAR(255) NOT NULL,
  total_score     INTEGER NOT NULL DEFAULT 0,
  dimension_scores JSONB NOT NULL DEFAULT '{}',
  risk_level      VARCHAR(20) NOT NULL DEFAULT 'low',
  comment         TEXT,
  assessed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at      TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_scores_entity ON risk_scores(entity_type, entity_id);
CREATE INDEX idx_scores_level ON risk_scores(risk_level);
CREATE INDEX idx_scores_expires ON risk_scores(expires_at);

-- ==================== Risk Events Table ====================

CREATE TABLE IF NOT EXISTS risk_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id   UUID NOT NULL REFERENCES risk_assessments(id) ON DELETE CASCADE,
  category        VARCHAR(30) NOT NULL,
  level           VARCHAR(20) NOT NULL,
  title           VARCHAR(255) NOT NULL,
  description     TEXT NOT NULL,
  impact          TEXT NOT NULL,
  impact_score    INTEGER NOT NULL DEFAULT 1,
  probability_score INTEGER NOT NULL DEFAULT 1,
  risk_value      INTEGER NOT NULL DEFAULT 1,
  recommendation  TEXT,
  assignee_id     VARCHAR(255),
  status          VARCHAR(20) NOT NULL DEFAULT 'identified',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_events_assessment ON risk_events(assessment_id);
CREATE INDEX idx_events_category ON risk_events(category);
CREATE INDEX idx_events_level ON risk_events(level);
CREATE INDEX idx_events_status ON risk_events(status);

-- ==================== Comments ====================

COMMENT ON TABLE risk_assessments IS 'Risk assessment records for various entities';
COMMENT ON TABLE risk_scores IS 'Computed risk scores for entities with expiration';
COMMENT ON TABLE risk_events IS 'Individual risk events associated with assessments';

-- ==================== Rollback ====================

-- DROP TABLE IF EXISTS risk_events, risk_scores, risk_assessments;