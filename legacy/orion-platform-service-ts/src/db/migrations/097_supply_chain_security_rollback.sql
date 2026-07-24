-- Rollback Migration 097_supply_chain_security
-- Auto-generated rollback script
-- Review carefully before executing in production

-- Dropping table: supply_chain_sboms
DROP TABLE IF EXISTS supply_chain_sboms CASCADE;

-- Dropping table: dependency_graphs
DROP TABLE IF EXISTS dependency_graphs CASCADE;

-- Dropping table: artifact_signatures
DROP TABLE IF EXISTS artifact_signatures CASCADE;

DROP INDEX IF EXISTS CREATE INDEX idx_;
DROP INDEX IF EXISTS CREATE INDEX idx_;
DROP INDEX IF EXISTS CREATE INDEX idx_;
DROP INDEX IF EXISTS CREATE INDEX idx_dependency_graph;
DROP INDEX IF EXISTS CREATE INDEX idx_dependency_graph;
DROP INDEX IF EXISTS CREATE INDEX idx_artifact_;
DROP INDEX IF EXISTS CREATE INDEX idx_artifact_;
DROP INDEX IF EXISTS CREATE INDEX idx_artifact_;
