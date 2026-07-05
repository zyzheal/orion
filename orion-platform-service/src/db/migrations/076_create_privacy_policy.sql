-- Migration 076: Tenant Privacy Policy Tables
-- Manages tenant-level privacy policies for LLM data sanitization and audit logging

-- Tenant privacy policy configuration table
CREATE TABLE IF NOT EXISTS tenant_privacy_policies (
    id SERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000' UNIQUE,
    policy_level VARCHAR(16) NOT NULL DEFAULT 'standard',
    secret_sanitization_enabled BOOLEAN DEFAULT true,
    pii_sanitization_enabled BOOLEAN DEFAULT true,
    ner_model_type VARCHAR(32) DEFAULT 'bert-local',
    local_model_required BOOLEAN DEFAULT false,
    sensitive_data_types JSONB DEFAULT '["api_key","password","token","secret"]',
    pii_types JSONB DEFAULT '["email","phone","name","id_card","address"]',
    custom_patterns JSONB DEFAULT '[]',
    audit_logging_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_tenant_privacy_policy_tenant ON tenant_privacy_policies(tenant_id);
CREATE INDEX idx_tenant_privacy_policy_level ON tenant_privacy_policies(policy_level);

-- Sanitization audit log table
CREATE TABLE IF NOT EXISTS sanitization_audit_logs (
    id SERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
    sanitization_type VARCHAR(16) NOT NULL,
    original_content_hash VARCHAR(128),
    sanitized_content_hash VARCHAR(128),
    detected_types JSONB DEFAULT '[]',
    detection_count INTEGER DEFAULT 0,
    ner_accuracy_score DECIMAL(5,4),
    processing_time_ms INTEGER,
    llm_request_id VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_sanitization_audit_tenant ON sanitization_audit_logs(tenant_id);
CREATE INDEX idx_sanitization_audit_created ON sanitization_audit_logs(created_at);
CREATE INDEX idx_sanitization_audit_type ON sanitization_audit_logs(sanitization_type);
CREATE INDEX idx_sanitization_audit_llm_request ON sanitization_audit_logs(llm_request_id);

COMMENT ON TABLE tenant_privacy_policies IS 'Tenant privacy policy configuration for LLM data sanitization';
COMMENT ON COLUMN tenant_privacy_policies.tenant_id IS 'Reference to tenant (unique, one policy per tenant)';
COMMENT ON COLUMN tenant_privacy_policies.policy_level IS 'Policy level: standard, enhanced, strict, custom';
COMMENT ON COLUMN tenant_privacy_policies.secret_sanitization_enabled IS 'Whether to sanitize secrets (API keys, passwords, tokens)';
COMMENT ON COLUMN tenant_privacy_policies.pii_sanitization_enabled IS 'Whether to sanitize PII (email, phone, name, ID card)';
COMMENT ON COLUMN tenant_privacy_policies.ner_model_type IS 'NER model type: bert-local, bert-remote, regex-only';
COMMENT ON COLUMN tenant_privacy_policies.local_model_required IS 'Require local model for PII detection (no external API calls)';
COMMENT ON COLUMN tenant_privacy_policies.sensitive_data_types IS 'Array of sensitive data types to detect and sanitize';
COMMENT ON COLUMN tenant_privacy_policies.pii_types IS 'Array of PII types to detect and sanitize';
COMMENT ON COLUMN tenant_privacy_policies.custom_patterns IS 'Custom regex patterns for tenant-specific sensitive data';
COMMENT ON COLUMN tenant_privacy_policies.audit_logging_enabled IS 'Whether to log all sanitization operations';

COMMENT ON TABLE sanitization_audit_logs IS 'Audit log for data sanitization operations';
COMMENT ON COLUMN sanitization_audit_logs.sanitization_type IS 'Type: secret, pii, combined';
COMMENT ON COLUMN sanitization_audit_logs.original_content_hash IS 'SHA-256 hash of original content (content not stored)';
COMMENT ON COLUMN sanitization_audit_logs.sanitized_content_hash IS 'SHA-256 hash of sanitized content';
COMMENT ON COLUMN sanitization_audit_logs.detected_types IS 'Array of detected sensitive data types';
COMMENT ON COLUMN sanitization_audit_logs.detection_count IS 'Total number of sensitive items detected';
COMMENT ON COLUMN sanitization_audit_logs.ner_accuracy_score IS 'NER model confidence score (0-1)';
COMMENT ON COLUMN sanitization_audit_logs.processing_time_ms IS 'Processing time in milliseconds';
COMMENT ON COLUMN sanitization_audit_logs.llm_request_id IS 'Associated LLM request ID for traceability';

-- Policy level definitions:
-- 'standard': Standard protection (Secret sanitization + basic PII regex)
-- 'enhanced': Enhanced protection (Secret + NER-based PII detection)
-- 'strict': Strict protection (mandatory local model + full sanitization)
-- 'custom': Custom policy with tenant-specific configuration

-- Rollback:
-- DROP TABLE IF EXISTS sanitization_audit_logs;
-- DROP TABLE IF EXISTS tenant_privacy_policies;