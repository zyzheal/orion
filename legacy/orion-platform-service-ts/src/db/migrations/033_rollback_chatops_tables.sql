-- Rollback Migration 033: Drop ChatOps tables
DROP TABLE IF EXISTS chatops_audit_logs CASCADE;
DROP TABLE IF EXISTS chatops_sessions CASCADE;
DROP TABLE IF EXISTS chatops_executions CASCADE;
DROP TABLE IF EXISTS chatops_commands CASCADE;
