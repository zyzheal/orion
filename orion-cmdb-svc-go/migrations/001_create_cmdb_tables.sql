CREATE TABLE IF NOT EXISTS ci_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name VARCHAR(255),
    ci_type VARCHAR(100),
    status VARCHAR(50),
    owner VARCHAR(255),
    attributes JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ci_relations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    source_ci_id UUID,
    target_ci_id UUID,
    relation_type VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS ci_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    ci_id UUID,
    action VARCHAR(50),
    actor VARCHAR(255),
    old_value JSONB,
    new_value JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_ci_tenant ON ci_items(tenant_id);
CREATE INDEX idx_ci_type ON ci_items(ci_type);
CREATE INDEX idx_ci_status ON ci_items(status);
CREATE INDEX idx_relations_tenant ON ci_relations(tenant_id);
CREATE INDEX idx_relations_source ON ci_relations(source_ci_id);
CREATE INDEX idx_relations_target ON ci_relations(target_ci_id);
CREATE INDEX idx_audit_tenant ON ci_audit_log(tenant_id);
CREATE INDEX idx_audit_ci ON ci_audit_log(ci_id);
