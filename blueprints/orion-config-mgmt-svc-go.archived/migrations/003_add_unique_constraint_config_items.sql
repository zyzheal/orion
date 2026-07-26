ALTER TABLE config_items ADD CONSTRAINT uq_config_items_tenant_key_env UNIQUE (tenant_id, key, environment);
