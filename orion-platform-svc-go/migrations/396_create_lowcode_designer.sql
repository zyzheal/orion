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
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_tenant (tenant_id),
    INDEX idx_status (status),
    INDEX idx_category (category)
);

CREATE TABLE IF NOT EXISTS form_field (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL DEFAULT '',
    form_id VARCHAR(36) NOT NULL,
    key VARCHAR(200) NOT NULL,
    label VARCHAR(200) NOT NULL,
    type VARCHAR(50) NOT NULL,
    required TINYINT NOT NULL DEFAULT 0,
    visible TINYINT NOT NULL DEFAULT 1,
    disabled TINYINT NOT NULL DEFAULT 0,
    placeholder VARCHAR(200) DEFAULT '',
    default_val JSON DEFAULT NULL,
    options JSON DEFAULT NULL,
    rules JSON DEFAULT NULL,
    meta JSON DEFAULT NULL,
    layout_config JSON DEFAULT NULL,
    sortable_index INT NOT NULL DEFAULT 0,
    parent_key VARCHAR(200) DEFAULT '',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE INDEX idx_form_key (form_id, key),
    INDEX idx_tenant (tenant_id)
);

CREATE TABLE IF NOT EXISTS form_template (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL DEFAULT '',
    name VARCHAR(200) NOT NULL,
    description TEXT DEFAULT '',
    category VARCHAR(100) DEFAULT '',
    is_builtin TINYINT NOT NULL DEFAULT 0,
    form_schema JSON NOT NULL,
    preview_url VARCHAR(500) DEFAULT '',
    usage_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_category (category),
    INDEX idx_tenant (tenant_id)
);

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
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_form (form_id),
    INDEX idx_tenant (tenant_id),
    INDEX idx_status (status)
);

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
    is_builtin TINYINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_category (category),
    INDEX idx_tenant (tenant_id)
);