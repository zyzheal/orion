-- Migration 138 Rollback: Quality Gates
-- GAP-CN-04: 回滚代码质量门禁

DROP TABLE IF EXISTS quality_gate_results;
DROP TABLE IF EXISTS quality_gates;
