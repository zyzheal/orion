CREATE TABLE IF NOT EXISTS config_namespace (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL DEFAULT '',
    name VARCHAR(100) NOT NULL,
    description TEXT DEFAULT '',
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_tenant_config_namespace ON config_namespace(tenant_id);
CREATE INDEX IF NOT EXISTS idx_status_config_namespace ON config_namespace(status);

CREATE TABLE IF NOT EXISTS config_group (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL DEFAULT '',
    namespace_id VARCHAR(36) NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT DEFAULT '',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_namespace_config_group ON config_group(namespace_id);
CREATE INDEX IF NOT EXISTS idx_tenant_config_group ON config_group(tenant_id);

CREATE TABLE IF NOT EXISTS config_item (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL DEFAULT '',
    group_id VARCHAR(36) NOT NULL,
    namespace_id VARCHAR(36) NOT NULL,
    key_name VARCHAR(255) NOT NULL,
    value TEXT NOT NULL,
    value_type VARCHAR(20) NOT NULL DEFAULT 'string',
    encrypted SMALLINT NOT NULL DEFAULT 0,
    description TEXT DEFAULT '',
    labels JSON DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_group_key_config_item ON config_item(group_id, key_name);
CREATE INDEX IF NOT EXISTS idx_tenant_config_item ON config_item(tenant_id);
CREATE INDEX IF NOT EXISTS idx_namespace_config_item ON config_item(namespace_id);

CREATE TABLE IF NOT EXISTS config_item_history (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL DEFAULT '',
    item_id VARCHAR(36) NOT NULL,
    version INT NOT NULL,
    old_value TEXT DEFAULT NULL,
    new_value TEXT NOT NULL,
    operator VARCHAR(100) NOT NULL DEFAULT '',
    reason TEXT DEFAULT '',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_item_config_item_history ON config_item_history(item_id);
CREATE INDEX IF NOT EXISTS idx_tenant_config_item_history ON config_item_history(tenant_id);
CREATE INDEX IF NOT EXISTS idx_version_config_item_history ON config_item_history(version);

CREATE TABLE IF NOT EXISTS config_snapshot (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL DEFAULT '',
    group_id VARCHAR(36) NOT NULL,
    namespace_id VARCHAR(36) NOT NULL,
    environment VARCHAR(50) NOT NULL DEFAULT 'default',
    version INT NOT NULL,
    data JSON NOT NULL,
    checksum VARCHAR(64) NOT NULL DEFAULT '',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100) NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_group_env_config_snapshot ON config_snapshot(group_id, environment);
CREATE INDEX IF NOT EXISTS idx_version_config_snapshot ON config_snapshot(version);
CREATE INDEX IF NOT EXISTS idx_tenant_config_snapshot ON config_snapshot(tenant_id);

CREATE TABLE IF NOT EXISTS config_release (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL DEFAULT '',
    snapshot_id VARCHAR(36) NOT NULL,
    group_id VARCHAR(36) NOT NULL,
    environment VARCHAR(50) NOT NULL DEFAULT 'default',
    release_version INT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    release_note TEXT DEFAULT '',
    released_at TIMESTAMP DEFAULT NULL,
    released_by VARCHAR(100) DEFAULT '',
    rollback_to_snapshot_id VARCHAR(36) DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_group_env_config_release ON config_release(group_id, environment);
CREATE INDEX IF NOT EXISTS idx_status_config_release ON config_release(status);
CREATE INDEX IF NOT EXISTS idx_tenant_config_release ON config_release(tenant_id);

CREATE TABLE IF NOT EXISTS config_release_history (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL DEFAULT '',
    release_id VARCHAR(36) NOT NULL,
    group_id VARCHAR(36) NOT NULL,
    environment VARCHAR(50) NOT NULL,
    version INT NOT NULL,
    operator VARCHAR(100) DEFAULT '',
    action VARCHAR(50) NOT NULL,
    detail TEXT DEFAULT '',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_release_config_release_history ON config_release_history(release_id);
CREATE INDEX IF NOT EXISTS idx_group_env_config_release_history ON config_release_history(group_id, environment);

CREATE TABLE IF NOT EXISTS config_audit (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL DEFAULT '',
    actor VARCHAR(100) NOT NULL,
    action VARCHAR(50) NOT NULL,
    target_type VARCHAR(50) NOT NULL,
    target_id VARCHAR(36) NOT NULL,
    detail JSON DEFAULT NULL,
    ip_address VARCHAR(45) DEFAULT '',
    user_agent VARCHAR(500) DEFAULT '',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_actor_config_audit ON config_audit(actor);
CREATE INDEX IF NOT EXISTS idx_action_config_audit ON config_audit(action);
CREATE INDEX IF NOT EXISTS idx_target_config_audit ON config_audit(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_created_config_audit ON config_audit(created_at);