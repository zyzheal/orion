-- Rollback Migration 071_create_jwt_key_rotation
-- Auto-generated rollback script
-- Review carefully before executing in production

-- Dropping table: jwt_key_rotation
DROP TABLE IF EXISTS jwt_key_rotation CASCADE;

-- Dropping table: jwt_key_rotation_history
DROP TABLE IF EXISTS jwt_key_rotation_history CASCADE;

DROP INDEX IF EXISTS CREATE INDEX idx_jwt_key_rotation_;
DROP INDEX IF EXISTS CREATE INDEX idx_jwt_key_rotation_expire;
DROP INDEX IF EXISTS CREATE INDEX idx_jwt_key_rotation_key_id ON jwt_key_rotation(key_id);;
DROP INDEX IF EXISTS CREATE INDEX idx_jwt_rotation_hi;
DROP INDEX IF EXISTS CREATE INDEX idx_jwt_rotation_hi;
