-- Rollback Migration 029: Drop ML Canary Analysis tables
DROP TABLE IF EXISTS canary_retrain_jobs CASCADE;
DROP TABLE IF EXISTS canary_decisions CASCADE;
DROP TABLE IF EXISTS canary_ml_results CASCADE;
DROP TABLE IF EXISTS canary_metric_results CASCADE;
DROP TABLE IF EXISTS canary_analysis_configs CASCADE;
DROP TABLE IF EXISTS canary_analysis_runs CASCADE;
