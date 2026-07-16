-- Migration: 001_init.sql
-- API Governance Service Database Schema
-- Created: 2026-05-15

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- API Contracts table
CREATE TABLE IF NOT EXISTS api_contracts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    version VARCHAR(50) NOT NULL,
    description TEXT,
    schema JSONB DEFAULT '{}'::jsonb,
    status VARCHAR(50) DEFAULT 'draft',
    api_name VARCHAR(255),
    endpoint VARCHAR(500),
    method VARCHAR(20),
    authentication VARCHAR(50),
    rate_limit INTEGER,
    tags TEXT[] DEFAULT '{}',
    owner_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deprecated_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_api_contracts_status ON api_contracts(status);
CREATE INDEX IF NOT EXISTS idx_api_contracts_api_name ON api_contracts(api_name);
CREATE INDEX IF NOT EXISTS idx_api_contracts_owner_id ON api_contracts(owner_id);

-- API Versions table
CREATE TABLE IF NOT EXISTS api_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contract_id UUID REFERENCES api_contracts(id) ON DELETE CASCADE,
    version VARCHAR(50) NOT NULL,
    changelog TEXT,
    schema JSONB DEFAULT '{}'::jsonb,
    status VARCHAR(50) DEFAULT 'planned',
    breaking_changes BOOLEAN DEFAULT false,
    migration_guide TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_versions_contract_id ON api_versions(contract_id);
CREATE INDEX IF NOT EXISTS idx_api_versions_status ON api_versions(status);

-- API Deprecations table
CREATE TABLE IF NOT EXISTS api_deprecations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contract_id UUID REFERENCES api_contracts(id) ON DELETE CASCADE,
    version VARCHAR(50) NOT NULL,
    reason TEXT,
    replacement_version VARCHAR(50),
    deprecation_date TIMESTAMP WITH TIME ZONE,
    sunset_date TIMESTAMP WITH TIME ZONE,
    notification_sent BOOLEAN DEFAULT false,
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_deprecations_contract_id ON api_deprecations(contract_id);
CREATE INDEX IF NOT EXISTS idx_api_deprecations_status ON api_deprecations(status);

-- Contract Validation History
CREATE TABLE IF NOT EXISTS contract_validations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contract_id UUID REFERENCES api_contracts(id) ON DELETE CASCADE,
    valid BOOLEAN NOT NULL,
    errors JSONB DEFAULT '[]'::jsonb,
    warnings JSONB DEFAULT '[]'::jsonb,
    validated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contract_validations_contract_id ON contract_validations(contract_id);

-- Compatibility Check Results
CREATE TABLE IF NOT EXISTS compatibility_checks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_contract_id UUID REFERENCES api_contracts(id) ON DELETE CASCADE,
    target_contract_id UUID REFERENCES api_contracts(id) ON DELETE CASCADE,
    compatible BOOLEAN NOT NULL,
    breaking_changes JSONB DEFAULT '[]'::jsonb,
    warnings JSONB DEFAULT '[]'::jsonb,
    recommendation TEXT,
    checked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_compatibility_checks_source ON compatibility_checks(source_contract_id);
CREATE INDEX IF NOT EXISTS idx_compatibility_checks_target ON compatibility_checks(target_contract_id);

-- Governance Rules
CREATE TABLE IF NOT EXISTS governance_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    rule_type VARCHAR(100) NOT NULL,
    condition JSONB NOT NULL,
    action VARCHAR(100),
    severity VARCHAR(50) DEFAULT 'warning',
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_governance_rules_type ON governance_rules(rule_type);
CREATE INDEX IF NOT EXISTS idx_governance_rules_enabled ON governance_rules(enabled);

-- Add comments
COMMENT ON TABLE api_contracts IS 'Stores API contract definitions including schema, endpoints, and metadata';
COMMENT ON TABLE api_versions IS 'Tracks API version history and changes';
COMMENT ON TABLE api_deprecations IS 'Manages API deprecation lifecycle and sunset dates';
COMMENT ON TABLE contract_validations IS 'History of contract validation results';
COMMENT ON TABLE compatibility_checks IS 'Stores compatibility check results between API versions';
COMMENT ON TABLE governance_rules IS 'Defines governance rules for API management';