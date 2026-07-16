-- Rollback Migration 134: Pipeline Trigger Persistence Tables
DROP TABLE IF EXISTS pipeline_trigger_executions;
DROP TABLE IF EXISTS pipeline_triggers;
