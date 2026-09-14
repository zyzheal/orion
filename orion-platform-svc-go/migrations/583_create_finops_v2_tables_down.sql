-- Reversal of 583_create_finops_v2_tables.sql.
DROP INDEX IF EXISTS idx_finops_v2_alert_triggers_budget;
DROP INDEX IF EXISTS idx_finops_v2_alert_triggers_tenant;
DROP INDEX IF EXISTS idx_finops_v2_roi_tenant;
DROP INDEX IF EXISTS idx_finops_v2_reports_tenant;
DROP INDEX IF EXISTS idx_finops_v2_recommendations_status;
DROP INDEX IF EXISTS idx_finops_v2_recommendations_type;
DROP INDEX IF EXISTS idx_finops_v2_recommendations_tenant;
DROP INDEX IF EXISTS idx_finops_v2_chargebacks_tenant;
DROP INDEX IF EXISTS idx_finops_v2_budgets_status;
DROP INDEX IF EXISTS idx_finops_v2_budgets_tenant;
DROP INDEX IF EXISTS idx_finops_v2_costs_created;
DROP INDEX IF EXISTS idx_finops_v2_costs_provider;
DROP INDEX IF EXISTS idx_finops_v2_costs_entity;
DROP INDEX IF EXISTS idx_finops_v2_costs_tenant;

DROP TABLE IF EXISTS finops_v2_alert_triggers;
DROP TABLE IF EXISTS finops_v2_collection_schedules;
DROP TABLE IF EXISTS finops_v2_roi;
DROP TABLE IF EXISTS finops_v2_reports;
DROP TABLE IF EXISTS finops_v2_recommendations;
DROP TABLE IF EXISTS finops_v2_chargebacks;
DROP TABLE IF EXISTS finops_v2_budgets;
DROP TABLE IF EXISTS finops_v2_costs;
