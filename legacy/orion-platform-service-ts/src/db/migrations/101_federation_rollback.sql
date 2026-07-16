-- Rollback Migration 101_federation
-- Auto-generated rollback script
-- Review carefully before executing in production

-- Dropping table: federation_clusters
DROP TABLE IF EXISTS federation_clusters CASCADE;

-- Dropping table: cluster_health
DROP TABLE IF EXISTS cluster_health CASCADE;

-- Dropping table: cross_cluster_jobs
DROP TABLE IF EXISTS cross_cluster_jobs CASCADE;

DROP INDEX IF EXISTS CREATE INDEX idx_federation_clu;
DROP INDEX IF EXISTS CREATE INDEX idx_federation_clu;
DROP INDEX IF EXISTS CREATE INDEX idx_federation_clu;
DROP INDEX IF EXISTS CREATE INDEX idx_federation_clu;
DROP INDEX IF EXISTS CREATE INDEX idx_clu;
DROP INDEX IF EXISTS CREATE INDEX idx_clu;
DROP INDEX IF EXISTS CREATE INDEX idx_clu;
DROP INDEX IF EXISTS CREATE INDEX idx_clu;
DROP INDEX IF EXISTS CREATE INDEX idx_cro;
DROP INDEX IF EXISTS CREATE INDEX idx_cro;
DROP INDEX IF EXISTS CREATE INDEX idx_cro;
DROP INDEX IF EXISTS CREATE INDEX idx_cro;
DROP INDEX IF EXISTS CREATE INDEX idx_cro;
