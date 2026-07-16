-- Rollback Migration 120: Drop unified_resources and deployment_results tables

DROP TABLE IF EXISTS deployment_results CASCADE;
DROP TABLE IF EXISTS unified_resources CASCADE;
