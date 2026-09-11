CREATE TABLE IF NOT EXISTS form_definition (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL DEFAULT '',
    name VARCHAR(200) NOT NULL,
    title VARCHAR(200) DEFAULT '',
    description TEXT DEFAULT '',
    version INT NOT NULL DEFAULT 1,
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
    category VARCHAR(100) DEFAULT '',
    module_name VARCHAR(100) DEFAULT '',
    tags JSON DEFAULT NULL,
    layout JSON DEFAULT NULL,
    fields JSON NOT NULL,
    meta JSON DEFAULT NULL,
    created_by VARCHAR(100) DEFAULT '',
    updated_by VARCHAR(100) DEFAULT '',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_tenant_form_definition ON form_definition(tenant_id);
CREATE INDEX IF NOT EXISTS idx_status_form_definition ON form_definition(status);
CREATE INDEX IF NOT EXISTS idx_category_form_definition ON form_definition(category);

CREATE TABLE IF NOT EXISTS form_field (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL DEFAULT '',
    form_id VARCHAR(36) NOT NULL,
    key VARCHAR(200) NOT NULL,
    label VARCHAR(200) NOT NULL,
    type VARCHAR(50) NOT NULL,
    required SMALLINT NOT NULL DEFAULT 0,
    visible SMALLINT NOT NULL DEFAULT 1,
    disabled SMALLINT NOT NULL DEFAULT 0,
    placeholder VARCHAR(200) DEFAULT '',
    default_val JSON DEFAULT NULL,
    options JSON DEFAULT NULL,
    rules JSON DEFAULT NULL,
    meta JSON DEFAULT NULL,
    layout_config JSON DEFAULT NULL,
    sortable_index INT NOT NULL DEFAULT 0,
    parent_key VARCHAR(200) DEFAULT '',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_form_key_form_field ON form_field(form_id, key);
CREATE INDEX IF NOT EXISTS idx_tenant_form_field ON form_field(tenant_id);

CREATE TABLE IF NOT EXISTS form_template (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL DEFAULT '',
    name VARCHAR(200) NOT NULL,
    description TEXT DEFAULT '',
    category VARCHAR(100) DEFAULT '',
    is_builtin SMALLINT NOT NULL DEFAULT 0,
    form_schema JSON NOT NULL,
    preview_url VARCHAR(500) DEFAULT '',
    usage_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_category_form_template ON form_template(category);
CREATE INDEX IF NOT EXISTS idx_tenant_form_template ON form_template(tenant_id);

CREATE TABLE IF NOT EXISTS form_instance (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL DEFAULT '',
    form_id VARCHAR(36) NOT NULL,
    data JSON NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    submitted_by VARCHAR(100) DEFAULT '',
    submitted_at TIMESTAMP DEFAULT NULL,
    approved_by VARCHAR(100) DEFAULT '',
    approved_at TIMESTAMP DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_form_form_instance ON form_instance(form_id);
CREATE INDEX IF NOT EXISTS idx_tenant_form_instance ON form_instance(tenant_id);
CREATE INDEX IF NOT EXISTS idx_status_form_instance ON form_instance(status);

CREATE TABLE IF NOT EXISTS component_registry (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL DEFAULT '',
    name VARCHAR(100) NOT NULL,
    display_name VARCHAR(200) NOT NULL,
    category VARCHAR(50) NOT NULL DEFAULT 'basic',
    version VARCHAR(20) DEFAULT '1.0.0',
    props_schema JSON NOT NULL,
    default_config JSON DEFAULT NULL,
    icon VARCHAR(100) DEFAULT '',
    is_builtin SMALLINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_category_component_registry ON component_registry(category);
CREATE INDEX IF NOT EXISTS idx_tenant_component_registry ON component_registry(tenant_id);