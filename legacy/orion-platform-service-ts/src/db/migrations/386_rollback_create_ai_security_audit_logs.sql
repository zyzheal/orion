-- Rollback Migration 385: Drop AI Security audit tables

DROP TABLE IF EXISTS ai_security_blocked_requests;
DROP TABLE IF EXISTS ai_security_audit_logs;
