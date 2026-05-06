-- Rollback Migration 118: Drop model version management tables

DROP TABLE IF EXISTS ab_test_metrics CASCADE;
DROP TABLE IF EXISTS ab_tests CASCADE;
DROP TABLE IF EXISTS model_versions CASCADE;
