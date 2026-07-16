-- Migration 001: AI Service Core Tables
-- Foundation tables for AI service including model versions, embeddings, traces, and decisions

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- AI Model Versions
CREATE TABLE IF NOT EXISTS ai_model_versions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL,
  name                  VARCHAR(100) NOT NULL,
  version               VARCHAR(50) NOT NULL,
  status                VARCHAR(20) NOT NULL DEFAULT 'active',
  framework             VARCHAR(50) NOT NULL,
  description           TEXT,
  metadata              JSONB,
  training_date         TIMESTAMPTZ,
  training_data_size    BIGINT,
  hyperparameters       JSONB,
  metrics               JSONB DEFAULT '{}',
  registered_by         VARCHAR(100),
  activated_at          TIMESTAMPTZ,
  deprecated_at         TIMESTAMPTZ,
  tags                  TEXT[],
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, name, version)
);
CREATE INDEX idx_ai_model_versions_tenant ON ai_model_versions(tenant_id);
CREATE INDEX idx_ai_model_versions_name ON ai_model_versions(name);
CREATE INDEX idx_ai_model_versions_status ON ai_model_versions(status);

-- Code Embeddings
CREATE TABLE IF NOT EXISTS code_embeddings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL,
  project_id      VARCHAR(100) NOT NULL,
  file_path       TEXT NOT NULL,
  chunk_type      VARCHAR(50) NOT NULL,
  chunk_name      VARCHAR(255) NOT NULL,
  content         TEXT NOT NULL,
  embedding       vector(1536),
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_code_embeddings_tenant ON code_embeddings(tenant_id);
CREATE INDEX idx_code_embeddings_project ON code_embeddings(project_id);
CREATE INDEX idx_code_embeddings_file ON code_embeddings(file_path);

-- Knowledge Embeddings
CREATE TABLE IF NOT EXISTS knowledge_embeddings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL,
  doc_id      VARCHAR(100) NOT NULL,
  doc_type    VARCHAR(50) NOT NULL,
  title       VARCHAR(500) NOT NULL,
  content     TEXT NOT NULL,
  embedding   vector(1536),
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_knowledge_embeddings_tenant ON knowledge_embeddings(tenant_id);
CREATE INDEX idx_knowledge_embeddings_doc ON knowledge_embeddings(doc_id);

-- Vector Collections
CREATE TABLE IF NOT EXISTS vector_collections (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL,
  name              VARCHAR(100) NOT NULL,
  description       TEXT,
  dimension         INTEGER NOT NULL,
  metric            VARCHAR(20) NOT NULL DEFAULT 'cosine',
  embedding_model   VARCHAR(100),
  metadata          JSONB DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, name)
);
CREATE INDEX idx_vector_collections_tenant ON vector_collections(tenant_id);

-- LLM Traces
CREATE TABLE IF NOT EXISTS llm_traces (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL,
  trace_id        VARCHAR(100) NOT NULL,
  request_id      VARCHAR(100) NOT NULL,
  model           VARCHAR(100) NOT NULL,
  provider        VARCHAR(50) NOT NULL,
  input_tokens    INTEGER NOT NULL DEFAULT 0,
  output_tokens   INTEGER NOT NULL DEFAULT 0,
  total_tokens    INTEGER NOT NULL DEFAULT 0,
  latency_ms      INTEGER NOT NULL DEFAULT 0,
  cost            DECIMAL(10, 6) NOT NULL DEFAULT 0,
  currency        VARCHAR(10) NOT NULL DEFAULT 'USD',
  status          VARCHAR(20) NOT NULL DEFAULT 'success',
  error_message   TEXT,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_llm_traces_tenant ON llm_traces(tenant_id);
CREATE INDEX idx_llm_traces_trace ON llm_traces(trace_id);
CREATE INDEX idx_llm_traces_created ON llm_traces(created_at);

-- AI Decisions
CREATE TABLE IF NOT EXISTS ai_decisions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL,
  decision_id     VARCHAR(100) NOT NULL,
  scenario        VARCHAR(100) NOT NULL,
  input           JSONB NOT NULL,
  output          JSONB NOT NULL,
  confidence      DECIMAL(5, 4) NOT NULL DEFAULT 0,
  reasoning       TEXT,
  model_version   VARCHAR(100),
  latency_ms      INTEGER NOT NULL DEFAULT 0,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ai_decisions_tenant ON ai_decisions(tenant_id);
CREATE INDEX idx_ai_decisions_decision ON ai_decisions(decision_id);
CREATE INDEX idx_ai_decisions_scenario ON ai_decisions(scenario);

-- AI Audit Logs
CREATE TABLE IF NOT EXISTS ai_audit_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL,
  user_id         VARCHAR(100) NOT NULL,
  action          VARCHAR(100) NOT NULL,
  resource_type   VARCHAR(50) NOT NULL,
  resource_id     VARCHAR(100) NOT NULL,
  request_body    JSONB,
  response_status INTEGER,
  ip_address      INET,
  user_agent      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ai_audit_logs_tenant ON ai_audit_logs(tenant_id);
CREATE INDEX idx_ai_audit_logs_user ON ai_audit_logs(user_id);
CREATE INDEX idx_ai_audit_logs_created ON ai_audit_logs(created_at);

-- A/B Tests
CREATE TABLE IF NOT EXISTS ai_ab_tests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL,
  model_name      VARCHAR(100) NOT NULL,
  variants        JSONB NOT NULL,
  traffic_split   JSONB NOT NULL,
  start_date      TIMESTAMPTZ NOT NULL,
  end_date        TIMESTAMPTZ,
  target_metrics  TEXT[] NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'draft',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ai_ab_tests_tenant ON ai_ab_tests(tenant_id);
CREATE INDEX idx_ai_ab_tests_status ON ai_ab_tests(status);

-- Circuit Breaker States
CREATE TABLE IF NOT EXISTS circuit_breaker_states (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider          VARCHAR(50) NOT NULL,
  model             VARCHAR(100) NOT NULL,
  state             VARCHAR(20) NOT NULL DEFAULT 'closed',
  failure_count     INTEGER NOT NULL DEFAULT 0,
  success_count     INTEGER NOT NULL DEFAULT 0,
  last_failure_time TIMESTAMPTZ,
  last_success_time TIMESTAMPTZ,
  next_attempt_time TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(provider, model)
);
CREATE INDEX idx_circuit_breaker_states_state ON circuit_breaker_states(state);

-- Rollback:
-- DROP TABLE IF EXISTS circuit_breaker_states, ai_ab_tests, ai_audit_logs, ai_decisions, llm_traces, vector_collections, knowledge_embeddings, code_embeddings, ai_model_versions;