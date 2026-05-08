-- Rollback Migration 129: Drop inline_script_approvals tables

DROP TABLE IF EXISTS approval_decisions CASCADE;
DROP TABLE IF EXISTS inline_script_approvals CASCADE;
