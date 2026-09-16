-- Reverse 683_create_governance_risk_tables.sql.
-- Order: child tables first (reports reference assessments).
DROP INDEX IF EXISTS idx_risk_predictions_level;
DROP INDEX IF EXISTS idx_risk_predictions_expires;
DROP INDEX IF EXISTS idx_risk_predictions_tenant;
DROP INDEX IF EXISTS idx_risk_predictions_target;
DROP TABLE IF EXISTS risk_predictions;
DROP INDEX IF EXISTS idx_risk_reports_assessment;
DROP INDEX IF EXISTS idx_risk_reports_tenant;
DROP TABLE IF EXISTS risk_reports;
DROP INDEX IF EXISTS idx_risk_assessments_level;
DROP INDEX IF EXISTS idx_risk_assessments_target;
DROP INDEX IF EXISTS idx_risk_assessments_tenant;
DROP TABLE IF EXISTS risk_assessments;
DROP INDEX IF EXISTS idx_risk_items_level;
DROP INDEX IF EXISTS idx_risk_items_status;
DROP INDEX IF EXISTS idx_risk_items_tenant;
DROP TABLE IF EXISTS risk_items;
