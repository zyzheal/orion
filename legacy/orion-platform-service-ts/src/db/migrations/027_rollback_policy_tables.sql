-- Rollback Migration 027: Drop OPA Policy Engine tables
DROP TABLE IF EXISTS policy_overrides CASCADE;
DROP TABLE IF EXISTS policy_violations CASCADE;
DROP TABLE IF EXISTS policy_evaluations CASCADE;
DROP TABLE IF EXISTS policy_bundles CASCADE;
DROP TABLE IF EXISTS policy_definitions CASCADE;
