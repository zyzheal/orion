-- Rollback Migration 117: Drop performance management tables

DROP TABLE IF EXISTS performance_test_results CASCADE;
DROP TABLE IF EXISTS performance_evaluations CASCADE;
DROP TABLE IF EXISTS performance_profiles CASCADE;
DROP TABLE IF EXISTS performance_baselines CASCADE;
