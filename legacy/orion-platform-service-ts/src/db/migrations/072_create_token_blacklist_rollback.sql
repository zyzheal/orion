-- Rollback Migration 072_create_token_blacklist
-- Auto-generated rollback script
-- Review carefully before executing in production

-- Dropping table: token_blacklist
DROP TABLE IF EXISTS token_blacklist CASCADE;

-- Dropping table: token_revocation_batch
DROP TABLE IF EXISTS token_revocation_batch CASCADE;

DROP INDEX IF EXISTS CREATE INDEX idx_token_blackli;
DROP INDEX IF EXISTS CREATE INDEX idx_token_blackli;
DROP INDEX IF EXISTS CREATE INDEX idx_token_blackli;
DROP INDEX IF EXISTS CREATE INDEX idx_token_blackli;
DROP INDEX IF EXISTS CREATE INDEX idx_token_revocation_batch_id ON token_revocation_batch(batch_id);;
DROP INDEX IF EXISTS CREATE INDEX idx_token_revocation_batch_target ON token_revocation_batch(target_type, target_id);;
DROP INDEX IF EXISTS CREATE INDEX idx_token_revocation_batch_;
