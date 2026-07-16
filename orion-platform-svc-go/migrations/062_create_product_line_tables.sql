-- Product Line module tables

CREATE TABLE IF NOT EXISTS product_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    phase VARCHAR(50) NOT NULL DEFAULT 'Pending',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_product_lines_tenant_id ON product_lines(tenant_id);
CREATE INDEX IF NOT EXISTS idx_product_lines_phase ON product_lines(phase);

CREATE TABLE IF NOT EXISTS release_trains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    product_line_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    schedule VARCHAR(255),
    target_branch VARCHAR(255),
    source_branch VARCHAR(255),
    auto_promote BOOLEAN DEFAULT FALSE,
    approval_required BOOLEAN DEFAULT FALSE,
    approvers VARCHAR(255),
    state VARCHAR(50) NOT NULL DEFAULT 'idle',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_release_trains_tenant_id ON release_trains(tenant_id);
CREATE INDEX IF NOT EXISTS idx_release_trains_product_line_id ON release_trains(product_line_id);
CREATE INDEX IF NOT EXISTS idx_release_trains_state ON release_trains(state);

CREATE TABLE IF NOT EXISTS hotfix_channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    product_line_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    branch_pattern VARCHAR(255),
    approval_required BOOLEAN DEFAULT FALSE,
    approval_timeout INTEGER DEFAULT 30,
    auto_merge BOOLEAN DEFAULT FALSE,
    notify_on_call BOOLEAN DEFAULT FALSE,
    max_duration INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_hotfix_channels_tenant_id ON hotfix_channels(tenant_id);
CREATE INDEX IF NOT EXISTS idx_hotfix_channels_product_line_id ON hotfix_channels(product_line_id);
CREATE INDEX IF NOT EXISTS idx_hotfix_channels_enabled ON hotfix_channels(enabled);
