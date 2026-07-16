-- Rollback Migration 132_create_secrets_table
-- Auto-generated rollback script
-- Review carefully before executing in production

-- Dropping table: secrets
DROP TABLE IF EXISTS secrets CASCADE;

DROP INDEX IF EXISTS idx_;
DROP INDEX IF EXISTS idx_;
