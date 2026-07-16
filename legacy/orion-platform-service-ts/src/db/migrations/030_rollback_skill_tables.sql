-- Rollback Migration 030: Drop Skill Package Tables
-- 按依赖逆序删除表

DROP TABLE IF EXISTS skill_reviews CASCADE;
DROP TABLE IF EXISTS skill_versions CASCADE;
DROP TABLE IF EXISTS skill_packages CASCADE;
