-- Migration 581 rollback: code scan tables for internal/code-scan
--
-- Reverse of 581_create_code_scan_tables.sql. Both tables are owned by
-- internal/code-scan alone, so dropping them loses nothing from another
-- module.
--
-- Findings first, then runs: the runner applies this inside its own
-- transaction, so the order is cosmetic, but it mirrors the dependency
-- direction (a finding references a run).

DROP TABLE IF EXISTS code_scan_findings;
DROP TABLE IF EXISTS code_scan_runs;
