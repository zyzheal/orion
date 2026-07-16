-- Rollback Migration 089_environment_management
-- Auto-generated rollback script
-- Review carefully before executing in production

-- Dropping table: environment_templates
DROP TABLE IF EXISTS environment_templates CASCADE;

-- Dropping table: environment_hibernation_log
DROP TABLE IF EXISTS environment_hibernation_log CASCADE;

-- Dropping table: environment_ttl_config
DROP TABLE IF EXISTS environment_ttl_config CASCADE;

DROP INDEX IF EXISTS CREATE INDEX idx_env_template;
DROP INDEX IF EXISTS CREATE INDEX idx_env_template;
DROP INDEX IF EXISTS CREATE INDEX idx_env_template;
DROP INDEX IF EXISTS CREATE INDEX idx_env_hibernation_tenant ON environment_hibernation_log(tenant_id);;
DROP INDEX IF EXISTS CREATE INDEX idx_env_hibernation_env ON environment_hibernation_log(environment_id);;
DROP INDEX IF EXISTS CREATE INDEX idx_env_hibernation_action ON environment_hibernation_log(action);;
DROP INDEX IF EXISTS CREATE INDEX idx_env_hibernation_;
DROP INDEX IF EXISTS CREATE INDEX idx_env_ttl_tenant ON environment_ttl_config(tenant_id);;
DROP INDEX IF EXISTS CREATE INDEX idx_env_ttl_env ON environment_ttl_config(environment_id);;
DROP INDEX IF EXISTS CREATE INDEX idx_env_ttl_template ON environment_ttl_config(template_id);;
DROP INDEX IF EXISTS idx_env_template;
DROP INDEX IF EXISTS idx_env_hibernation_tenant_rl;
DROP INDEX IF EXISTS idx_env_ttl_tenant_rl;
