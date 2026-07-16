-- 001_create_cost_allocation_tables.sql
-- Cost allocation tables

CREATE TABLE IF NOT EXISTS cost_allocations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(50) NOT NULL, -- proportional, custom, tag-based, manual
    status VARCHAR(20) DEFAULT 'draft', -- draft, active, archived
    source_account VARCHAR(255),
    allocation_key VARCHAR(255),
    allocation_rules JSONB,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cost_allocation_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    allocation_id UUID NOT NULL REFERENCES cost_allocations(id) ON DELETE CASCADE,
    condition_type VARCHAR(50) NOT NULL, -- tag, label, regex
    condition_value JSONB NOT NULL,
    percentage DECIMAL(5,2) NOT NULL DEFAULT 100,
    target_services TEXT[],
    target_tags TEXT[],
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cost_allocation_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    allocation_id UUID NOT NULL REFERENCES cost_allocations(id),
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    status VARCHAR(20) DEFAULT 'pending', -- pending, running, completed, failed
    total_cost DECIMAL(12,2),
    allocated_cost DECIMAL(12,2),
    result_data JSONB,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cost_allocation_tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    tag_key VARCHAR(255) NOT NULL,
    tag_value VARCHAR(255) NOT NULL,
    allocation_percent DECIMAL(5,2),
    target_service VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cost_allocations_tenant ON cost_allocations(tenant_id);
CREATE INDEX idx_cost_allocation_rules_allocation ON cost_allocation_rules(allocation_id);
CREATE INDEX idx_cost_allocation_reports_tenant ON cost_allocation_reports(tenant_id);
CREATE INDEX idx_cost_allocation_reports_allocation ON cost_allocation_reports(allocation_id);
CREATE INDEX idx_cost_allocation_tags_tenant ON cost_allocation_tags(tenant_id);