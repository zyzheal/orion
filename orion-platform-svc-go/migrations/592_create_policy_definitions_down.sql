-- Reversal of 592_create_policy_definitions.sql.
DROP INDEX IF EXISTS idx_policy_definitions_created;
DROP INDEX IF EXISTS idx_policy_definitions_enabled;
DROP INDEX IF EXISTS idx_policy_definitions_tenant;
DROP TABLE IF EXISTS policy_definitions;
