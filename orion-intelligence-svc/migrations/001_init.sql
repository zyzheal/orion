-- Migration 001: AI Intelligence Service Core Tables
-- Creates all core tables for AI classification, code review, root cause analysis, SLA prediction,
-- sentiment analysis, solution suggestions, and usage tracking
-- Version: 1.0.0

-- ==================== AI Classification Records ====================
CREATE TABLE IF NOT EXISTS ai_classifications (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id         VARCHAR(255) NOT NULL,
  category          VARCHAR(50) NOT NULL,
  subcategory       VARCHAR(100),
  confidence        DECIMAL(5, 4) NOT NULL,
  reasoning         TEXT,
  processing_time_ms DECIMAL(10, 2),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_classifications_ticket ON ai_classifications(ticket_id);
CREATE INDEX idx_ai_classifications_category ON ai_classifications(category);
CREATE INDEX idx_ai_classifications_confidence ON ai_classifications(confidence);
CREATE INDEX idx_ai_classifications_created ON ai_classifications(created_at);

-- ==================== AI Code Reviews ====================
CREATE TABLE IF NOT EXISTS ai_code_reviews (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pr_id             VARCHAR(255),
  repository        VARCHAR(255) NOT NULL,
  language          VARCHAR(50),
  summary           TEXT,
  comments          JSONB NOT NULL DEFAULT '[]',
  quality_score     DECIMAL(3, 2),
  processing_time_ms DECIMAL(10, 2),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_code_reviews_pr ON ai_code_reviews(pr_id);
CREATE INDEX idx_ai_code_reviews_repository ON ai_code_reviews(repository);
CREATE INDEX idx_ai_code_reviews_created ON ai_code_reviews(created_at);

-- ==================== AI Root Cause Analyses ====================
CREATE TABLE IF NOT EXISTS ai_root_cause_analyses (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id       VARCHAR(255) NOT NULL,
  root_cause        TEXT,
  contributing_factors JSONB DEFAULT '[]',
  impact_scope      VARCHAR(100),
  recommended_actions  JSONB DEFAULT '[]',
  confidence        DECIMAL(5, 4),
  processing_time_ms DECIMAL(10, 2),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_root_cause_incident ON ai_root_cause_analyses(incident_id);
CREATE INDEX idx_ai_root_cause_confidence ON ai_root_cause_analyses(confidence);
CREATE INDEX idx_ai_root_cause_created ON ai_root_cause_analyses(created_at);

-- ==================== AI Solution Suggestions ====================
CREATE TABLE IF NOT EXISTS ai_solution_suggestions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id         VARCHAR(255),
  problem           TEXT NOT NULL,
  recommended_solutions JSONB NOT NULL DEFAULT '[]',
  primary_recommendation TEXT,
  processing_time_ms DECIMAL(10, 2),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_solution_suggestions_ticket ON ai_solution_suggestions(ticket_id);
CREATE INDEX idx_ai_solution_suggestions_created ON ai_solution_suggestions(created_at);

-- ==================== AI Ticket Summaries ====================
CREATE TABLE IF NOT EXISTS ai_ticket_summaries (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id         VARCHAR(255) NOT NULL,
  title             VARCHAR(500),
  summary           TEXT,
  key_points        JSONB DEFAULT '[]',
  action_items      JSONB DEFAULT '[]',
  affected_services JSONB DEFAULT '[]',
  processing_time_ms DECIMAL(10, 2),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_ticket_summaries_ticket ON ai_ticket_summaries(ticket_id);
CREATE INDEX idx_ai_ticket_summaries_created ON ai_ticket_summaries(created_at);

-- ==================== AI Sentiment Analyses ====================
CREATE TABLE IF NOT EXISTS ai_sentiment_analyses (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id         VARCHAR(255),
  overall_sentiment VARCHAR(20) NOT NULL,
  confidence        DECIMAL(5, 4),
  emotions          JSONB DEFAULT '[]',
  urgency_level     VARCHAR(20),
  processing_time_ms DECIMAL(10, 2),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_sentiment_ticket ON ai_sentiment_analyses(ticket_id);
CREATE INDEX idx_ai_sentiment_sentiment ON ai_sentiment_analyses(overall_sentiment);
CREATE INDEX idx_ai_sentiment_created ON ai_sentiment_analyses(created_at);

-- ==================== AI SLA Predictions ====================
CREATE TABLE IF NOT EXISTS ai_sla_predictions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id         VARCHAR(255) NOT NULL,
  breach_probability INTEGER NOT NULL CHECK (breach_probability >= 0 AND breach_probability <= 100),
  risk_factors      JSONB DEFAULT '[]',
  recommended_actions JSONB DEFAULT '[]',
  time_remaining_minutes INTEGER,
  processing_time_ms DECIMAL(10, 2),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_sla_predictions_ticket ON ai_sla_predictions(ticket_id);
CREATE INDEX idx_ai_sla_predictions_probability ON ai_sla_predictions(breach_probability);
CREATE INDEX idx_ai_sla_predictions_created ON ai_sla_predictions(created_at);

-- ==================== LLM Usage Tracking ====================
CREATE TABLE IF NOT EXISTS llm_usage_log (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation         VARCHAR(50) NOT NULL,
  prompt_tokens     INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens      INTEGER NOT NULL DEFAULT 0,
  cost_usd          DECIMAL(10, 6),
  model             VARCHAR(100),
  tenant_id         UUID,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_llm_usage_log_operation ON llm_usage_log(operation);
CREATE INDEX idx_llm_usage_log_tenant ON llm_usage_log(tenant_id);
CREATE INDEX idx_llm_usage_log_created ON llm_usage_log(created_at);

-- ==================== Knowledge Base RAG Cache ====================
CREATE TABLE IF NOT EXISTS rag_knowledge_hits (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query_text        TEXT NOT NULL,
  doc_id            VARCHAR(255) NOT NULL,
  title             VARCHAR(500) NOT NULL,
  snippet           TEXT,
  relevance_score   DECIMAL(5, 4) NOT NULL,
  source            VARCHAR(1000),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_rag_knowledge_hits_query ON rag_knowledge_hits(query_text);
CREATE INDEX idx_rag_knowledge_hits_doc ON rag_knowledge_hits(doc_id);
CREATE INDEX idx_rag_knowledge_hits_score ON rag_knowledge_hits(relevance_score);

-- ==================== AI Service Config ====================
CREATE TABLE IF NOT EXISTS ai_service_config (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key        VARCHAR(255) NOT NULL UNIQUE,
  config_value      JSONB NOT NULL,
  description       TEXT,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==================== Migration Info ====================
CREATE TABLE IF NOT EXISTS intelligence_schema_migrations (
  version             VARCHAR(20) PRIMARY KEY,
  applied_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  description         TEXT
);

INSERT INTO intelligence_schema_migrations (version, description)
VALUES ('001', 'Initial AI intelligence service tables: classifications, code_reviews, root_cause_analyses, solutions, summaries, sentiment, sla_predictions, usage_log');
