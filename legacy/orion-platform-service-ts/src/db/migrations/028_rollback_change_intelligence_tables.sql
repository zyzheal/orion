-- Rollback Migration 028: Drop AI Change Intelligence tables
DROP TABLE IF EXISTS change_intelligence_historical_matches CASCADE;
DROP TABLE IF EXISTS change_intelligence_risk_factors CASCADE;
DROP TABLE IF EXISTS change_intelligence_affected_services CASCADE;
DROP TABLE IF EXISTS change_intelligence_reports CASCADE;
