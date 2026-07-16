-- Rollback Migration 031_create_cost_tables
-- Auto-generated rollback script
-- Review carefully before executing in production

-- Dropping table: budgets
DROP TABLE IF EXISTS budgets CASCADE;

-- Dropping table: cost_records
DROP TABLE IF EXISTS cost_records CASCADE;

-- Dropping table: alert_rules
DROP TABLE IF EXISTS alert_rules CASCADE;

-- Dropping table: model_pricing
DROP TABLE IF EXISTS model_pricing CASCADE;

DROP INDEX IF EXISTS CREATE INDEX idx_budget;
DROP INDEX IF EXISTS CREATE INDEX idx_budget;
DROP INDEX IF EXISTS CREATE INDEX idx_co;
DROP INDEX IF EXISTS CREATE INDEX idx_co;
DROP INDEX IF EXISTS CREATE INDEX idx_co;
DROP INDEX IF EXISTS CREATE INDEX idx_co;
DROP INDEX IF EXISTS CREATE INDEX idx_co;
DROP INDEX IF EXISTS CREATE INDEX idx_alert_rule;
DROP INDEX IF EXISTS CREATE INDEX idx_alert_rule;
DROP INDEX IF EXISTS CREATE INDEX idx_alert_rule;
DROP INDEX IF EXISTS CREATE INDEX idx_model_pricing_provider ON model_pricing(provider);;
DROP INDEX IF EXISTS CREATE INDEX idx_model_pricing_active ON model_pricing(provider, model) WHERE effective_to IS NULL;;
