-- Migration 288: Tenant Privacy Policies Persistence
-- Migrates tenant privacy policies from in-memory Map to PostgreSQL

CREATE TABLE IF NOT EXISTS tenant_privacy_policies (
  tenant_id INTEGER PRIMARY KEY,
  policy_level VARCHAR(20) NOT NULL DEFAULT 'standard' CHECK (policy_level IN ('standard', 'enhanced', 'strict', 'custom')),
  secret_sanitization_enabled BOOLEAN NOT NULL DEFAULT true,
  pii_sanitization_enabled BOOLEAN NOT NULL DEFAULT true,
  ner_model_type VARCHAR(30) NOT NULL DEFAULT 'bert-local' CHECK (ner_model_type IN ('bert-local', 'bert-remote', 'regex-only')),
  local_model_required BOOLEAN NOT NULL DEFAULT false,
  sensitive_data_types JSONB NOT NULL DEFAULT '["api_key", "password", "token", "secret"]',
  pii_types JSONB NOT NULL DEFAULT '["email", "phone", "name", "id_card", "address"]',
  custom_patterns JSONB NOT NULL DEFAULT '[]',
  audit_logging_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenant_privacy_policies_level ON tenant_privacy_policies(policy_level);
