-- Page Registry module tables

CREATE TABLE IF NOT EXISTS page_registries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    path VARCHAR(255) NOT NULL,
    component VARCHAR(255) NOT NULL,
    protected BOOLEAN DEFAULT FALSE,
    permission VARCHAR(255),
    hide_layout BOOLEAN DEFAULT FALSE,
    micro_app BOOLEAN DEFAULT FALSE,
    sub_app_key VARCHAR(255),
    menu_key VARCHAR(255),
    menu_label VARCHAR(255),
    menu_icon VARCHAR(255),
    hidden BOOLEAN DEFAULT FALSE,
    redirect_to VARCHAR(255),
    title VARCHAR(255),
    breadcrumb BOOLEAN DEFAULT FALSE,
    sort_order INTEGER DEFAULT 0,
    status VARCHAR(50) NOT NULL DEFAULT 'enabled',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_page_registries_tenant_id ON page_registries(tenant_id);
CREATE INDEX IF NOT EXISTS idx_page_registries_path ON page_registries(path);
CREATE INDEX IF NOT EXISTS idx_page_registries_status ON page_registries(status);

CREATE TABLE IF NOT EXISTS page_registry_histories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    page_id VARCHAR(255) NOT NULL,
    action VARCHAR(50) NOT NULL,
    changed_by VARCHAR(255),
    changes TEXT,
    old_value TEXT,
    new_value TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_page_registry_histories_tenant_id ON page_registry_histories(tenant_id);
CREATE INDEX IF NOT EXISTS idx_page_registry_histories_page_id ON page_registry_histories(page_id);
CREATE INDEX IF NOT EXISTS idx_page_registry_histories_created_at ON page_registry_histories(created_at DESC);
