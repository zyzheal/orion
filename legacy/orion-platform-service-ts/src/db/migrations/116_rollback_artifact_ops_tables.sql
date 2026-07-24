-- Rollback Migration 116: Drop artifact-ops tables
-- Date: 2026-05-06

DROP TABLE IF EXISTS malicious_detections CASCADE;
DROP TABLE IF EXISTS scan_findings CASCADE;
DROP TABLE IF EXISTS scan_reports CASCADE;
DROP TABLE IF EXISTS retention_evaluations CASCADE;
DROP TABLE IF EXISTS retention_policies CASCADE;
DROP TABLE IF EXISTS artifact_operations CASCADE;
