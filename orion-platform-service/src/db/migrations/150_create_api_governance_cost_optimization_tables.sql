-- Migration 150: Create API Governance and Cost Optimization tables
-- Created for: Map to PostgreSQL migration
-- Tables: api_contracts, api_contract_violations, api_versions, governance_rules, api_inventory, cost_recommendations, savings_tracking

-- ==================== API Contracts ====================
CREATE TABLE IF NOT EXISTS api_contracts (
    id UUID PRIMARY KEY,
    tenant_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    endpoint VARCHAR(512) NOT NULL,
    method VARCHAR(10) NOT NULL,
    schema JSONB DEFAULT '{}',
    version VARCHAR(50) DEFAULT '1.0.0',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_contracts_tenant ON api_contracts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_api_contracts_endpoint ON api_contracts(endpoint);

-- ==================== API Contract Violations ====================
CREATE TABLE IF NOT EXISTS api_contract_violations (
    id UUID PRIMARY KEY,
    contract_id UUID NOT NULL REFERENCES api_contracts(id) ON DELETE CASCADE,
    violation_type VARCHAR(50) NOT NULL,
    description TEXT NOT NULL,
    severity VARCHAR(20) NOT NULL,
    detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    sample_data JSONB
);

CREATE INDEX IF NOT EXISTS idx_api_contract_violations_contract ON api_contract_violations(contract_id);

-- ==================== API Versions ====================
CREATE TABLE IF NOT EXISTS api_versions (
    id UUID PRIMARY KEY,
    tenant_id VARCHAR(255) NOT NULL,
    api_id VARCHAR(255) NOT NULL,
    version VARCHAR(50) NOT NULL,
    definition JSONB DEFAULT '{}',
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deprecated_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_api_versions_tenant ON api_versions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_api_versions_api ON api_versions(api_id);

-- ==================== Governance Rules ====================
CREATE TABLE IF NOT EXISTS governance_rules (
    id UUID PRIMARY KEY,
    tenant_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    rule_type VARCHAR(50) NOT NULL,
    config JSONB DEFAULT '{}',
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_governance_rules_tenant ON governance_rules(tenant_id);
CREATE INDEX IF NOT EXISTS idx_governance_rules_type ON governance_rules(rule_type);

-- ==================== API Inventory ====================
CREATE TABLE IF NOT EXISTS api_inventory (
    id UUID PRIMARY KEY,
    tenant_id VARCHAR(255) NOT NULL,
    api_data JSONB NOT NULL,
    registered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_inventory_tenant ON api_inventory(tenant_id);

-- ==================== Cost Recommendations ====================
CREATE TABLE IF NOT EXISTS cost_recommendations (
    id UUID PRIMARY KEY,
    tenant_id VARCHAR(255) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    opportunities JSONB DEFAULT '[]',
    total_estimated_savings DECIMAL(15,2) DEFAULT 0,
    priority VARCHAR(20) DEFAULT 'medium',
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    applied_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_cost_recommendations_tenant ON cost_recommendations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cost_recommendations_status ON cost_recommendations(status);

-- ==================== Savings Tracking ====================
CREATE TABLE IF NOT EXISTS savings_tracking (
    id UUID PRIMARY KEY,
    tenant_id VARCHAR(255) NOT NULL,
    recommendation_id UUID NOT NULL,
    month VARCHAR(7) NOT NULL,
    actual_savings DECIMAL(15,2) DEFAULT 0,
    estimated_savings DECIMAL(15,2) DEFAULT 0,
    achievement_rate INTEGER DEFAULT 0,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_savings_tracking_tenant ON savings_tracking(tenant_id);
CREATE INDEX IF NOT EXISTS idx_savings_tracking_recommendation ON savings_tracking(recommendation_id);

-- Rollback
-- DROP TABLE IF EXISTS savings_tracking CASCADE;
-- DROP TABLE IF EXISTS cost_recommendations CASCADE;
-- DROP TABLE IF EXISTS api_inventory CASCADE;
-- DROP TABLE IF EXISTS governance_rules CASCADE;
-- DROP TABLE IF EXISTS api_versions CASCADE;
-- DROP TABLE IF EXISTS api_contract_violations CASCADE;
-- DROP TABLE IF EXISTS api_contracts CASCADE;