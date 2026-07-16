-- Rollback Migration 031: Drop AI Cost Optimization Tables
-- 按依赖逆序删除表

DROP TABLE IF EXISTS model_pricing CASCADE;
DROP TABLE IF EXISTS alert_rules CASCADE;
DROP TABLE IF EXISTS cost_records CASCADE;
DROP TABLE IF EXISTS budgets CASCADE;
